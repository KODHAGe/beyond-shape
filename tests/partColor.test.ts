import { describe, expect, it } from 'vitest';
import type { SdfParams } from '../src/types';
import { evaluateParts, ACTIVE_PART_THRESHOLD } from '../src/core/sdfField';
import { hslToRgb01, mergePartRgb, partRgb } from '../src/aesthetics/partColor';

/** Two overlapping spheres (parts 0 & 1) — the cut/morph fork in miniature. */
function duo(weights: [number, number, number, number, number, number, number, number] = [0.5, 0.5, 0, 0, 0, 0, 0, 0]): SdfParams {
  const part = (ox: number): { scale: [number, number, number]; offset: [number, number, number]; twist: number; displacement: number } => ({
    scale: [1, 1, 1],
    offset: [ox, 0, 0],
    twist: 0,
    displacement: 0,
  });
  return {
    weights,
    blendRadius: 0.3,
    parts: [part(0), part(1.2), part(0), part(0), part(0), part(0), part(0), part(0)] as SdfParams['parts'],
    material: { hue: 0.5, saturation: 0.4, lightness: 0.72, roughness: 0.5, metalness: 0, clearcoat: 0, emissive: 0 },
    motion: { breathe: 0, sway: 0 },
    pose: { yaw: 0, pitch: 0, roll: 0 },
  };
}

describe('evaluateParts — per-part influence (soft & cut)', () => {
  it('soft: influence sums to 1 and the nearest part dominates', () => {
    const sdf = duo();
    const { d, influence } = evaluateParts(sdf, [1.1, 0, 0]);
    expect(d).toBeLessThan(0); // inside the two-webbed surface
    let sum = 0;
    for (let i = 0; i < influence.length; i += 1) sum += influence[i] ?? 0;
    expect(sum).toBeCloseTo(1, 5);
    expect(influence[1]).toBeGreaterThan(influence[0]); // nearer to part 1
    expect(influence[0]).toBeGreaterThan(influence[2] ?? 0); // silent parts contribute ~0
  });

  it('cut: the surface point belongs to exactly ONE part (one-hot ownership)', () => {
    const sdf = duo();
    const { d, influence } = evaluateParts(sdf, [1.1, 0, 0], 'cut');
    expect(d).toBeLessThan(0);
    const owner = influence.findIndex((v) => v > 0.99);
    expect(owner).toBe(1); // part 1 owns the point near its surface
    expect(influence.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
  });

  it('cut union equals the min over ACTIVE parts; silent parts are absent', () => {
    const sdf = duo([0.9, 0, 0, 0, 0, 0, 0, 0.1]); // part 1 is silent (below threshold)
    const { d } = evaluateParts(sdf, [1.2, 0, 0], 'cut');
    // Only part 0 (radius 1 at origin) is active; the point is outside it.
    const only0 = Math.hypot(1.2 - 0, 0) - 1;
    expect(d).toBeCloseTo(only0, 5);
    expect(ACTIVE_PART_THRESHOLD).toBe(0.05);
  });

  it('is deterministic across calls', () => {
    const a = evaluateParts(duo(), [0.3, 0.2, -0.1], 'soft');
    const b = evaluateParts(duo(), [0.3, 0.2, -0.1], 'soft');
    expect(Array.from(a.influence)).toEqual(Array.from(b.influence));
    expect(a.d).toBe(b.d);
  });
});

describe('part colours', () => {
  it('hslToRgb01 is in range and deterministic', () => {
    for (const [h, s, l] of [[0.5, 0.4, 0.72], [0.9, 0.1, 0.5], [0.05, 0.9, 0.3]] as const) {
      const { r, g, b } = hslToRgb01(h, s, l);
      for (const v of [r, g, b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(hslToRgb01(0.5, 0.4, 0.72)).toEqual(hslToRgb01(0.5, 0.4, 0.72));
  });

  it('parts get distinct deterministic colours (more colour, still biased)', () => {
    const sdf = duo();
    const c0 = partRgb(sdf, 0);
    const c1 = partRgb(sdf, 1);
    expect(c0).not.toEqual(c1);
    // Parts differ from the single-material read on at least one channel.
    const single = hslToRgb01(0.5, 0.4, 0.72);
    const maxDiff = Math.max(Math.abs(c0.r - single.r), Math.abs(c0.g - single.g), Math.abs(c0.b - single.b));
    expect(maxDiff).toBeGreaterThan(0.05);
    expect(partRgb(sdf, 0)).toEqual(partRgb(sdf, 0));
  });

  it('influence-weighted merge stays in range and follows ownership in cut', () => {
    const sdf = duo();
    const soft = mergePartRgb(sdf, evaluateParts(sdf, [1.1, 0, 0], 'soft').influence);
    const cut = mergePartRgb(sdf, evaluateParts(sdf, [1.1, 0, 0], 'cut').influence);
    for (const [r, g, b] of [soft, cut]) {
      for (const v of [r, g, b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    // In cut, the colour IS part 1's colour (one-hot ownership).
    expect(cut[0]).toBeCloseTo(partRgb(sdf, 1).r, 9);
    expect(cut[1]).toBeCloseTo(partRgb(sdf, 1).g, 9);
    expect(cut[2]).toBeCloseTo(partRgb(sdf, 1).b, 9);
  });
});