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

  // The marginalia computes the machine's reading against the real corpus (C2).
  await expect(page.locator('.bs-marginalia-crowd')).toContainText('closest to', { timeout: 30_000 });

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

  // The canvas is SIZED to its container (no more 640 CSS-stretch blur):
  // backing pixels ≈ CSS pixels of the viewport.
  const sizes = await page.locator('.bs-viewport').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const canvas = el.querySelector('canvas.bs-canvas2d') as HTMLCanvasElement | null;
    return { viewW: Math.round(r.width), canvasW: canvas?.width ?? 0 };
  });
  expect(sizes.canvasW).toBeGreaterThanOrEqual(sizes.viewW - 4);
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

test('webgl tier completes a run and builds three albedo cells @webglref', async ({ page }) => {
  await page.goto('/?render=webgl');
  await page.fill('#bs-prompt', 'cold rain on tin roofs');
  await page.getByRole('button', { name: 'make a form' }).click();
  await expect(page.locator('.bs-status')).toContainText("this run's hash", { timeout: 60_000 });

  // The WebGL path must not blow the stack (OrbitControls re-entrancy guard)
  // and must land three live three.js cells.
  const cells = page.locator('.bs-alternate-cell');
  await expect(cells).toHaveCount(3);
  await expect.poll(() => cells.nth(0).locator('canvas').count()).toBe(1);
});

test('alternates cells render painted forms in the canvas tier (FR-9, round-trip)', async ({ page }) => {
  await page.goto('/?render=canvas2d');
  await page.fill('#bs-prompt', 'a house with colored windows');
  await page.getByRole('button', { name: 'make a form' }).click();
  await expect(page.locator('.bs-status')).toContainText("this run's hash", { timeout: 60_000 });

  // The strip must hold three REAL painted cells — no more blank white boxes.
  const cells = page.locator('.bs-alternate-cell');
  await expect(cells).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    await expect
      .poll(async () => {
        const painted = await cells.nth(i).locator('canvas').evaluate((c) => {
          const canvas = c as HTMLCanvasElement;
          const ctx = canvas.getContext('2d');
          if (!ctx || canvas.width === 0) return false;
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const seen = new Set<number>();
          for (let p = 0; p < data.length; p += 7 * 4) {
            seen.add((data[p] ?? 0) + (data[p + 1] ?? 0) * 3 + (data[p + 2] ?? 0) * 7);
            if (seen.size >= 3) return true; // > 2 distinct colours = real shading, not a void
          }
          return seen.size >= 2;
        });
        return painted;
      })
      .toBe(true);
  }

  // Clicking an alternate switches the active form to that alternate reading (seed 43)
  await cells.nth(0).click();
  await expect(page.locator('#bs-seed')).toHaveValue('43');
  await expect(page.locator('.bs-status')).toContainText('reading seed 43');
});