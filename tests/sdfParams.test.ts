import { describe, expect, it } from 'vitest';
import {
  decodeRawToSdfParams,
  BLEND_RADIUS_RANGE,
  PRIMITIVE_COUNT,
  type DecoderRaw,
} from '../src/core/sdfParams';
import { softmax } from '../src/lib/math';

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