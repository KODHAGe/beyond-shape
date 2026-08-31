/**
 * Blended signed-distance field (ADR-4). Evaluates the 8-primitive SDF library
 * on a 48³ grid over [-1.5, 1.5]³ with two blend modes driven by the SdfParams
 * weights:
 *   - 'soft': smooth-min (softmin via log-sum-exp — anchor weight 1 reduces to
 *     the pure primitive; mid-weights produce true "between" forms, FR-7);
 *   - 'cut': the original's overlapping solids — hard union of ACTIVE parts,
 *     each surface point owned by exactly one part (per-part colouring input).
 *
 * Primitive order is a binding (shared with scripts/train_generator.py and the
 * decoder): 0 sphere · 1 box · 2 roundedBox · 3 cylinder · 4 cone · 5 torus ·
 * 6 capsule · 7 blob. Each part applies [offset → twist → scale] in that order;
 * distance multiplies by the minimum scale component (conservative anisotropic
 * metric). twist = radians per unit height (about Y), displacement = ripple
 * amplitude. All conventions documented here — this is a *convention*, not a
 * taxonomy (ADR-4 "extensible as data").
 */

import type { SdfParams } from '../types';
import { clamp } from '../lib/math';

export const GRID_N = 48;
export const FIELD_MIN = -1.5;
export const FIELD_MAX = 1.5;
export const PRIMITIVE_COUNT = 8;

export const PRIMITIVE_NAMES = [
  'sphere',
  'box',
  'roundedBox',
  'cylinder',
  'cone',
  'torus',
  'capsule',
  'blob',
] as const;

type Vec3 = readonly [number, number, number];

function length3(p: Vec3): number {
  return Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
}

/** Canonical primitive SDFs — unit-space, centred, radii ≈ 1. */

function sdSphere(p: Vec3): number {
  return length3(p) - 1;
}

function sdBox(p: Vec3, half: Vec3): number {
  const qx = Math.abs(p[0]) - half[0];
  const qy = Math.abs(p[1]) - half[1];
  const qz = Math.abs(p[2]) - half[2];
  const lenQ = length3([Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)]);
  return lenQ + Math.min(Math.max(qx, Math.max(qy, qz)), 0);
}

function sdRoundedBox(p: Vec3, half: Vec3, r: number): number {
  return sdBox(p, [half[0] - r, half[1] - r, half[2] - r]) - r;
}

/** Capped cylinder, axis Y. halfH = half height, r = radius. */
function sdCappedCylinderY(p: Vec3, halfH: number, r: number): number {
  const d = [Math.hypot(p[0], p[2]) - r, Math.abs(p[1]) - halfH] as [number, number];
  return Math.min(Math.max(d[0], d[1]), 0) + Math.hypot(Math.max(d[0], 0), Math.max(d[1], 0));
}

/**
 * Exact-distance cone (apex at y=+height/2, base disc radius at y=-height/2).
 * Defined as the intersection of the infinite side halfspace and the base cap
 * halfspace; max() of the two exact plane/side distances is the true SDF of
 * the cone solid. (Near the apex tip the closest element is the tip itself;
 * the zero set — the surface we march — is exact.)
 */
function sdCone(p: Vec3, height: number, radius: number): number {
  const halfH = height / 2;
  const slant = Math.hypot(height, radius);
  const q = Math.hypot(p[0], p[2]);
  const zDown = -(p[1] - halfH); // apex→base axis distance
  const dSide = (q * height - zDown * radius) / slant;
  const dCap = -(p[1] + halfH); // cap plane at y = -halfH
  return Math.max(dSide, dCap);
}

function sdTorus(p: Vec3, R: number, r: number): number {
  const q: Vec3 = [Math.hypot(p[0], p[2]) - R, p[1], 0];
  return length3(q) - r;
}

function sdCapsuleY(p: Vec3, h: number, r: number): number {
  const y = clamp(p[1], -h, h);
  return length3([p[0], p[1] - y, p[2]]) - r;
}

function sdBlob(p: Vec3, ripple: number): number {
  // Squashed "organic" sphere with a low-frequency ripple. The ripple scales
  // with the part displacement (0..0.5) on top of the fixed lobe.
  const base = length3(p) - 1;
  const wave =
    ripple *
    (0.6 *
      Math.sin(2.2 * p[0]) *
      Math.sin(2.2 * p[1]) *
      Math.sin(2.2 * p[2]) -
      0.15 * Math.cos(4.4 * p[0]));
  return base + wave;
}

/** Rotate about Y by angle θ (twist). */
function rotateY(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c] as Vec3;
}

function canonicalDistance(primitive: number, u: Vec3, displacement: number): number {
  switch (primitive) {
    case 0:
      return sdSphere(u);
    case 1:
      return sdBox(u, [1, 1, 1]);
    case 2:
      return sdRoundedBox(u, [1, 1, 1], 0.25);
    case 3:
      return sdCappedCylinderY(u, 1, 1);
    case 4:
      return sdCone(u, 2, 0.8);
    case 5:
      return sdTorus(u, 0.55, 0.32);
    case 6:
      return sdCapsuleY(u, 0.8, 0.45);
    case 7:
      return sdBlob(u, displacement * 2);
    default:
      throw new RangeError(`unknown primitive index ${primitive}`);
  }
}

