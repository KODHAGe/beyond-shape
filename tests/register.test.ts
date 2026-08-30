import { describe, expect, it } from 'vitest';
import type { SdfParams } from '../src/types';
import { REGISTERS, retune, structureRichness } from '../src/aesthetics/register';

/** A plausible decoded reading with spread weights + offsets (blend territory). */
function fixture(overrides: Partial<SdfParams> = {}): SdfParams {
  return {
    weights: [0.05, 0.5, 0.1, 0.05, 0.15, 0.05, 0.05, 0.05],
    blendRadius: 0.28,
    parts: Array.from({ length: 8 }, (_, i) => ({
      scale: [1, 1.15, 0.9] as [number, number, number],
      offset: [Math.sin(i) * 0.6, Math.cos(i * 1.7) * 0.4, (i % 3) * 0.3] as [number, number, number],
      twist: 0.4 + i * 0.1,
      displacement: 0.05 + (i % 2) * 0.08,
    })) as SdfParams['parts'],
    material: {
      hue: 0.61,
      saturation: 0.4,
      lightness: 0.72,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.2,
      emissive: 0.05,
    },
    motion: { breathe: 0.1, sway: 0.1 },
    pose: { yaw: 0.7, pitch: -0.2, roll: 0.1 },
    ...overrides,
  };
}

const expectValid = (r: SdfParams): void => {
  expect(r.weights).toHaveLength(8);
  expect(r.weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 6);
  expect(r.parts).toHaveLength(8);
  expect(r.blendRadius).toBeGreaterThanOrEqual(0.05);
  expect(r.blendRadius).toBeLessThanOrEqual(0.5);
  expect(r.material.saturation).toBeGreaterThanOrEqual(0);
  expect(r.material.saturation).toBeLessThanOrEqual(1);
  expect(r.material.lightness).toBeGreaterThanOrEqual(0);
  expect(r.material.lightness).toBeLessThanOrEqual(1);
  expect(r.material.roughness).toBeGreaterThanOrEqual(0);
  expect(r.material.roughness).toBeLessThanOrEqual(1);
  expect(r.material.emissive).toBeGreaterThanOrEqual(0);
  expect(r.material.emissive).toBeLessThanOrEqual(1);
  for (const p of r.parts) {
    for (const v of p.offset) {
      expect(v).toBeGreaterThanOrEqual(-1.5);
      expect(v).toBeLessThanOrEqual(1.5);
    }
    expect(Math.abs(p.twist)).toBeLessThanOrEqual(Math.PI);
  }
};

