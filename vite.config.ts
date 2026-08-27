import { defineConfig } from 'vitest/config';

/**
 * Vite SPA at repo root, single index.html → src/main.ts (spec §3.1).
 * `base: '/'` — static host is Cloudflare Pages at the site root.
 * Unit tests use the default Node environment (pure logic + typed DOM mocks).
 */
export default defineConfig({
  base: '/',
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