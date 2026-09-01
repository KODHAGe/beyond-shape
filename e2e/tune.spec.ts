import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const manifest = JSON.parse(readFileSync('public/models/models.json', 'utf8'));
const hasModels =
  manifest.artifacts.embedder?.file != null && manifest.artifacts.denoiser?.file != null;

test.skip(!hasModels, 'no ONNX binaries in this checkout — run scripts/train_generator.py');

test('make it yours: the visitor shapes the reading, the hand is named (FR-16)', async ({ page }) => {
  await page.goto('/?render=canvas2d');
  await page.fill('#bs-prompt', 'cold rain on tin roofs');
  await page.getByRole('button', { name: 'make a form' }).click();
  await page.waitForSelector('.bs-tune', { timeout: 40_000 });

  // neutral = the machine's read
  await expect(page.locator('.bs-tune-summary')).toContainText('unchanged');

  // move the hand: more one thing + parts apart + leaning
  const sliders = page.locator('.bs-tune input[type=range]');
  await sliders.nth(0).fill('0.12');
  await sliders.nth(1).fill('0.9');
  await sliders.nth(2).fill('0.4');

  await expect(page.locator('.bs-tune-summary')).toContainText('more one thing');
  await expect(page.locator('.bs-tune-summary')).toContainText('parts apart');
  await expect(page.locator('.bs-tune-summary')).toContainText('leaning');

  // the machine's read is never destroyed — reset returns to neutral
  await page.locator('.bs-tune-reset').click();
  await expect(page.locator('.bs-tune-summary')).toContainText('unchanged');
});