describe('retune — validity & determinism', () => {
  it('always returns a valid SdfParams shape', () => {
    for (const kind of ['clay', 'collision'] as const) {
      for (const drift of [0, 0.5, 1]) {
        expectValid(retune(fixture(), kind, drift));
      }
    }
  });

  it('is deterministic (same input → same output)', () => {
    const a = retune(fixture(), 'collision', 0.6);
    const b = retune(fixture(), 'collision', 0.6);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('clamps drift outside [0,1]', () => {
    expect(retune(fixture(), 'clay', -1).blendRadius).toBe(retune(fixture(), 'clay', 0).blendRadius);
    expect(retune(fixture(), 'clay', 2).blendRadius).toBe(retune(fixture(), 'clay', 1).blendRadius);
  });
});

describe('the spindle (drift behaviour)', () => {
  it('sharpens the dominant primitive at the consensus end', () => {
    const centre = retune(fixture(), 'collision', 0);
    const domIdx = fixture().weights.indexOf(Math.max(...fixture().weights));
    const centreDom = Math.max(...centre.weights);
    expect(centreDom).toBeGreaterThan(fixture().weights[domIdx] ?? 0);
  });

  it('relaxes the weights back toward decoded at the edge', () => {
    const edge = retune(fixture(), 'collision', 1);
    const centre = retune(fixture(), 'collision', 0);
    expect(Math.max(...edge.weights)).toBeLessThan(Math.max(...centre.weights));
  });

  it('clay welds (blend radius grows) as drift rises; collision seams (shrinks)', () => {
    const clay0 = retune(fixture(), 'clay', 0);
    const clay1 = retune(fixture(), 'clay', 1);
    expect(clay1.blendRadius).toBeGreaterThan(clay0.blendRadius);
    const col0 = retune(fixture(), 'collision', 0);
    const col1 = retune(fixture(), 'collision', 1);
    expect(col1.blendRadius).toBeLessThan(col0.blendRadius);
  });

  it('registers coincide at the centre and diverge at the edge', () => {
    const c0 = retune(fixture(), 'clay', 0);
    const col0 = retune(fixture(), 'collision', 0);
    expect(c0.material.roughness).toBe(col0.material.roughness);
    expect(c0.material.clearcoat).toBe(col0.material.clearcoat);
    expect(c0.material.saturation).toBeCloseTo(col0.material.saturation, 9);

    const c1 = retune(fixture(), 'clay', 1);
    const col1 = retune(fixture(), 'collision', 1);
    expect(c1.material.roughness).toBeGreaterThan(col1.material.roughness);
    expect(c1.material.clearcoat).toBeLessThan(col1.material.clearcoat);
    expect(c1.material.emissive).toBeLessThan(col1.material.emissive);
  });

  it('collision separates — non-dominant parts orbit away from the dominant at the edge', () => {
    const form = fixture();
    const dom = form.weights.indexOf(Math.max(...form.weights));
    const domOffset = form.parts[dom]!.offset;

    // The dominant holds the centre exactly (its decoded position).
    const edge = retune(form, 'collision', 1);
    expect(edge.parts[dom]!.offset).toEqual(domOffset);

    // The weakest part ends up clearly farther from the dominant than decoded.
    const weak = form.weights.reduce(
      (acc, w, i) => (w < acc.w ? { i, w } : acc),
      { i: 0, w: Infinity },
    ).i;
    if (weak === dom) return; // edge case: nothing to compare
    const dist = (s: SdfParams, i: number): number =>
      Math.hypot(
        (s.parts[i]!.offset[0] ?? 0) - (s.parts[dom]!.offset[0] ?? 0),
        (s.parts[i]!.offset[1] ?? 0) - (s.parts[dom]!.offset[1] ?? 0),
        (s.parts[i]!.offset[2] ?? 0) - (s.parts[dom]!.offset[2] ?? 0),
      );
    expect(dist(edge, weak) - dist(form, weak)).toBeGreaterThan(0.3);
  });

  it('clay keeps its composition tighter than collision at the same drift', () => {
    const form = fixture();
    const dom = form.weights.indexOf(Math.max(...form.weights));
    const spread = (s: SdfParams): number =>
      s.parts.reduce(
        (sum, p) =>
          sum +
          Math.hypot(
            (p.offset[0] ?? 0) - (s.parts[dom]!.offset[0] ?? 0),
            (p.offset[1] ?? 0) - (s.parts[dom]!.offset[1] ?? 0),
            (p.offset[2] ?? 0) - (s.parts[dom]!.offset[2] ?? 0),
          ),
        0,
      );
    const claySpread = spread(retune(form, 'clay', 1));
    const colSpread = spread(retune(form, 'collision', 1));
    expect(colSpread).toBeGreaterThan(claySpread * 2);
  });

  it('defines exactly the two registers the lab offers', () => {
    expect(Object.keys(REGISTERS).sort()).toEqual(['clay', 'collision']);
    for (const r of Object.values(REGISTERS)) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.blurb.length).toBeGreaterThan(0);
    }
  });
});

describe('richness follows structure', () => {
  it('maps token count to a clamped 0..1 richness', () => {
    expect(structureRichness(3)).toBe(0);
    expect(structureRichness(25)).toBe(1);
    expect(structureRichness(100)).toBe(1);
    const mid = structureRichness(14);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('raises silent voices on rich structures (part count grows)', () => {
    // One loud voice + a long tail — the long-sentence collapse case.
    const collapsed = fixture({ weights: [0.9, 0.04, 0.03, 0.01, 0.01, 0.005, 0.003, 0.002] });
    const plain = retune(collapsed, 'collision', 1, 0);
    const rich = retune(collapsed, 'collision', 1, 1);
    const active = (s: SdfParams): number =>
      s.weights.reduce((n, w) => (w > 0.08 ? n + 1 : n), 0);
    expect(active(rich)).toBeGreaterThan(active(plain));
    // The dominant still leads (monotonic transform preserves order) and
    // keeps a real presence — richness adds voices, it does not steal the floor.
    const dom = collapsed.weights.indexOf(Math.max(...collapsed.weights));
    expect(rich.weights[dom]).toBe(Math.max(...rich.weights));
    expect(Math.max(...rich.weights)).toBeGreaterThan(0.3);
  });

  it('spreads parts further apart as richness rises', () => {
    const form = fixture();
    const dom = form.weights.indexOf(Math.max(...form.weights));
    const spread = (s: SdfParams): number =>
      s.parts.reduce(
        (sum, p) =>
          sum +
          Math.hypot(
            (p.offset[0] ?? 0) - (s.parts[dom]!.offset[0] ?? 0),
            (p.offset[1] ?? 0) - (s.parts[dom]!.offset[1] ?? 0),
            (p.offset[2] ?? 0) - (s.parts[dom]!.offset[2] ?? 0),
          ),
        0,
      );
    expect(spread(retune(form, 'collision', 0.7, 1))).toBeGreaterThan(
      spread(retune(form, 'collision', 0.7, 0)),
    );
  });

  it('is length-blind by default (richness 0 preserves prior behaviour)', () => {
    const a = retune(fixture(), 'collision', 1);
    const b = retune(fixture(), 'collision', 1, 0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});