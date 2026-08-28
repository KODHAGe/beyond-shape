import { test, expect } from '@playwright/test';

// LR-3 smoke half: on a clean checkout (no ONNX binaries), running a sentence
// surfaces the plain-reader honest-interim state — never an engineering
// directive in the visitor surface, never a crash (app.ts ModelMissingError).
test('run on a clean checkout shows the honest interim message', async ({ page }) => {
  await page.goto('/?render=canvas2d');
  await page.fill('#bs-prompt', 'the sea is calm tonight');
  await page.getByRole('button', { name: 'make a form' }).click();
  await expect(page.locator('.bs-progress-note')).toContainText('machines are still sleeping');
  // the engineering directive does NOT reach the visitor surface
  await expect(page.locator('.bs-progress-note')).not.toContainText('train_generator.py');
});