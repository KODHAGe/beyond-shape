/**
 * In-memory RunRecord list + sessionStorage mirror (spec §5 / CR-6).
 * Key: `bs:lastRun`. Read/write/clear only — the mirror supports the reload
 * determinism checks (FR-10/QR-6) and never transmits anywhere.
 */

import type { RunRecord } from '../types';

export const STORAGE_KEY = 'bs:lastRun';

/** Minimal storage interface so tests can inject a fake sessionStorage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    // Guarded: sessionStorage exists in browsers/tests but not in Node.
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // Access can throw in privacy-restricted browsers.
  }
  return null;
}

export class RunStore {
  private readonly runs: RunRecord[] = [];
  private readonly storage: StorageLike | null;

  constructor(storage?: StorageLike | null) {
    this.storage = storage === undefined ? defaultStorage() : storage;
  }

  get all(): readonly RunRecord[] {
    return this.runs;
  }

  get lastRun(): RunRecord | null {
    return this.runs.length > 0 ? this.runs[this.runs.length - 1]! : null;
  }

  add(run: RunRecord): void {
    this.runs.push(run);
    this.mirror();
  }

  clear(): void {
    this.runs.length = 0;
    if (this.storage) this.storage.removeItem(STORAGE_KEY);
  }

  /** Load the mirrored last run, if any (used on reload to re-show the form). */
  loadMirrored(): RunRecord | null {
    if (!this.storage) return null;
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RunRecord;
    } catch {
      return null;
    }
  }

  private mirror(): void {
    if (!this.storage) return;
    const latest = this.lastRun;
    if (!latest) {
      this.storage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(latest));
    } catch {
      // Quota / privacy mode — mirroring is best-effort, never fatal.
    }
  }
}