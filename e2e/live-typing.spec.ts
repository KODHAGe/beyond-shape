import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const manifest = JSON.parse(readFileSync('public/models/models.json', 'utf8'));
const hasModels =
  manifest.artifacts.embedder?.file != null && manifest.artifacts.denoiser?.file != null;

test.skip(!hasModels, 'no ONNX binaries in this checkout — run scripts/train_generator.py');

test('live typing: the machine reads as you type, without the button', async ({ page }) => {
  await page.goto('/?render=canvas2d');
  // Type only — no "make a form".
  await page.locator('#bs-prompt').pressSequentially('late light on the river', { delay: 40 });

  // A reading arrives (debounced) and the judgment loop joins it (FR-16).
  await expect(page.locator('.bs-cocreation-judge')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.bs-reading-label')).toBeVisible();

  // No COMMIT happened: the fingerprint hash line is only written by "make a form".
  await expect(page.locator('.bs-status')).not.toContainText("this run's hash");

  // Changing the sentence re-reads (the reading updates live).
  await page.locator('#bs-prompt').pressSequentially('  (and the boats went out)', { delay: 40 });
  await expect(page.locator('.bs-reading-label')).toBeVisible({ timeout: 30_000 });
});
