/**
 * Bootstrap (spec §3.1): single entry → mountApp. Load order per QR-1:
 * app shell → low-fi placeholder → renderer → embedder → generator; the warm
 * surface is visible while models wake, and typing is never blocked by warm-up.
 */

import './style.css';
import { mountApp } from './ui/app';

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app mount missing');
  await mountApp(root);
}

void boot().catch((err: Error) => {
  // Shell-level failure — keep it visible and friendly.
  const root = document.getElementById('app');
  if (root) {
    root.textContent = `couldn't start: ${err.message}`;
  }
  console.error(err);
});