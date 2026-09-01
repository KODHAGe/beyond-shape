import { test, expect } from '@playwright/test';

// One smoke spec only (slice scope). Asserts the SPA shell loads and renders
// the UI heading at the vite preview server.
test('index loads and shows the UI heading', async ({ page }) => {
  await page.goto('/');
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toContainText('beyond shape');
  // Shell is interactive enough to show the run controls.
  await expect(page.locator('#bs-prompt')).toBeVisible();
  await expect(page.getByLabel('how close to the crowd\u2019s way of reading?')).toBeVisible();
});