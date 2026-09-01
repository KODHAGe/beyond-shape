import { describe, expect, it } from 'vitest';
import type { SdfParams } from '../src/types';
import {
  getSolidMesh,
  gridForMode,
  initialView,
  pastelGradientStops,
  projectFaces,
  sdfKey,
  smoothingForMode,
} from '../src/render/projection';
import { sampleField } from '../src/core/sdfField';
import { marchCubes } from '../src/render/marchingCubes';
import { applyOrbitDelta } from '../src/render/input';

/** A unit sphere anchored on primitive 0 (weight 1), everything else inert. */
function sphereFixture(overrides: Partial<SdfParams> = {}): SdfParams {
  const parts = Array.from({ length: 8 }, () => ({
    scale: [1, 1, 1] as [number, number, number],
    offset: [0, 0, 0] as [number, number, number],
    twist: 0,
    displacement: 0,
  }));
  const base: SdfParams = {
    weights: [1, 0, 0, 0, 0, 0, 0, 0],
    blendRadius: 0.15,
    parts: parts as SdfParams['parts'],
    material: {
      hue: 0.5,
      saturation: 0.4,
      lightness: 0.7,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0,
      emissive: 0,
    },
    motion: { breathe: 0, sway: 0 },
    pose: { yaw: 0, pitch: 0, roll: 0 },
  };
  return { ...base, ...overrides };
}

/** Two overlapping spheres (parts 0 & 1, both ACTIVE) — the seam where two
 *  solids cut each other, in miniature. Offset 1.2 ⇒ the union folds at two
 *  crease circles around x ≈ 0.6. */
function duoFixture(): SdfParams {
  const parts = Array.from({ length: 8 }, () => ({
    scale: [1, 1, 1] as [number, number, number],
    offset: [0, 0, 0] as [number, number, number],
    twist: 0,
    displacement: 0,
  }));
  parts[1] = {
    scale: [1, 1, 1] as [number, number, number],
    offset: [1.2, 0, 0] as [number, number, number],
    twist: 0,
    displacement: 0,
  };
  return {
    weights: [0.5, 0.5, 0, 0, 0, 0, 0, 0],
    blendRadius: 0.15,
    parts: parts as SdfParams['parts'],
    material: {
      hue: 0.5,
      saturation: 0.4,
      lightness: 0.7,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0,
      emissive: 0,
    },
    motion: { breathe: 0, sway: 0 },
    pose: { yaw: 0, pitch: 0, roll: 0 },
  };
}

/** Sharpest dihedral fold in the mesh (radians): the largest angle between two
 *  adjacent triangles' planes. A crease shows up as a big fold; a smooth blob
 *  stays near 0. Deterministic over the index buffer. */
function maxDihedral(mesh: { positions: Float32Array; indices: Uint32Array }): number {
  const nTris = Math.floor(mesh.indices.length / 3);
  const normals: number[][] = [];
  for (let t = 0; t < nTris; t += 1) {
    const ia = mesh.indices[t * 3]! * 3;
    const ib = mesh.indices[t * 3 + 1]! * 3;
    const ic = mesh.indices[t * 3 + 2]! * 3;
    const ax = mesh.positions[ia]!;
    const ay = mesh.positions[ia + 1]!;
    const az = mesh.positions[ia + 2]!;
    const bx = mesh.positions[ib]!;
    const by = mesh.positions[ib + 1]!;
    const bz = mesh.positions[ib + 2]!;
    const cx = mesh.positions[ic]!;
    const cy = mesh.positions[ic + 1]!;
    const cz = mesh.positions[ic + 2]!;
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    normals.push([nx / l, ny / l, nz / l]);
  }
  const shared = new Map<string, number[]>();
  const push = (a: number, b: number, t: number): void => {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    const arr = shared.get(key) ?? [];
    arr.push(t);
    shared.set(key, arr);
  };
  for (let t = 0; t < nTris; t += 1) {
    push(mesh.indices[t * 3]!, mesh.indices[t * 3 + 1]!, t);
    push(mesh.indices[t * 3 + 1]!, mesh.indices[t * 3 + 2]!, t);
    push(mesh.indices[t * 3 + 2]!, mesh.indices[t * 3]!, t);
  }
  let max = 0;
  for (const tris of shared.values()) {
    for (let i = 0; i < tris.length; i += 1) {
      for (let j = i + 1; j < tris.length; j += 1) {
        const a = normals[tris[i]!]!;
        const b = normals[tris[j]!]!;
        const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
        const ang = Math.acos(Math.min(1, dot));
        if (ang > max) max = ang;
      }
    }
  }
  return max;
}

describe('sdfKey', () => {
  it('is deterministic for the same reading', () => {
    const a = sphereFixture();
    const b = sphereFixture();
    expect(sdfKey(a)).toBe(sdfKey(b));
  });

  it('separates genuinely different readings', () => {
    const sphere = sphereFixture();
    const boxier = sphereFixture({ weights: [0, 1, 0, 0, 0, 0, 0, 0] });
    const otherHue = sphereFixture({
      material: { ...sphereFixture().material, hue: 0.05 },
    });
    const otherRadius = sphereFixture({ blendRadius: 0.42 });
    expect(sdfKey(boxier)).not.toBe(sdfKey(sphere));
    expect(sdfKey(otherHue)).not.toBe(sdfKey(sphere));
    expect(sdfKey(otherRadius)).not.toBe(sdfKey(sphere));
  });
});

describe('getSolidMesh', () => {
  it('marches a real, bounded mesh for an anchored sphere', () => {
    const mesh = getSolidMesh(sphereFixture());
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.radius).toBeGreaterThan(0);
    expect(mesh.radius).toBeLessThan(2);
  });

  it('caches identical readings (same mesh instance)', () => {
    const a = getSolidMesh(sphereFixture());
    const b = getSolidMesh(sphereFixture());
    expect(a).toBe(b);
  });
});

