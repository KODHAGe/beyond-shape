import { describe, expect, it } from 'vitest';
import { marchCubes } from '../src/render/marchingCubes';
import { laplacianSmooth } from '../src/render/marchingCubes';

const N = 48;
const MIN = -1.5;
const MAX = 1.5;

function analyticSphereField(): Float32Array {
  const f = new Float32Array(N * N * N);
  const step = (MAX - MIN) / (N - 1);
  for (let z = 0; z < N; z += 1) {
    const pz = MIN + z * step;
    for (let y = 0; y < N; y += 1) {
      const py = MIN + y * step;
      for (let x = 0; x < N; x += 1) {
        const px = MIN + x * step;
        f[z * N * N + y * N + x] = Math.hypot(px, py, pz) - 0.9;
      }
    }
  }
  return f;
}

/**
 * Winding-orientation guard (the Render Reviewer lens, AGENTS §2.5):
 * triangle winding must point OUTWARD — aligned with the SDF's field
 * gradient — so three.js FrontSide shading shows the OUTER surface. The
 * regression this guards was real: an inward winding rendered as "seeing
 * the inside of the shape" (backfaces lit as if the camera were within).
 * The signed volume carries the same information (positive = outward).
 */
describe('marching cubes winding', () => {
  it('aligns triangle normals with the outward field gradient', () => {
    const mesh = marchCubes(analyticSphereField(), N, N, N, MIN, MAX);
    const P = mesh.positions;
    const G = mesh.normals;
    let dot = 0;
    let count = 0;
    let bad = 0;
    for (let t = 0; t + 2 < mesh.indices.length; t += 3) {
      const a = mesh.indices[t]! * 3;
      const b = mesh.indices[t + 1]! * 3;
      const c = mesh.indices[t + 2]! * 3;
      const ux = P[b]! - P[a]!; const uy = P[b + 1]! - P[a + 1]!; const uz = P[b + 2]! - P[a + 2]!;
      const vx = P[c]! - P[a]!; const vy = P[c + 1]! - P[a + 1]!; const vz = P[c + 2]! - P[a + 2]!;
      let nx = uy * vz - uz * vy; let ny = uz * vx - ux * vz; let nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl; // unit face normal
      const gx = G[a] ?? 0; const gy = G[a + 1] ?? 0; const gz = G[a + 2] ?? 0;
      const gl = Math.hypot(gx, gy, gz) || 1;
      const d = (nx * gx + ny * gy + nz * gz) / gl;
      dot += d;
      if (d < 0) bad += 1;
      count += 1;
    }
    expect(count).toBeGreaterThan(0);
    // Strongly outward on average, and essentially no inverted triangles.
    expect(dot / count).toBeGreaterThan(0.9);
    expect(bad / count).toBeLessThan(0.01);
  });

  it('keeps outward winding after laplacian smoothing (as rendered)', () => {
    const mesh = marchCubes(analyticSphereField(), N, N, N, MIN, MAX);
    const smooth = laplacianSmooth(mesh.positions, mesh.indices, 1);
    let vol = 0;
    for (let t = 0; t + 2 < mesh.indices.length; t += 3) {
      const a = mesh.indices[t]! * 3;
      const b = mesh.indices[t + 1]! * 3;
      const c = mesh.indices[t + 2]! * 3;
      const ax = smooth[a] ?? 0; const ay = smooth[a + 1] ?? 0; const az = smooth[a + 2] ?? 0;
      const bx = smooth[b] ?? 0; const by = smooth[b + 1] ?? 0; const bz = smooth[b + 2] ?? 0;
      const cx = smooth[c] ?? 0; const cy = smooth[c + 1] ?? 0; const cz = smooth[c + 2] ?? 0;
      vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
    }
    expect(vol / 6).toBeGreaterThan(0); // positive signed volume = outward
  });
});