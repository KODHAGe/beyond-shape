import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// B5: with real ONNX binaries present, a run produces a real form and the
// fingerprint is deterministic across reloads (FR-10). Skipped on clean
// checkouts that haven't run scripts/train_generator.py (LR-3 scaffold state
// is covered by missing-model.spec.ts).
const manifest = JSON.parse(readFileSync('public/models/models.json', 'utf8'));
const hasModels =
  manifest.artifacts.embedder?.file != null && manifest.artifacts.denoiser?.file != null;

test.skip(!hasModels, 'no ONNX binaries in this checkout — run scripts/train_generator.py');

test('type a sentence → a real form arrives', async ({ page }) => {
  await page.goto('/?render=canvas2d');
  await page.fill('#bs-prompt', 'the sea is calm tonight');
  await page.getByRole('button', { name: 'make a form' }).click();

  // The wire state arrived: hash line present.
  await expect(page.locator('.bs-status')).toContainText("this run's hash", { timeout: 60_000 });

  // The canvas-2D fallback actually painted non-blank pixels.
  await expect
    .poll(async () => {
      const painted = await page.locator('canvas.bs-canvas2d').evaluate((c) => {
        const canvas = c as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx || canvas.width === 0) return false;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let nonBg = 0;
        for (let i = 3; i < data.length; i += 97 * 4) {
          if (data[i]! !== 0) nonBg += 1;
        }
        return nonBg > 0;
      });
      return painted;
    })
    .toBe(true);
});

test('same sentence, same knob, same seed → same form (FR-10, in browser)', async ({ page }) => {
  await page.goto('/?render=canvas2d');
  await page.fill('#bs-prompt', 'cold rain on tin roofs');
  await page.getByRole('button', { name: 'make a form' }).click();
  await expect(page.locator('.bs-status')).toContainText("this run's hash", { timeout: 60_000 });
  const first = await page.locator('.bs-status').textContent();

  await page.getByRole('button', { name: 'make a form' }).click();
  await expect(page.locator('.bs-status')).toContainText("this run's hash", { timeout: 60_000 });
  const second = await page.locator('.bs-status').textContent();
  expect(second).toBe(first);
});