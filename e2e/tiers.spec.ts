import { test, expect } from '@playwright/test';

// LR-6 render-tier coverage: the selected tier is observable via
// `data-render-mode` on the viewport once the renderer is created. Actual
// drawing of each tier is covered end-to-end once real model binaries exist
// (B5); selection/coverage is exercised now.
test('canvas tier is selectable without a GPU', async ({ page }) => {
  await page.goto('/?render=canvas2d');
  await expect(page.locator('[data-render-mode]')).toHaveAttribute('data-render-mode', 'canvas2d');
});

test('primary webgl tier is selectable (reference tier) @webglref', async ({ page }) => {
  await page.goto('/?render=webgl');
  await expect(page.locator('[data-render-mode]')).toHaveAttribute('data-render-mode', 'webgl');
});

test('default selection resolves to one of the two tiers', async ({ page }) => {
  await page.goto('/');
  const attr = page.locator('[data-render-mode]');
  await expect(attr).toHaveAttribute('data-render-mode', /^(webgl|canvas2d)$/);
});