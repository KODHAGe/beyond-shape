import { describe, expect, it } from 'vitest';
import {
  decodeRawToSdfParams,
  decodeBlendMode,
  interpolateSdfParams,
  BLEND_HARDNESS_THRESHOLD,
  BLEND_RADIUS_RANGE,
  PRIMITIVE_COUNT,
  type DecoderRaw,
} from '../src/core/sdfParams';
import { easeOutCubic, lerpHue, softmax } from '../src/lib/math';

function raw(overrides: Partial<DecoderRaw> = {}): DecoderRaw {
  return {
    weights: [0, 0, 0, 0, 0, 0, 0, 0],
    blendRadius: 0.2,
    parts: Array.from({ length: 64 }, (_, i) => (i % 8 === 0 ? 1 : 0)),
    material: [0.1, 0.4, 0.7, 0.5, 0, 0.3, 0.05],
    motion: [0, 0],
    pose: [0, 0, 0],
    ...overrides,
  };
}

describe('sdfParams decode + clamp (spec §4)', () => {
  it('softmaxes the 8 weights to sum 1 with all entries ≥ 0', () => {
    const p = decodeRawToSdfParams(raw({ weights: [3, 1, 0, 0, 0, 0, 0, -5] }));
    expect(p.weights.length).toBe(PRIMITIVE_COUNT);
    const sum = p.weights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    const s = softmax([3, 1, 0, 0, 0, 0, 0, -5]);
    // Stable softmax (temperature 1) — assert meaningful invariants, not a
    // hand-picked peak: dominant input → dominant output, monotone, no NaNs.
    for (const v of s) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(s[0]).toBeGreaterThan(0.5); // peak dominates
    expect(s[0]).toBeGreaterThan(s[1]); // argmax preserved
    expect(s[1]).toBeGreaterThan(s[7]); // ordering preserved
  });

  it('clamps blendRadius into [0.05, 0.5]', () => {
    expect(decodeRawToSdfParams(raw({ blendRadius: 2 })).blendRadius).toBe(BLEND_RADIUS_RANGE[1]);
    expect(decodeRawToSdfParams(raw({ blendRadius: -1 })).blendRadius).toBe(BLEND_RADIUS_RANGE[0]);
    expect(decodeRawToSdfParams(raw({ blendRadius: 0.25 })).blendRadius).toBe(0.25);
  });

  it('biases material sat/light toward pastel bands without clamping them out of [0,1]', () => {
    const p = decodeRawToSdfParams(raw({ material: [0.1, 2.0, -5.0, 0.5, 0, 0.3, 5] }));
    expect(p.material.saturation).toBeGreaterThan(0.1);
    expect(p.material.saturation).toBeLessThanOrEqual(1);
    expect(p.material.lightness).toBeGreaterThanOrEqual(0);
    expect(p.material.lightness).toBeLessThan(0.95);
    expect(p.material.emissive).toBe(1); // hard validity clamp
    expect(p.material.roughness).toBe(0.5);
  });

  it('clamps motion to [0,1] and wraps pose angles', () => {
    const p = decodeRawToSdfParams(raw({ motion: [5, -3], pose: [3 * Math.PI, Math.PI, -Math.PI] }));
    expect(p.motion.breathe).toBe(1);
    expect(p.motion.sway).toBe(0);
    expect(p.pose.yaw).toBeGreaterThanOrEqual(0);
    expect(p.pose.yaw).toBeLessThan(2 * Math.PI);
    expect(p.pose.pitch).toBeCloseTo(Math.PI / 2);
    expect(p.pose.roll).toBeGreaterThanOrEqual(0);
  });

  it('clamps per-part fields into valid ranges', () => {
    const parts = new Array(64).fill(0).map((_, i) => {
      const rem = i % 8;
      if (rem === 0) return 10; // scale x → clamp to 3
      if (rem === 4) return 9; // offset y → clamp to 1.5
      if (rem === 6) return 50; // twist → clamp to π
      if (rem === 7) return 9; // displacement → clamp 0.5
      return 0;
    });
    const p = decodeRawToSdfParams(raw({ parts }));
    expect(p.parts[0]!.scale[0]).toBe(3);
    expect(p.parts[0]!.offset[1]).toBe(1.5);
    expect(p.parts[0]!.twist).toBeCloseTo(Math.PI);
    expect(p.parts[0]!.displacement).toBe(0.5);
  });

  it('rejects a wrong weight count', () => {
    expect(() => decodeRawToSdfParams(raw({ weights: [0, 0, 0] }))).toThrow(RangeError);
  });
});

