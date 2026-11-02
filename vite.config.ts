/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pwaPlugin } from './scripts/pwa-plugin';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Relative base: the built app works from a subpath (GitHub Pages: /recomp-app/) and from a domain root.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), pwaPlugin(fileURLToPath(new URL('./scripts/sw-template.js', import.meta.url)))],
  server: { host: '127.0.0.1', allowedHosts: ['terminal.local'] },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
