import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Vite SPA at repo root, single index.html → src/main.ts (spec §3.1).
 * `base: '/'` — static host is Cloudflare Pages at the site root.
 * Unit tests use the default Node environment (pure logic + typed DOM mocks).
 */

/**
 * Serve the onnxruntime-web assets under /ort-wasm/ RAW, bypassing Vite's
 * transform pipeline. ORT's WebGPU backend dynamic-imports the JSEP glue as
 * `ort-wasm-….jsep.mjs?import`; Vite returns 500 for that from public/ (it is
 * not part of the module graph). Raw serving fixes both the dev server and
 * production (static hosts ignore the query string).
 */
function rawOrtWasm(): Plugin {
  return {
    name: 'raw-ort-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/ort-wasm/')) return next();
        const name = decodeURIComponent(url.slice('/ort-wasm/'.length).split('?')[0] ?? '');
        const file = resolve('public/ort-wasm', name);
        if (statSync(file, { throwIfNoEntry: false })) {
          const data = readFileSync(file);
          res.setHeader(
            'content-type',
            name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
          );
          res.end(data);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [rawOrtWasm()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});