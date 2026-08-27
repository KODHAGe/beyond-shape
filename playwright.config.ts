import { defineConfig, devices } from '@playwright/test';

// One smoke spec only in this slice (e2e/smoke.spec.ts). The privacy network
// audit (FR-5) and perf budget (QR-1) are trace-level acceptance tests owned
// by the orchestrator once real model binaries exist.
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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});