describe('blendMode decode (item-1 hardness head, 0.2.1)', () => {
  it('defaults a legacy (no hardness) decode to soft', () => {
    expect(decodeRawToSdfParams(raw()).blendMode).toBe('soft');
    expect(decodeBlendMode(undefined)).toBe('soft');
  });

  it('maps hardness ≥ 0.5 → cut, below → soft (arbitrary per-anchor convention)', () => {
    expect(decodeBlendMode(BLEND_HARDNESS_THRESHOLD)).toBe('cut');
    expect(decodeBlendMode(0.9)).toBe('cut');
    expect(decodeBlendMode(1)).toBe('cut');
    expect(decodeBlendMode(0.49)).toBe('soft');
    expect(decodeBlendMode(0)).toBe('soft');
    expect(decodeBlendMode(-1)).toBe('soft');
  });

  it('decodes the hardness output into SdfParams.blendMode', () => {
    expect(decodeRawToSdfParams(raw({ hardness: 1 })).blendMode).toBe('cut');
    expect(decodeRawToSdfParams(raw({ hardness: 0.2 })).blendMode).toBe('soft');
  });
});

describe('interpolateSdfParams (continuous parameter morph)', () => {
  const pA = decodeRawToSdfParams(raw({
    weights: [1, 0, 0, 0, 0, 0, 0, 0],
    blendRadius: 0.1,
    material: [0.95, 0.3, 0.6, 0.4, 0, 0.1, 0],
    motion: [0.2, 0.4],
    pose: [0.1, 0.2, 0.3],
    hardness: 0.2,
  }));

  const pB = decodeRawToSdfParams(raw({
    weights: [0, 1, 0, 0, 0, 0, 0, 0],
    blendRadius: 0.4,
    material: [0.05, 0.7, 0.8, 0.8, 0.5, 0.9, 0.4],
    motion: [0.8, 0.9],
    pose: [0.5, 0.6, 0.7],
    hardness: 0.8,
  }));

  it('returns exact endpoints at t=0 and t=1', () => {
    expect(interpolateSdfParams(pA, pB, 0)).toBe(pA);
    expect(interpolateSdfParams(pA, pB, 1)).toBe(pB);
  });

  it('smoothly blends parameters at midpoint t=0.5', () => {
    const mid = interpolateSdfParams(pA, pB, 0.5);
    expect(mid.blendRadius).toBeCloseTo(0.25, 4);
    expect(mid.weights.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 4);
    expect(mid.material.roughness).toBeCloseTo(0.6, 4);
    expect(mid.material.saturation).toBeCloseTo((pA.material.saturation + pB.material.saturation) / 2, 4);
    expect(mid.motion.breathe).toBeCloseTo(0.5, 4);
    expect(mid.motion.sway).toBeCloseTo(0.65, 4);
    expect(mid.pose.yaw).toBeCloseTo(0.3, 4);
  });

  it('handles shortest-arc hue interpolation correctly around circle wrap', () => {
    // 0.95 to 0.05 wraps across 0.0 — midpoint should be 0.0 (or 1.0)
    expect(lerpHue(0.95, 0.05, 0.5)).toBeCloseTo(0.0, 4);
    const mid = interpolateSdfParams(pA, pB, 0.5);
    expect(mid.material.hue).toBeCloseTo(0.0, 4);

    // 0.1 to 0.9 wraps across 0.0 with midpoint 0.0
    expect(lerpHue(0.1, 0.9, 0.5)).toBeCloseTo(0.0, 4);
    // 0.2 to 0.4 does not wrap with midpoint 0.3
    expect(lerpHue(0.2, 0.4, 0.5)).toBeCloseTo(0.3, 4);
  });

  it('switches blendMode at t=0.5 threshold', () => {
    expect(interpolateSdfParams(pA, pB, 0.49).blendMode).toBe('soft');
    expect(interpolateSdfParams(pA, pB, 0.5).blendMode).toBe('cut');
  });

  it('evaluates cubic ease curve', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // decelerating curve is > linear at 0.5
  });
});