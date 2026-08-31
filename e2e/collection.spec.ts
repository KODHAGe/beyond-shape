import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// Phase D Slice 1 (DR-2): the collection loop is LOCAL until the visitor opts
// in and explicitly shares. Skipped on clean checkouts without binaries.
const manifest = JSON.parse(readFileSync('public/models/models.json', 'utf8'));
const hasModels =
  manifest.artifacts.embedder?.file != null && manifest.artifacts.denoiser?.file != null;

test.skip(!hasModels, 'no ONNX binaries in this checkout — run scripts/train_generator.py');

test('collection: the loop stays local until an explicit opt-in + share (DR-2)', async ({ page }) => {
  let posts = 0;
  let postBody: string | null = null;
  await page.route('**/api/contribute', async (route) => {
    posts += 1;
    postBody = route.request().postData();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, id: 'x' }),
    });
  });

  await page.goto('/?render=canvas2d');
  await page.fill('#bs-prompt', 'cold rain on tin roofs');
  await page.getByRole('button', { name: 'make a form' }).click();
  await expect(page.locator('.bs-status')).toContainText("this run's hash", { timeout: 60_000 });

  // The co-creation loop joins the reading that just arrived (FR-16).
  await expect(page.locator('.bs-cocreation-judge')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'keep this form' })).toBeVisible();
  // Nothing is transmitted just by running (C8/FR-5: local-first).
  expect(posts).toBe(0);

  // Judging (keep) reveals the consent area — still nothing out the door.
  await page.getByRole('button', { name: 'keep this form' }).click();
  await expect(page.locator('.bs-cocreation-consent')).toBeVisible();
  expect(posts).toBe(0);

  // The share is gated: without the opt-in it is disabled (DR-2).
  await expect(page.locator('button:has-text("share to the crowd")')).toBeDisabled();

  // Explicit opt-in + share fires exactly ONE POST carrying consent + the text.
  await page.check('.bs-cocreation-consent input[type="checkbox"]');
  await page.getByRole('button', { name: 'share to the crowd' }).click();
  await expect(page.locator('.bs-cocreation-result')).toContainText('in the crowd now', { timeout: 15_000 });
  expect(posts).toBe(1);

  const body = JSON.parse(postBody ?? '{}');
  expect(body.consent_flag).toBe(1);
  expect(body.input_text).toBe('cold rain on tin roofs');
  expect(body.gradient).toBe('accept');
  expect(body.register).toBe('collision');
  expect(body.text_sha256).toMatch(/^[0-9a-f]{64}$/);
});
