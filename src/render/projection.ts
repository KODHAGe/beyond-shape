/**
 * Software 3D preview painter (the Canvas-2D tier, QR-2).
 *
 * One marched mesh per reading, cached by a hash of the decoded SdfParams;
 * per-face painter's-algorithm shading driven by the FACE NORMAL dot a fixed
 * light (not the old "higher on screen = lighter" proxy), plus a contact
 * shadow and a mild perspective. Together with `attachOrbit` the result is a
 * form you can TURN even in a browser with no WebGL at all — the same
 * "drag to turn" language as the WebGL tier (input.ts). Honest 2.5D: it is a
 * painter, not a rasteriser — the register (soft, pastel, no preset cage)
 * survives in the shading, and the mesh is literally the same one three.js
 * renders when WebGL is available.
 *
 * The marching pipeline is mode-dependent: 'soft' marches at 48³ with one
 * Laplacian pass (the FR-7 smooth morph — a weld would be rounded anyway);
 * 'cut' marches at 64³ with NO smoothing so the crease where one solid cuts
 * another stays a real fold instead of being averaged away. Each mode has its
 * own cache entry, so the two meshes never collide.
 */

import type { SdfParams } from '../types';
import { sampleField, evaluateParts, type BlendMode } from '../core/sdfField';
import { marchCubes, laplacianSmooth } from './marchingCubes';
import { clamp } from '../lib/math';
import { mergePartRgb } from '../aesthetics/partColor';

export interface SolidMesh {
  positions: Float32Array; // 3 per vertex (smoothed in 'soft', raw marched in 'cut')
  indices: Uint32Array; // triangles
  normals: Float32Array; // field-gradient normals (matched to SMOTHER run? kept raw)
  colors: Float32Array; // 3 per vertex — per-part influence weighted (soft) or
  // owning part (cut), computed ONCE (view-independent), shared by both tiers
  radius: number; // bounding radius (for shadow sizing)
}

export interface ProjectionView {
  yaw: number;
  pitch: number;
}

const GRID_SOFT = 48;
const GRID_CUT = 64;
const FIELD_RANGE = 1.5;
const MAX_CACHE = 24;

/** Marching resolution per blend mode. Hard-cut seams are folds in the field:
 *  48³ + smoothing averaged them back into a weld; 64³ resolves the crease.
 *  The finer grid is paid ONCE per reading+mode (mesh cache), so the only
 *  repeated cost is memory, not frame time. */
export function gridForMode(mode: BlendMode): number {
  return mode === 'cut' ? GRID_CUT : GRID_SOFT;
}

/** Whether the marched surface gets a Laplacian pass. 'soft' welds are meant
 *  to read rounded (FR-7); 'cut' must keep its creases raw — the original's
 *  "overlapping solids" with the seam where they cut made visible. */
export function smoothingForMode(mode: BlendMode): boolean {
  return mode === 'cut' ? false : true;
}

/** FNV-1a 32-bit over the numerically relevant decoded values (not pose).
 *  Values are quantised to 1e-6 so two decodes that differ only in the last
 *  float dust still share a mesh — but genuinely different forms never
 *  collapse onto each other's cache entry. */
