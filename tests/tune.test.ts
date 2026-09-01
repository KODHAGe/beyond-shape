import { describe, expect, it } from 'vitest';
import type { SdfParams } from '../src/types';
import { DEFAULT_TUNE, dominantIndex, tuneSdf, tuneSummary } from '../src/aesthetics/tune';

function fixture(overrides: Partial<SdfParams> = {}): SdfParams {
  return {
    weights: [0.05, 0.5, 0.1, 0.05, 0.15, 0.05, 0.05, 0.05],
    blendRadius: 0.28,
    parts: Array.from({ length: 8 }, (_, i) => ({
      scale: [1, 1.1, 0.9] as [number, number, number],
      offset: [Math.sin(i) * 0.5, Math.cos(i * 1.7) * 0.3, (i % 3) * 0.2] as [number, number, number],
      twist: 0.4 + i * 0.1,
      displacement: 0.05 + (i % 2) * 0.08,
    })) as SdfParams['parts'],
    material: { hue: 0.61, saturation: 0.4, lightness: 0.72, roughness: 0.5, metalness: 0, clearcoat: 0.2, emissive: 0.05 },
    motion: { breathe: 0.1, sway: 0.1 },
    pose: { yaw: 0.7, pitch: -0.2, roll: 0.1 },
    ...overrides,
  };
}

describe('tune (make it yours) — FR-16', () => {
  it('is the identity at the default (neutral = the machine\u2019s read)', () => {
    const base = fixture();
    const t = tuneSdf(base, DEFAULT_TUNE);
    expect(t.weights).toEqual(base.weights);
    expect(t.parts).toEqual(base.parts);
    expect(t.pose).toEqual(base.pose);
  });

  it('keeps weights a valid distribution (sum 1) whatever the voices setting', () => {
    const base = fixture();
    for (const voices of [0, 0.5, 1]) {
      const t = tuneSdf(base, { ...DEFAULT_TUNE, voices });
      const sum = t.weights.reduce((s, w) => s + w, 0);
      expect(sum).toBeCloseTo(1, 6);
      expect(t.weights.every((w) => w >= 0 && Number.isFinite(w))).toBe(true);
    }
  });

  it('voices 0 sharpens to one clear voice; voices 1 flattens toward the spread', () => {
    const base = fixture();
    const dom = dominantIndex(base.weights);
    const oneVoice = tuneSdf(base, { ...DEFAULT_TUNE, voices: 0 });
    const spread = tuneSdf(base, { ...DEFAULT_TUNE, voices: 1 });
    expect(oneVoice.weights[dom]).toBeGreaterThan(base.weights[dom] ?? 0);
    expect(spread.weights[dom]).toBeLessThan(base.weights[dom] ?? 0);
  });

  it('separation pulls non-dominant parts together (0) or apart (1), dominant holds', () => {
    const base = fixture();
    const dom = dominantIndex(base.weights);
    const domOff = base.parts[dom]!.offset;
    const together = tuneSdf(base, { ...DEFAULT_TUNE, separation: 0 });
    const apart = tuneSdf(base, { ...DEFAULT_TUNE, separation: 1 });
    const distToDom = (s: SdfParams, i: number): number =>
      Math.hypot(
        (s.parts[i]!.offset[0] ?? 0) - (domOff[0] ?? 0),
        (s.parts[i]!.offset[1] ?? 0) - (domOff[1] ?? 0),
        (s.parts[i]!.offset[2] ?? 0) - (domOff[2] ?? 0),
      );
    // The dominant part is unchanged.
    expect(together.parts[dom]!.offset).toEqual(domOff);
    expect(apart.parts[dom]!.offset).toEqual(domOff);
    // A non-dominant part ends up farther apart when separation=1 than when 0.
    const weak = base.weights.reduce((acc, w, i) => (w < acc.w ? { i, w } : acc), { i: 0, w: Infinity }).i;
    expect(distToDom(apart, weak)).toBeGreaterThan(distToDom(together, weak));
  });

  it('lean tilts the pose and is clamped', () => {
    const base = fixture();
    const t = tuneSdf(base, { ...DEFAULT_TUNE, lean: 1 });
    expect(t.pose.pitch).toBeGreaterThan(base.pose.pitch ?? 0);
    expect(Math.abs(t.pose.roll)).toBeLessThanOrEqual(2 * Math.PI);
    const clamped = tuneSdf(base, { ...DEFAULT_TUNE, lean: 5 });
    expect(Math.abs(clamped.pose.pitch)).toBeLessThanOrEqual(1.2);
  });

  it('summarises the human\u2019s hand', () => {
    expect(tuneSummary(DEFAULT_TUNE)).toBe('unchanged');
    expect(tuneSummary({ voices: 0.4, separation: 0.8, lean: 0.2 })).toBe('more one thing · parts apart · leaning');
  });
});
