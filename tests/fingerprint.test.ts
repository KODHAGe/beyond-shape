import { describe, expect, it } from 'vitest';
import { sha256Hex, fingerprint } from '../src/lib/fingerprint';

describe('fingerprint (sha256)', () => {
  it('matches the canonical SHA-256("abc") vector', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is stable across calls for the same (text, drift, seed)', async () => {
    const a = await fingerprint('the sea is calm tonight', 0.4, 42);
    const b = await fingerprint('the sea is calm tonight', 0.4, 42);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when drift, seed, or text changes', async () => {
    const base = await fingerprint('a sentence', 0.4, 42);
    expect(await fingerprint('a sentence', 0.5, 42)).not.toBe(base);
    expect(await fingerprint('a sentence', 0.4, 43)).not.toBe(base);
    expect(await fingerprint('another sentence', 0.4, 42)).not.toBe(base);
  });
});