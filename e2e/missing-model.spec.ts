import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// LR-3 smoke half: on a CLEAN checkout (no ONNX binaries), running a sentence
// surfaces the plain-reader honest-interim state — never an engineering
// directive in the visitor surface, never a crash. Skips when real binaries
// are present (the real-run spec covers that case).
const manifest = JSON.parse(readFileSync('public/models/models.json', 'utf8'));
const hasModels = manifest.artifacts.embedder?.file != null;
test.skip(hasModels, 'ONNX binaries present — this is the clean-checkout test');

test('run on a clean checkout shows the honest interim message', async ({ page }) => {
  await page.goto('/?render=canvas2d');
  await page.fill('#bs-prompt', 'the sea is calm tonight');
  await page.getByRole('button', { name: 'make a form' }).click();
  await expect(page.locator('.bs-progress-note')).toContainText('machines are still sleeping');
  // the engineering directive does NOT reach the visitor surface
  await expect(page.locator('.bs-progress-note')).not.toContainText('train_generator.py');
});