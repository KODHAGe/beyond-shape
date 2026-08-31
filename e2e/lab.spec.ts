import { test, expect } from '@playwright/test';

test('lab blend control: auto (decoded) default, manual override stays labelled', async ({ page }) => {
  await page.goto('/lab.html');

  // The blend segment lives in static markup — but only if WebGL2 is present
  // (otherwise the whole lab is swapped for an honest "needs WebGL2" card).
  const blendSeg = page.locator('#lab-blend');
  const missing = page.locator('.lab-missing');
  await expect(blendSeg.or(missing)).toBeVisible();

  if (await missing.isVisible()) {
    test.info().annotations.push({ type: 'skip', description: 'no WebGL2 in this run' });
    test.skip();
  }

  // auto · decoded is the default and active; the override buttons sit beside it.
  await expect(blendSeg.locator('button')).toHaveCount(3);
  await expect(blendSeg.locator('button[data-blend="auto"]')).toHaveClass(/active/);

  // Wait for the first render (seeds load → renderAll sets the readout too).
  const readout = page.locator('#lab-blend-readout');
  await expect(readout).toContainText('auto → soft · decoded', { timeout: 20_000 });

  // Manual override: hard-cut — the readout says so, plainly.
  await blendSeg.locator('button[data-blend="cut"]').click();
  await expect(blendSeg.locator('button[data-blend="cut"]')).toHaveClass(/active/);
  await expect(readout).toContainText('override → cut');

  // Back to auto — the decoding takes over again.
  await blendSeg.locator('button[data-blend="auto"]').click();
  await expect(readout).toContainText('auto → soft · decoded');
});