/** Per-part → world distance for one primitive at world point p. */
function primitiveDistance(
  primitive: number,
  p: Vec3,
  part: SdfParams['parts'][number],
): number {
  const s = part.scale;
  const o = part.offset;
  const minScale = Math.min(s[0], s[1], s[2]);

  // 1) translate
  const t1: Vec3 = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  // 2) twist about Y — radians per unit height
  const angle = part.twist * t1[1];
  const t2 = rotateY(t1, angle);
  // 3) scale into canonical space
  const u: Vec3 = [t2[0] / s[0], t2[1] / s[1], t2[2] / s[2]];
  return canonicalDistance(primitive, u, part.displacement) * minScale;
}

export type BlendMode = 'soft' | 'cut';

/** A part with weight below this is absent in hard-cut mode (present = shape). */
export const ACTIVE_PART_THRESHOLD = 0.05;

export interface PartEvaluate {
  d: number;
  /** 8-vector: each part's share of the surface at p (false/soft) or the
   *  owning part 1.0 (cut) — the input to per-part colouring. */
  influence: Float32Array;
}

/**
 * Blend of the 8 primitives + per-part surface influence for colouring.
 * `mode`:
 *  - 'soft' — log-sum-exp softmin (current): anchor weight 1 → pure primitive,
 *    mid-weights → genuine "between" forms (FR-7); influence ∝ exp(−Δ/k).
 *  - 'cut'  — the original's overlapping solids (ORIGINAL-2019 §Constructor):
 *    each ACTIVE part (weight > ACTIVE_PART_THRESHOLD) is a solid; the union is
 *    the hard min, and every surface point belongs to exactly one part (its
 *    colour) — sharp creases where solids cut each other, dramatic by design.
 */
export function evaluateParts(sdfParams: SdfParams, p: Vec3, mode: BlendMode = 'soft'): PartEvaluate {
  const k = clamp(sdfParams.blendRadius, 0.05, 0.5);
  const weights = sdfParams.weights;
  if (weights.length !== PRIMITIVE_COUNT) {
    throw new RangeError(`expected ${PRIMITIVE_COUNT} blend weights`);
  }

  const influence = new Float32Array(PRIMITIVE_COUNT);

  // Per-part distances (null for zero-weight parts).
  const ds = new Array<number | null>(PRIMITIVE_COUNT);
  for (let i = 0; i < PRIMITIVE_COUNT; i += 1) {
    const w = weights[i] ?? 0;
    ds[i] = w <= 1e-7 ? null : primitiveDistance(i, p, sdfParams.parts[i]!);
  }

  if (mode === 'cut') {
    let best = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < PRIMITIVE_COUNT; i += 1) {
      const d = ds[i];
      if (d === null || d >= best) continue;
      if ((weights[i] ?? 0) <= ACTIVE_PART_THRESHOLD) continue;
      best = d;
      bestIdx = i;
    }
    if (bestIdx < 0) {
      // No weight passes the threshold — fall back to the min over what exists.
      for (let i = 0; i < PRIMITIVE_COUNT; i += 1) {
        const d = ds[i];
        if (d !== null && d < best) {
          best = d;
          bestIdx = i;
        }
      }
    }
    if (bestIdx >= 0) influence[bestIdx] = 1;
    return { d: Number.isFinite(best) ? best : FIELD_MAX, influence };
  }

  // soft mode — ms[i] = d_i − k·ln(w_i); min-shift keeps exp stable.
  let minMs = Infinity;
  const ms = new Array<number>(PRIMITIVE_COUNT);
  for (let i = 0; i < PRIMITIVE_COUNT; i += 1) {
    const d = ds[i];
    if (d === null) {
      ms[i] = Infinity;
      continue;
    }
    const w = weights[i] ?? 0;
    const mi = d - k * Math.log(w);
    ms[i] = mi;
    if (mi < minMs) minMs = mi;
  }

  if (!Number.isFinite(minMs)) return { d: FIELD_MAX, influence }; // all weights zero

  let sum = 0;
  for (let i = 0; i < PRIMITIVE_COUNT; i += 1) {
    const mi = ms[i] ?? Infinity;
    if (!Number.isFinite(mi)) continue;
    sum += Math.exp(-(mi - minMs) / k);
  }
  for (let i = 0; i < PRIMITIVE_COUNT; i += 1) {
    const mi = ms[i] ?? Infinity;
    if (!Number.isFinite(mi)) continue;
    influence[i] = Math.exp(-(mi - minMs) / k) / sum;
  }
  const d = minMs - k * Math.log(sum);
  return { d: Number.isFinite(d) ? d : FIELD_MAX, influence };
}

/** Signed distance only (no influence) — the marching-cubes field. */
export function evaluateSdf(sdfParams: SdfParams, p: Vec3, mode: BlendMode = 'soft'): number {
  return evaluateParts(sdfParams, p, mode).d;
}

/**
 * Sample the field on a GRID_N³ grid over [FIELD_MIN, FIELD_MAX]³.
 * Returns a Float32Array ordered (z, y, x) with x fastest — marching-cubes
 * compatible. Values are signed distances: < 0 inside, > 0 outside.
 */
export function sampleField(
  sdfParams: SdfParams,
  n: number = GRID_N,
  min: number = FIELD_MIN,
  max: number = FIELD_MAX,
  mode: BlendMode = 'soft',
): Float32Array {
  const out = new Float32Array(n * n * n);
  const step = (max - min) / (n - 1);
  for (let z = 0; z < n; z += 1) {
    const pz = min + z * step;
    for (let y = 0; y < n; y += 1) {
      const py = min + y * step;
      const zy = z * n * n + y * n;
      for (let x = 0; x < n; x += 1) {
        const px = min + x * step;
        out[zy + x] = evaluateSdf(sdfParams, [px, py, pz], mode);
      }
    }
  }
  return out;
}