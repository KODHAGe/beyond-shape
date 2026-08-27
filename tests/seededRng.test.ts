import { describe, expect, it } from 'vitest';
import { SeededRng, createSeededRng, deriveSeedBytes } from '../src/core/seededRng';

describe('seededRng (xoshiro256**)', () => {
  it('is deterministic across two independently-seeded instances', async () => {
    const material = 'a quiet morning|0.4|42';
    const a = await createSeededRng(material);
    const b = await createSeededRng(material);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 64; i += 1) {
      seqA.push(a.nextFloat());
      seqB.push(b.nextFloat());
    }
    expect(seqA).toEqual(seqB);
  });

  it('derives different streams from different seed materials', async () => {
    const a = await createSeededRng('one|0.4|1');
    const b = await createSeededRng('two|0.4|1');
    expect(a.nextFloat()).not.toEqual(b.nextFloat());
  });

  it('produces floats in [0,1) and ints in [0,bound)', () => {
    // Fixed 32 bytes → fully synchronous, no crypto needed.
    const bytes = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);
    const rng = new SeededRng(bytes);
    for (let i = 0; i < 500; i += 1) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.nextInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('handles a degenerate all-zero seed bytes without dead-locking', () => {
    const rng = new SeededRng(new Uint8Array(32));
    const first = rng.nextFloat();
    expect(first).toBeGreaterThan(0);
    // Still deterministic:
    const again = new SeededRng(new Uint8Array(32));
    expect(again.nextFloat()).toEqual(first);
  });

  it('derives 32 seed bytes from a material string (SHA-256)', async () => {
    const bytes = await deriveSeedBytes('x');
    expect(bytes.length).toBe(32);
  });
});