describe('pure-solids cut path', () => {
  it('marching policy: soft = 48³ + one Laplacian pass; cut = 64³ + none', () => {
    expect(gridForMode('soft')).toBe(48);
    expect(gridForMode('cut')).toBe(64);
    expect(smoothingForMode('soft')).toBe(true);
    expect(smoothingForMode('cut')).toBe(false);
  });

  it('cut returns the RAW marched surface — no Laplacian averaging the seam', () => {
    const sdf = duoFixture();
    const mesh = getSolidMesh(sdf, 'cut');
    const n = gridForMode('cut');
    const field = sampleField(sdf, n, -1.5, 1.5, 'cut');
    const raw = marchCubes(field, n, n, n, -1.5, 1.5);
    expect(Array.from(mesh.positions)).toEqual(Array.from(raw.positions));
    expect(Array.from(mesh.indices)).toEqual(Array.from(raw.indices));
    // colours sized to the raw (unsmoothed) vertex count
    expect(mesh.colors.length).toBe(mesh.positions.length);
  });

  it('keeps the fold where active solids cut — sharper than the smoothed soft weld', () => {
    const sdf = duoFixture();
    const cutFold = maxDihedral(getSolidMesh(sdf, 'cut'));
    const softFold = maxDihedral(getSolidMesh(sdf, 'soft'));
    // A genuine crease (two spheres at 0 and 1.2 meet at an ideal ~74° fold).
    expect(cutFold).toBeGreaterThan(0.9);
    // And it is UNsmoothed relative to soft's weld — regression guard against
    // anyone re-adding the Laplacian pass to the cut path.
    expect(cutFold).toBeGreaterThan(softFold + 0.15);
  });

  it('defaults to the reading’s decoded blendMode; an explicit mode still wins', () => {
    const cutReading = { ...duoFixture(), blendMode: 'cut' as const };
    const n = gridForMode('cut');
    const raw = marchCubes(sampleField(cutReading, n, -1.5, 1.5, 'cut'), n, n, n, -1.5, 1.5);
    // No explicit mode → the decoded 'cut': the raw 64³ surface, crease kept.
    const auto = getSolidMesh(cutReading);
    expect(Array.from(auto.positions)).toEqual(Array.from(raw.positions));
    // An explicit 'cut' resolves to the same cached entry.
    expect(getSolidMesh(cutReading, 'cut')).toBe(auto);
    // An explicit 'soft' overrides a cut reading.
    const overridden = getSolidMesh(cutReading, 'soft');
    expect(Array.from(overridden.positions)).not.toEqual(Array.from(raw.positions));
  });
});

describe('projectFaces', () => {
  it('projects the visible faces, sorted far→near, finite and shaded (backface culled)', () => {
    const mesh = getSolidMesh(sphereFixture());
    const faces = projectFaces(mesh, { yaw: 0.6, pitch: 0.3 }, { width: 200, height: 200 });
    // Backfaces are culled, so fewer than the full triangle count — but a real,
    // visible front hemisphere remains.
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.length).toBeLessThan(mesh.indices.length / 3);
    for (let i = 1; i < faces.length; i += 1) {
      expect(faces[i - 1]!.z >= faces[i]!.z).toBe(true);
    }
    for (const f of faces) {
      for (const v of [f.x0, f.y0, f.x1, f.y1, f.x2, f.y2]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(f.shade).toBeGreaterThanOrEqual(0);
      expect(f.shade).toBeLessThanOrEqual(1);
    }
  });

  it('shading changes as the form turns', () => {
    const mesh = getSolidMesh(sphereFixture());
    const front = projectFaces(mesh, { yaw: 0, pitch: 0 }, { width: 200, height: 200 });
    const turned = projectFaces(mesh, { yaw: 1.7, pitch: 0.5 }, { width: 200, height: 200 });
    const shadeSum = (fs: typeof front): number => fs.reduce((s, f) => s + f.shade, 0);
    expect(shadeSum(turned)).not.toBeCloseTo(shadeSum(front), 4);
  });
});

describe('initialView', () => {
  it('is deterministic per seed and clamps the decoded pitch', () => {
    const sdf = sphereFixture({ pose: { yaw: 0.2, pitch: 2.0, roll: 0 } });
    const a = initialView(42, sdf);
    const b = initialView(42, sdf);
    expect(a.yaw).toBe(b.yaw);
    expect(a.pitch).toBeLessThanOrEqual(1.15);
    const c = initialView(7, sdf);
    expect(c.yaw).not.toBe(a.yaw); // different seed → different first angle
  });
});

describe('pastelGradientStops', () => {
  it('returns two css hex stops', () => {
    const stops = pastelGradientStops(0.5, 0.4, 0.7);
    expect(stops).toHaveLength(2);
    for (const s of stops) expect(/^#[0-9a-f]{6}$/i.test(s)).toBe(true);
  });
});

describe('applyOrbitDelta', () => {
  it('wraps yaw and clamps pitch', () => {
    const v = applyOrbitDelta({ yaw: 6.2, pitch: 1.3 }, 0.4, 0.5);
    expect(v.yaw).toBeGreaterThanOrEqual(0);
    expect(v.yaw).toBeLessThan(2 * Math.PI);
    expect(v.pitch).toBeLessThanOrEqual(1.25);
    const down = applyOrbitDelta({ yaw: 0, pitch: -1.3 }, 0, -0.2);
    expect(down.pitch).toBeGreaterThanOrEqual(-1.25);
  });
});