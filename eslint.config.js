import tseslint from 'typescript-eslint';

// Minimal flat config (spec §3.1). Heavy checks (budget, privacy greps, no
// unseeded RNG in src/core) live in scripts/ci-checks.mjs as executable CI
// assertions — they are cheaper to keep as data than as lint rules.
//
// Flat config does not import browser/node globals by default, so they are
// declared here to keep `no-undef` honest on non-TS files (TS files get
// `no-undef` disabled — the type system already catches those).
const browserGlobals = {
  console: 'readonly',
  document: 'readonly',
  window: 'readonly',
  navigator: 'readonly',
  crypto: 'readonly',
  sessionStorage: 'readonly',
  localStorage: 'readonly',
  URL: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  fetch: 'readonly',
  ImageData: 'readonly',
  HTMLElement: 'readonly',
  HTMLCanvasElement: 'readonly',
};

const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'public/models/**',
      'public/ort-wasm/**',
      '.venv/**',
      '.wrangler/**',
      // 2018 reference clones — kept on disk, versioned at github.com/KODHAGe/*,
      // NOT part of this repo's build; eslint must never traverse them.
      'shape-constructor/**',
      'shape-interpreter/**',
      'shape-renders/**',
      'shape-decoder/**',
      'shape-mapper/**',
      'shape-consumer/**',
      'architecture.svg',
      '*.png',
    ],
  },
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...browserGlobals },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-undef': 'off', // handled by tsc
      // Skeleton model-boundary adapters keep underscore-prefixed params for
      // interface conformance; allow those without failing lint.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...nodeGlobals },
    },
  },
);