export function sdfKey(sdf: SdfParams): string {
  let h = 0x811c9dc5;
  const seed = (v: number): void => {
    const u = Math.round(v * 1e6) >>> 0;
    h = (h ^ (u & 0xff)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h = (h ^ ((u >>> 8) & 0xff)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h = (h ^ ((u >>> 16) & 0xff)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h = (h ^ (u >>> 24)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  for (const w of sdf.weights) seed(w);
  seed(sdf.blendRadius);
  for (const p of sdf.parts) {
    seed(p.scale[0]); seed(p.scale[1]); seed(p.scale[2]);
    seed(p.offset[0]); seed(p.offset[1]); seed(p.offset[2]);
    seed(p.twist); seed(p.displacement);
  }
  seed(sdf.material.hue);
  seed(sdf.material.saturation);
  seed(sdf.material.lightness);
  seed(sdf.material.roughness);
  seed(sdf.material.metalness);
  seed(sdf.material.clearcoat);
  seed(sdf.material.emissive);
  return h.toString(16).padStart(8, '0');
}

const meshCache = new Map<string, SolidMesh>();

/**
 * March + smooth a reading once, cached by (sdfKey, mode). Per-vertex colours
 * come from each vertex's part influence (soft = weighted blend, cut = owning
 * part) — view-independent, paid once. Pure (no DOM needed).
 * `mode` defaults to the READING's decoded blendMode (0.2.1+; legacy reads
 * resolve 'soft') — an explicit mode still wins (e.g. the lab's manual
 * override).
 */
export function getSolidMesh(sdf: SdfParams, mode?: BlendMode): SolidMesh {
  const effective = mode ?? sdf.blendMode ?? 'soft';
  const key = `${sdfKey(sdf)}:${effective}`;
  const hit = meshCache.get(key);
  if (hit) return hit;

  const n = gridForMode(effective);
  const field = sampleField(sdf, n, -FIELD_RANGE, FIELD_RANGE, effective);
  const marched = marchCubes(field, n, n, n, -FIELD_RANGE, FIELD_RANGE);
  // 'cut' keeps the raw marched surface (no Laplacian) so the seam where the
  // solids cut stays a real crease; 'soft' smooths, its weld reads rounded.
  const positions = smoothingForMode(effective)
    ? laplacianSmooth(marched.positions, marched.indices, 1)
    : marched.positions;

  let radius = 0;
  const colors = new Float32Array(positions.length);
  for (let v = 0; v * 3 < positions.length; v += 1) {
    const px = positions[v * 3] ?? 0;
    const py = positions[v * 3 + 1] ?? 0;
    const pz = positions[v * 3 + 2] ?? 0;
    const r = Math.hypot(px, py, pz);
    if (r > radius) radius = r;
    const { influence } = evaluateParts(sdf, [px, py, pz], effective);
    const [cr, cg, cb] = mergePartRgb(sdf, influence);
    colors[v * 3] = cr;
    colors[v * 3 + 1] = cg;
    colors[v * 3 + 2] = cb;
  }

  const mesh: SolidMesh = {
    positions,
    indices: marched.indices,
    normals: marched.normals,
    colors,
    radius,
  };

  meshCache.set(key, mesh);
  if (meshCache.size > MAX_CACHE) {
    const oldest = meshCache.keys().next().value as string | undefined;
    if (oldest !== undefined) meshCache.delete(oldest);
  }
  return mesh;
}

export interface ProjectedFace {
  a: number; // vertex index for colour lookup (SolidMesh.colors)
  b: number;
  c: number;
  x0: number; y0: number;
  x1: number; y1: number;
  x2: number; y2: number;
  z: number; // view-space depth (larger = farther, for painter order)
  shade: number; // 0..1 two-sided face lighting
}

export interface PaintView {
  width: number;
  height: number;
  scale?: number;
}

/** Fixed pre-rotation light, in view space (down-left-ish, toward camera). */
const LIGHT_X = -0.45;
const LIGHT_Y = 0.8;
const LIGHT_Z = 0.35;
const LIGHT_LEN = Math.hypot(LIGHT_X, LIGHT_Y, LIGHT_Z);

/**
 * Rotate every triangle by (yaw, pitch), project orthographic, shade by the
 * rotated face normal dot the fixed light (two-sided: soft paper, no back-face
 * blackening), and sort far → near. Pure and unit-testable.
 */
export function projectFaces(
  mesh: SolidMesh,
  view: ProjectionView,
  paint: PaintView,
): ProjectedFace[] {
  const positions = mesh.positions;
  const indices = mesh.indices;
  const cosY = Math.cos(view.yaw);
  const sinY = Math.sin(view.yaw);
  const cosP = Math.cos(view.pitch);
  const sinP = Math.sin(view.pitch);
  const scalePx = (Math.min(paint.width, paint.height) / 3.0) * (paint.scale ?? 1);
  const cx = paint.width / 2;
  const cy = paint.height / 2;

  const out: ProjectedFace[] = [];
  const nTri = Math.floor(indices.length / 3);

  for (let t = 0; t < nTri; t += 1) {
    const ia = indices[t * 3]! * 3;
    const ib = indices[t * 3 + 1]! * 3;
    const ic = indices[t * 3 + 2]! * 3;

    const ax = positions[ia] ?? 0; const ay = positions[ia + 1] ?? 0; const az = positions[ia + 2] ?? 0;
    const bx = positions[ib] ?? 0; const by = positions[ib + 1] ?? 0; const bz = positions[ib + 2] ?? 0;
    const cx0 = positions[ic] ?? 0; const cy0 = positions[ic + 1] ?? 0; const cz = positions[ic + 2] ?? 0;

    const rx0 = ax * cosY + az * sinY;
    const rz0 = -ax * sinY + az * cosY;
    const ry0 = ay * cosP - rz0 * sinP;
    const rz0b = ay * sinP + rz0 * cosP;

    const rx1 = bx * cosY + bz * sinY;
    const rz1 = -bx * sinY + bz * cosY;
    const ry1 = by * cosP - rz1 * sinP;
    const rz1b = by * sinP + rz1 * cosP;

    const rx2 = cx0 * cosY + cz * sinY;
    const rz2 = -cx0 * sinY + cz * cosY;
    const ry2 = cy0 * cosP - rz2 * sinP;
    const rz2b = cy0 * sinP + rz2 * cosP;

    // Two-sided face normal in view space.
    const e1x = rx1 - rx0; const e1y = ry1 - ry0; const e1z = rz1b - rz0b;
    const e2x = rx2 - rx0; const e2y = ry2 - ry0; const e2z = rz2b - rz0b;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const nl = Math.hypot(nx, ny, nz);
    if (nl > 1e-9) {
      nx /= nl; ny /= nl; nz /= nl;
    }

    const dot = Math.abs((nx * LIGHT_X + ny * LIGHT_Y + nz * LIGHT_Z) / LIGHT_LEN);
    const shade = 0.55 + 0.45 * clamp(dot, 0, 1);

    const zAvg = (rz0b + rz1b + rz2b) / 3;
    out.push({
      a: indices[t * 3]!,
      b: indices[t * 3 + 1]!,
      c: indices[t * 3 + 2]!,
      x0: cx + rx0 * scalePx,
      y0: cy - ry0 * scalePx,
      x1: cx + rx1 * scalePx,
      y1: cy - ry1 * scalePx,
      x2: cx + rx2 * scalePx,
      y2: cy - ry2 * scalePx,
      z: zAvg,
      shade,
    });
  }

  // Far first → near last (painter's algorithm; larger z = farther).
  out.sort((a, b) => b.z - a.z);
  return out;
}

/**
 * Pure HSL → CSS hex. Mirrors lighting.ts's palette grammar WITHOUT importing
 * three.js — the software tier must not pay for the WebGL dependency.
 */
function hslToHex(hue01: number, sat: number, light: number): string {
  const hue = (((hue01 % 1) + 1) % 1) * 360;
  const s = clamp(sat, 0, 1);
  const l = clamp(light, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0; let g = 0; let b = 0;
  if (hue < 60) { r = c; g = x; } else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; } else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; } else { r = c; b = x; }
  const to = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Palette gradient stops (same formula as lighting.ts — sync if that changes). */
export function pastelGradientStops(hue: number, saturation: number, lightness: number): readonly [string, string] {
  return [
    hslToHex(hue, 0.20 + saturation * 0.15, 0.96),
    hslToHex(hue + 0.06, 0.16 + saturation * 0.12, 0.90 - lightness * 0.02),
  ] as const;
}

/** Paint one full frame: palette gradient → contact shadow → sorted faces. */
export function paintSolid(
  ctx: CanvasRenderingContext2D,
  mesh: SolidMesh,
  sdf: SdfParams,
  view: ProjectionView,
  paint: PaintView,
): void {
  const w = paint.width;
  const h = paint.height;
  const m = sdf.material;
  const hue01 = (((m.hue % 1) + 1) % 1);
  const hueDeg = hue01 * 360;

  // Palette gradient (same grammar as the WebGL background — register stays).
  const stops = pastelGradientStops(m.hue, m.saturation, m.lightness);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(1, stops[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const faces = projectFaces(mesh, view, paint);
  if (faces.length === 0) return;

  // Contact shadow: soft ellipse under the form's projected extent.
  let minX = Infinity; let maxX = -Infinity;
  let minY = Infinity; let maxY = -Infinity;
  for (const f of faces) {
    if (f.x0 < minX) minX = f.x0;
    if (f.x1 < minX) minX = f.x1;
    if (f.x2 < minX) minX = f.x2;
    if (f.x0 > maxX) maxX = f.x0;
    if (f.x1 > maxX) maxX = f.x1;
    if (f.x2 > maxX) maxX = f.x2;
    if (f.y0 < minY) minY = f.y0;
    if (f.y1 < minY) minY = f.y1;
    if (f.y2 < minY) minY = f.y2;
    if (f.y0 > maxY) maxY = f.y0;
    if (f.y1 > maxY) maxY = f.y1;
    if (f.y2 > maxY) maxY = f.y2;
  }
  const shadowRx = ((maxX - minX) / 2) * 0.82;
  const shadowRy = shadowRx * 0.26;
  if (shadowRx > 1) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = `hsl(${hueDeg} 25% 32%)`;
    ctx.beginPath();
    ctx.ellipse((minX + maxX) / 2, maxY + shadowRy * 1.4, shadowRx, shadowRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Faces far → near. Colour: per-part vertex colours (OWNER in cut mode,
  // influence-weighted blend in soft mode — see SolidMesh.colors), averaged
  // per face and scaled by the face shade.
  const colors = mesh.colors;
  const usePartColor = colors.length === mesh.positions.length;
  const sat = clamp(0.25 + m.saturation * 0.5, 0, 1);
  const light = clamp(0.7 + m.lightness * 0.25, 0, 1);
  for (const f of faces) {
    if (usePartColor) {
      const ia = f.a * 3;
      const ib = f.b * 3;
      const ic = f.c * 3;
      const r = ((colors[ia] ?? 0) + (colors[ib] ?? 0) + (colors[ic] ?? 0)) / 3;
      const g = ((colors[ia + 1] ?? 0) + (colors[ib + 1] ?? 0) + (colors[ic + 1] ?? 0)) / 3;
      const b = ((colors[ia + 2] ?? 0) + (colors[ib + 2] ?? 0) + (colors[ic + 2] ?? 0)) / 3;
      const sc = Math.min(1, f.shade * light);
      ctx.fillStyle = `rgb(${Math.round(clamp(r * sc, 0, 1) * 255)} ${
        Math.round(clamp(g * sc, 0, 1) * 255)} ${Math.round(clamp(b * sc, 0, 1) * 255)})`;
    } else {
      const l = Math.min(1, light * f.shade);
      ctx.fillStyle = `hsl(${hueDeg} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%)`;
    }
    ctx.beginPath();
    ctx.moveTo(f.x0, f.y0);
    ctx.lineTo(f.x1, f.y1);
    ctx.lineTo(f.x2, f.y2);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Deterministic first view for a reading: yaw from the seed (FR-10 — same
 * words + seed → same initial angle), pitch from the decoded pose.
 */
export function initialView(drawSeed: number, sdf: SdfParams): ProjectionView {
  const t = Math.sin(drawSeed * 12.9898) * 43758.5453;
  let frac = t - Math.floor(t);
  if (frac < 0) frac += 1;
  return {
    yaw: frac * Math.PI * 2,
    pitch: clamp(sdf.pose.pitch ?? 0, -1.15, 1.15),
  };
}