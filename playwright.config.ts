import { defineConfig, devices } from '@playwright/test';

// Local-testing projects (LR-6/LR-7):
//   - chromium (default): smoke + missing-model (LR-3) + privacy audit (LR-8)
//     + tier selection; GPU/WebGL NOT required. Excludes the WebGL2 reference
//     tier, which is opt-in below.
//   - webgl-ref (opt-in): the primary WebGL2 reference tier, run explicitly
//     with `--project=webgl-ref` on a machine where that tier should be the
//     visual reference (LR-6).
// The privacy network audit (FR-5) and perf budget (QR-1) now run here against
// the local production build; the deployed-preview re-run remains bound (FR-5).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: /@webglref/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webgl-ref',
      grep: /@webglref/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});