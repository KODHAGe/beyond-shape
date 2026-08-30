import { describe, expect, it } from 'vitest';
import type { SdfParams } from '../src/types';
import {
  getSolidMesh,
  initialView,
  pastelGradientStops,
  projectFaces,
  sdfKey,
} from '../src/render/projection';
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

describe('projectFaces', () => {
  it('produces one face per triangle, sorted far→near, finite and shaded', () => {
    const mesh = getSolidMesh(sphereFixture());
    const faces = projectFaces(mesh, { yaw: 0.6, pitch: 0.3 }, { width: 200, height: 200 });
    expect(faces.length).toBe(mesh.indices.length / 3);
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