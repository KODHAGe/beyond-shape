import { test, expect } from '@playwright/test';

// FR-5 / QR-3 / LR-8: local privacy audit against the LOCAL production build
// (vite preview). Asserts against observed reality, not the deployed preview:
//   (i) every outbound request is same-origin (static assets, manifests,
//       /api/status) — no external host is ever contacted;
//   (ii) no WHOLE prompt word appears in any request URL or body (spec §3.2
//        R-f whole-word matching — never substring, to avoid asset-path
//        false positives).
test('no whole prompt words leave the device; all requests are same-origin', async ({ page }) => {
  const prompt = 'sea calm quiet hum';
  const records: string[] = [];
  page.on('request', (req) => {
    records.push(`${req.url()} ${req.postData() ?? ''}`);
  });

  await page.goto('/');
  await page.fill('#bs-prompt', prompt);
  await page.getByRole('button', { name: 'make a form' }).click();
  // Give the run a moment to (not) send anything.
  await page.waitForTimeout(400);

  expect(records.length).toBeGreaterThan(0); // the app did request its assets
  const origin = new URL(page.url()).origin;
  const words = prompt.split(/\s+/).filter(Boolean);
  const wholeWord = new RegExp(`\\b(${words.join('|')})\\b`, 'i');

  for (const record of records) {
    const url = record.split(' ')[0]!;
    expect(new URL(url).origin, `external request leaked: ${record}`).toBe(origin);
    expect(record.match(wholeWord), `prompt word leaked in: ${record}`).toBeNull();
  }
});