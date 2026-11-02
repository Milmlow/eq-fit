// Vite plugin: after the build, list every file in dist/ and write dist/sw.js (precache list + content-hashed cache name).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function pwaPlugin(templatePath: string): Plugin {
  let outDir = 'dist';
  return {
    name: 'eqfit-pwa',
    apply: 'build',
    enforce: 'post',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files = walk(outDir).filter((f) => relative(outDir, f) !== 'sw.js').sort();
      const urls = files.map((f) => `./${relative(outDir, f).split(sep).join('/')}`);
      const h = createHash('sha256');
      files.forEach((f, i) => { h.update(urls[i]); h.update(readFileSync(f)); });
      const name = `eqfit-static-${h.digest('hex').slice(0, 12)}`;
      const body = readFileSync(templatePath, 'utf8').replace('__CACHE_NAME__', name).replace('/*PRECACHE*/[]', JSON.stringify(['./', ...urls], null, 1));
      writeFileSync(join(outDir, 'sw.js'), body);
    },
  };
}
