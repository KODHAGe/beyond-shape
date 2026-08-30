import { describe, expect, it } from 'vitest';
import {
  generatePrimary,
  generateDistribution,
  etaFromDrift,
  ddimTimesteps,
  buildConditioning,
  LATENT_DIM,
  COND_DIM,
  DDIM_STEPS,
  TOTAL_TIMESTEPS,
} from '../src/core/generator';
import type { Denoiser } from '../src/core/generator';

/** Deterministic fake denoiser — depends on x, t, and c (no RNG). */
const fakeDenoiser: Denoiser = {
  predictNoise(xT: Float32Array, t: number, c: Float32Array): Float32Array {
    const out = new Float32Array(LATENT_DIM);
    let csum = 0;
    for (let i = 0; i < c.length; i += 8) csum += c[i]!;
    for (let i = 0; i < LATENT_DIM; i += 1) {
      // Per-dimension q coupling (dims 384..399) so conditioning is measurable
      // WITHOUT relying on latent-explosion amplification (Slice 2 manifold clamp).
      const qD = c[384 + (i % 16)] ?? 0;
      out[i] =
        0.1 * xT[i]! +
        0.002 * (t / TOTAL_TIMESTEPS) +
        0.001 * csum +
        0.05 * Math.sin(i + 3 * xT[i]!) +
        0.05 * qD;
    }
    return out;
  },
};

function maxAbsDiff(a: Float32Array, b: Float32Array): number {
  let m = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    m = Math.max(m, Math.abs(a[i]! - b[i]!));
  }
  return m;
}

function gaussian(qValue: number): Float32Array {
  const q = new Float32Array(16);
  for (let i = 0; i < 16; i += 1) q[i] = qValue;
  return q;
}

function embedding(seedValue: number): Float32Array {
  const e = new Float32Array(384);
  for (let i = 0; i < 384; i += 1) e[i] = Math.sin(i + seedValue) * 0.5;
  return e;
}

const TEXT = 'a quiet morning in the garden';

describe('generator DDIM (spec §3.3)', () => {
  it('builds conditioning c = concat(e, q, richness) with the bound dims (FR-3)', () => {
    const c = buildConditioning(embedding(1), gaussian(0.4));
    expect(c.length).toBe(COND_DIM);
    expect(Array.from(c.slice(384, 400))).toEqual(Array.from(gaussian(0.4)));
    expect(c[400]).toBe(0); // length-blind default
  });

  it('places structure richness at c[400] (Phase C, Slice 2)', () => {
    const c = buildConditioning(embedding(1), gaussian(0.4), 0.7);
    expect(c.length).toBe(COND_DIM);
    expect(c[400]).toBeCloseTo(0.7, 6);
  });

  it('produces a 64-d latent from the canonical d=0 start (FR-8)', async () => {
    const z = await generatePrimary({
      text: TEXT,
      e: embedding(1),
      q: gaussian(0.5),
      drift: 0,
      seed: 1,
      denoiser: fakeDenoiser,
    });
    expect(z.length).toBe(LATENT_DIM);
  });

  it('returns the identical z for identical params (FR-10: ≤ 1e-6)', async () => {
    const p = { text: TEXT, e: embedding(2), q: gaussian(0.4), drift: 0.4, seed: 42, denoiser: fakeDenoiser };
    const z1 = await generatePrimary(p);
    const z2 = await generatePrimary(p);
    expect(maxAbsDiff(z1, z2)).toBeLessThanOrEqual(1e-6);
  });

  it('d=0 is seed-independent: seeds 1 and 99 produce identical z (AMEND-1, FR-8)', async () => {
    const mk = (seedValue: number) =>
      generatePrimary({ text: TEXT, e: embedding(3), q: gaussian(0.5), drift: 0, seed: seedValue, denoiser: fakeDenoiser });
    const z1 = await mk(1);
    const z99 = await mk(99);
    expect(maxAbsDiff(z1, z99)).toBe(0);
  });

  it('d=1 and d=0.4 are seed-respecting: seeds 1 vs 2 differ (FR-8)', async () => {
    for (const drift of [1.0, 0.4]) {
      const mk = (seedValue: number) =>
        generatePrimary({ text: TEXT, e: embedding(4), q: gaussian(0.5), drift, seed: seedValue, denoiser: fakeDenoiser });
      const z1 = await mk(1);
      const z2 = await mk(2);
      expect(maxAbsDiff(z1, z2)).toBeGreaterThan(1e-4);
    }
  });

  it('maps drift linearly to η (FR-8)', () => {
    expect(etaFromDrift(0)).toBe(0);
    expect(etaFromDrift(1)).toBe(1);
    expect(etaFromDrift(0.4)).toBeCloseTo(0.4);
    expect(etaFromDrift(-1)).toBe(0);
    expect(etaFromDrift(3)).toBe(1);
  });

  it('uses exactly 25 DDIM steps on the 1000-step schedule', () => {
    const ts = ddimTimesteps(DDIM_STEPS, TOTAL_TIMESTEPS);
    expect(ts.length).toBe(25);
    expect(ts[0]).toBe(999);
    expect(ts[ts.length - 1]).toBe(0);
    for (let i = 1; i < ts.length; i += 1) expect(ts[i]!).toBeLessThan(ts[i - 1]!);
  });

  it('generation is measurably conditioned on the sensory vector (FR-3b wiring)', async () => {
    const mk = (q: Float32Array) =>
      generatePrimary({ text: TEXT, e: embedding(5), q, drift: 0.5, seed: 1, denoiser: fakeDenoiser });
    const zMin = await mk(gaussian(0));
    const zMax = await mk(gaussian(1));
    expect(maxAbsDiff(zMin, zMax)).toBeGreaterThanOrEqual(1e-3);
  });

  it('reproduces the identical FR-9 distribution across re-runs', async () => {
    const p = { text: TEXT, e: embedding(6), q: gaussian(0.5), drift: 0.4, seed: 42, denoiser: fakeDenoiser };
    const d1 = await generateDistribution(p, 3);
    const d2 = await generateDistribution(p, 3);
    expect(d1.length).toBe(4);
    for (let i = 0; i < 4; i += 1) expect(maxAbsDiff(d1[i]!, d2[i]!)).toBe(0);
  });

  it('FR-9: at drift ≥ 0.4 at least two of the four latent draws differ', async () => {
    const p = { text: TEXT, e: embedding(7), q: gaussian(0.5), drift: 0.4, seed: 7, denoiser: fakeDenoiser };
    const dist = await generateDistribution(p, 3);
    let differing = 0;
    for (let i = 0; i < 4; i += 1) {
      for (let j = i + 1; j < 4; j += 1) {
        if (maxAbsDiff(dist[i]!, dist[j]!) > 1e-4) differing += 1;
      }
    }
    expect(differing).toBeGreaterThanOrEqual(1);
  });
});