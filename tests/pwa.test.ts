// Install/offline packaging: manifest, icons, index.html links, service-worker generation, and "no HTML injection" source rules.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { pwaPlugin } from '../scripts/pwa-plugin';

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const manifest = JSON.parse(readFileSync(root('public/manifest.webmanifest'), 'utf8'));
const themes = readFileSync(root('src/ui/themes.css'), 'utf8');
const darkBlock = themes.slice(themes.indexOf(':root,'), themes.indexOf('[data-theme="light"]'));
const dark = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(darkBlock)![1].toLowerCase();

function png(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('web manifest', () => {
  it('is a standalone app named EQ Fit with Dark-theme colours and relative paths', () => {
    expect(manifest.name).toBe('EQ Fit');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe(dark('bg'));
    expect(manifest.theme_color).toBe(dark('bg'));
    for (const u of [manifest.start_url, manifest.scope, ...manifest.icons.map((i: { src: string }) => i.src)]) {
      expect(u.startsWith('/'), u).toBe(false);
      expect(u).not.toMatch(/^[a-z]+:/i);
    }
  });
  it('declares 192, 512 and a maskable 512 icon and every file exists with the declared size', () => {
    const icons = manifest.icons as { src: string; sizes: string; type: string; purpose: string }[];
    expect(icons.map((i) => `${i.sizes}/${i.purpose}`).sort()).toEqual(['192x192/any', '512x512/any', '512x512/maskable']);
    for (const i of icons) {
      const { w, h } = png(root(`public/${i.src}`));
      expect(`${w}x${h}`).toBe(i.sizes);
      expect(i.type).toBe('image/png');
    }
  });
  it('apple-touch-icon is 180x180 and index.html links manifest and icons relative to the base', () => {
    expect(png(root('public/icons/apple-touch-icon.png'))).toEqual({ w: 180, h: 180 });
    const html = readFileSync(root('index.html'), 'utf8');
    expect(html).toMatch(/rel="manifest" href="%BASE_URL%manifest\.webmanifest"/);
    expect(html).toMatch(/rel="apple-touch-icon"[^>]*href="%BASE_URL%icons\/apple-touch-icon\.png"/);
    expect(html).not.toMatch(/(href|src)="\/(?!src\/)/);
  });
  it('icon artwork is a plain text mark: no EQ Solutions logo, no trademark sign', () => {
    const svg = readFileSync(root('public/icons/icon.svg'), 'utf8');
    expect(svg).toMatch(/>EQ<\/text>/); expect(svg).toMatch(/>FIT<\/text>/);
    expect(svg).not.toMatch(/<image|\u2122|\bTM\b/);
  });
});

describe('icon files carry no embedded metadata', () => {
  it('PNGs hold only IHDR, IDAT and IEND chunks; the svg has no metadata element', () => {
    for (const n of ['icon-192', 'icon-512', 'icon-maskable-512', 'apple-touch-icon']) {
      const b = readFileSync(root(`public/icons/${n}.png`));
      const names: string[] = [];
      for (let i = 8; i < b.length; i += 12 + b.readUInt32BE(i)) names.push(b.subarray(i + 4, i + 8).toString('latin1'));
      expect([...new Set(names)].sort(), n).toEqual(['IDAT', 'IEND', 'IHDR']);
    }
    expect(readFileSync(root('public/icons/icon.svg'), 'utf8')).not.toMatch(/<metadata|c2pa/i);
  });
});

describe('service worker generation', () => {
  function build(files: Record<string, string>): string {
    const out = mkdtempSync(join(tmpdir(), 'eqfit-sw-'));
    for (const [n, c] of Object.entries(files)) { mkdirSync(join(out, n, '..'), { recursive: true }); writeFileSync(join(out, n), c); }
    const p = pwaPlugin(root('scripts/sw-template.js')) as unknown as { configResolved: (c: unknown) => void; closeBundle: () => void };
    p.configResolved({ build: { outDir: out } });
    p.closeBundle();
    return readFileSync(join(out, 'sw.js'), 'utf8');
  }
  const files = {
    'index.html': '<html></html>', 'manifest.webmanifest': '{}', 'icons/icon-192.png': 'x',
    'assets/index-abc.js': 'js', 'assets/index-abc.css': 'css',
    'assets/archivo-latin-wdth-normal-111.woff2': 'f1', 'assets/archivo-latin-wdth-italic-222.woff2': 'f2',
  };

  it('is valid JavaScript and precaches the app shell, assets, icons and BOTH font files', () => {
    const sw = build(files);
    new vm.Script(sw); // throws on a syntax error
    const list = JSON.parse(/const PRECACHE = (\[[\s\S]*?\]);/.exec(sw)![1]) as string[];
    for (const u of ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './assets/index-abc.js', './assets/index-abc.css',
      './assets/archivo-latin-wdth-normal-111.woff2', './assets/archivo-latin-wdth-italic-222.woff2']) expect(list, u).toContain(u);
    expect(list).not.toContain('./sw.js');
  });
  it('cache name changes when any file changes (so updates are detected) and is stable otherwise', () => {
    const name = (sw: string) => /const CACHE = '([^']+)'/.exec(sw)![1];
    expect(name(build(files))).toBe(name(build(files)));
    expect(name(build(files))).not.toBe(name(build({ ...files, 'assets/index-abc.js': 'js2' })));
    expect(name(build(files))).toMatch(/^eqfit-static-[0-9a-f]{12}$/);
  });
  it('the worker never touches IndexedDB, never auto-skips waiting, and only deletes its own caches', () => {
    const t = readFileSync(root('scripts/sw-template.js'), 'utf8');
    expect(t).not.toMatch(/indexedDB|IDBDatabase|importScripts/);
    expect(t.match(/self\.skipWaiting\(/g)?.length).toBe(1); // only inside the message handler
    expect(t).toMatch(/event\.data\.type === 'SKIP_WAITING'\) self\.skipWaiting/);
    expect(t).toMatch(/k\.startsWith\('eqfit-static-'\)/);
  });
});

describe('source rules: restored or typed text is never rendered as HTML', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  it('no innerHTML, outerHTML, insertAdjacentHTML, dangerouslySetInnerHTML, document.write or eval in src/', () => {
    for (const f of walk(root('src')).filter((x) => /\.(ts|tsx)$/.test(x))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write|\beval\(|new Function\(/);
    }
  });
});
