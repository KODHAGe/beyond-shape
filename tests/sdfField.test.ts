import { describe, expect, it } from 'vitest';
import type { SdfParams } from '../src/types';
import { sampleField, evaluateSdf } from '../src/core/sdfField';
import { marchCubes } from '../src/render/marchingCubes';

const N = 48;
const MIN = -1.5;
const MAX = 1.5;

/** One-hot anchor SdfParams for a primitive index (ADR-4 convention). */
function anchor(primitive: number, scale: [number, number, number], offset: [number, number, number]): SdfParams {
  return {
    weights: Array.from({ length: 8 }, (_, i) => (i === primitive ? 1 : 0)),
    blendRadius: 0.15,
    parts: Array.from({ length: 8 }, () => ({
      scale,
      offset,
      twist: 0,
      displacement: 0,
    })) as SdfParams['parts'],
    material: {
      hue: 0.08,
      saturation: 0.45,
      lightness: 0.75,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.3,
      emissive: 0,
    },
    motion: { breathe: 0, sway: 0 },
    pose: { yaw: 0, pitch: 0, roll: 0 },
  };
}

function absVolume(positions: Float32Array, indices: Uint32Array): number {
  let vol = 0;
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t]! * 3;
    const b = indices[t + 1]! * 3;
    const c = indices[t + 2]! * 3;
    vol +=
      positions[a]! * (positions[b + 1]! * positions[c + 2]! - positions[b + 2]! * positions[c + 1]!) +
      positions[a + 1]! * (positions[b + 2]! * positions[c]! - positions[b]! * positions[c + 2]!) +
      positions[a + 2]! * (positions[b]! * positions[c + 1]! - positions[b + 1]! * positions[c]!);
  }
  return Math.abs(vol / 6);
}

function centroid(positions: Float32Array): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  const n = positions.length / 3;
  for (let i = 0; i < n; i += 1) {
    x += positions[i * 3]!;
    y += positions[i * 3 + 1]!;
    z += positions[i * 3 + 2]!;
  }
  return [x / n, y / n, z / n];
}

describe('sdfField → marching cubes (FR-7 blend backbone)', () => {
  it('fields outside and inside the shape carry the correct sign', () => {
    const sdf = anchor(0, [1, 1, 1], [0, 0, 0]); // unit sphere r=1
    expect(evaluateSdf(sdf, [0, 0, 0])).toBeLessThan(0);
    expect(evaluateSdf(sdf, [2, 0, 0])).toBeGreaterThan(0);
    expect(evaluateSdf(sdf, [1, 0, 0])).toBeCloseTo(0, 1);
  });

  it('a sphere anchor meshes with correct volume + centroid (FR-7 baseline)', () => {
    const sdf = anchor(0, [0.75, 0.75, 0.75], [0.01, -0.02, 0.03]);
    const field = sampleField(sdf, N, MIN, MAX);
    const mesh = marchCubes(field, N, N, N, MIN, MAX);
    expect(mesh.indices.length).toBeGreaterThan(0);
    const expected = (4 / 3) * Math.PI * 0.75 ** 3;
    const vol = absVolume(mesh.positions, mesh.indices);
    expect(Math.abs(vol - expected) / expected).toBeLessThan(0.15);
    const [cx, cy, cz] = centroid(mesh.positions);
    expect(Math.abs(cx - 0.01)).toBeLessThan(0.12);
    expect(Math.abs(cy + 0.02)).toBeLessThan(0.12);
    expect(Math.abs(cz - 0.03)).toBeLessThan(0.12);
  });

  it('a box anchor meshes with the box extents (axis-aligned box volume)', () => {
    const sdf = anchor(1, [1.2, 1.1, 0.9], [0.03, -0.05, 0.02]);
    const field = sampleField(sdf, N, MIN, MAX);
    const mesh = marchCubes(field, N, N, N, MIN, MAX);
    expect(mesh.indices.length).toBeGreaterThan(0);
    // scale = half-extent per the SDF convention (consistent with radius),
    // so the full box volume is 8·(2·1.2)(2·1.1)(2·0.9) = 8·1.2·1.1·0.9.
    const expected = 8 * 1.2 * 1.1 * 0.9;
    const vol = absVolume(mesh.positions, mesh.indices);
    expect(Math.abs(vol - expected) / expected).toBeLessThan(0.18);
  });
});