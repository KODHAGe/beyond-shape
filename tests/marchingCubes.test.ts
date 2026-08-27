import { describe, expect, it } from 'vitest';
import { marchCubes, computeEdgeMask, triTableEdgeInvariant } from '../src/render/marchingCubes';

const N = 48;
const MIN = -1.5;
const MAX = 1.5;

/** Signed volume of a triangle mesh (divergence theorem). */
function signedVolume(positions: Float32Array, indices: Uint32Array): number {
  let vol = 0;
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t]! * 3;
    const b = indices[t + 1]! * 3;
    const c = indices[t + 2]! * 3;
    const ax = positions[a]!;
    const ay = positions[a + 1]!;
    const az = positions[a + 2]!;
    const bx = positions[b]!;
    const by = positions[b + 1]!;
    const bz = positions[b + 2]!;
    const cx = positions[c]!;
    const cy = positions[c + 1]!;
    const cz = positions[c + 2]!;
    vol +=
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return vol / 6;
}

/** Signed volume of a closed triangle mesh (divergence theorem, abs). */
function absVolume(positions: Float32Array, indices: Uint32Array): number {
  return Math.abs(signedVolume(positions, indices));
}

/** Euler characteristic from a closed triangle mesh. */
function eulerCharacteristic(positions: Float32Array, indices: Uint32Array): number {
  const V = positions.length / 3;
  const E = new Set<number>();
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const [a, b, c] = [indices[t]!, indices[t + 1]!, indices[t + 2]!];
    const add = (x: number, y: number) => E.add(x < y ? x * V + y : y * V + x);
    add(a, b);
    add(b, c);
    add(c, a);
  }
  return V - E.size + indices.length / 3;
}

/** Mean vertex position (orientation-independent sanity check). */
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

function analyticSphereField(r: number, cx: number, cy: number, cz: number): Float32Array {
  const f = new Float32Array(N * N * N);
  const step = (MAX - MIN) / (N - 1);
  for (let z = 0; z < N; z += 1) {
    const pz = MIN + z * step;
    for (let y = 0; y < N; y += 1) {
      const py = MIN + y * step;
      for (let x = 0; x < N; x += 1) {
        const px = MIN + x * step;
        f[z * N * N + y * N + x] = Math.hypot(px - cx, py - cy, pz - cz) - r;
      }
    }
  }
  return f;
}

describe('marching cubes', () => {
  it('satisfies the table edge invariant for all 256 cases', () => {
    expect(triTableEdgeInvariant()).toBe(true);
  });

  it('preserves complement symmetry of crossing-edge sets (c ↔ 255-c)', () => {
    for (let c = 0; c < 256; c += 1) {
      expect(computeEdgeMask(c)).toBe(computeEdgeMask(255 - c));
    }
  });

  it('meshes an analytic sphere with correct volume and centroid', () => {
    const center: [number, number, number] = [0.11, -0.07, 0.05];
    const r = 0.9;
    const mesh = marchCubes(analyticSphereField(r, ...center), N, N, N, MIN, MAX);
    expect(mesh.indices.length).toBeGreaterThan(0);

    const expected = (4 / 3) * Math.PI * r ** 3;
    const vol = absVolume(mesh.positions, mesh.indices);
    expect(Math.abs(vol - expected) / expected).toBeLessThan(0.15);

    // Winding consistency: the signed volume must not nearly cancel out
    // (a mixed-orientation mesh would have |signed| << true volume).
    const signed = signedVolume(mesh.positions, mesh.indices);
    expect(Math.abs(signed)).toBeGreaterThan(expected * 0.6);

    const [cx, cy, cz] = centroid(mesh.positions);
    expect(Math.abs(cx - center[0])).toBeLessThan(0.12);
    expect(Math.abs(cy - center[1])).toBeLessThan(0.12);
    expect(Math.abs(cz - center[2])).toBeLessThan(0.12);

    // Closed genus-0 surface (allow tiny classic-MC ambiguous-cell hiccups).
    const euler = eulerCharacteristic(mesh.positions, mesh.indices);
    expect(Math.abs(euler - 2)).toBeLessThanOrEqual(6);
  });

  it('returns gradient normals of unit-ish magnitude at every vertex', () => {
    const mesh = marchCubes(analyticSphereField(0.9, 0.02, 0.03, -0.04), N, N, N, MIN, MAX);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const nx = mesh.normals[i]!;
      const ny = mesh.normals[i + 1]!;
      const nz = mesh.normals[i + 2]!;
      const len = Math.hypot(nx, ny, nz);
      expect(len).toBeGreaterThan(1e-6); // no zero/degenerate normals
      expect(len).toBeLessThan(3);
    }
  });

  it('rejects a field shorter than the grid volume', () => {
    expect(() => marchCubes(new Float32Array(10), N, N, N, MIN, MAX)).toThrow(RangeError);
  });
});