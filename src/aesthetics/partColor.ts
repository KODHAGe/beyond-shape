/**
 * Per-part colouring ("more colour", each voice in its own fabric).
 *
 * Pure and deterministic: every part i of a reading carries its own
 * hue/sat/light derived ONLY from the reading's own decoded material and the
 * part index (a visible convention — never a smuggled meaning). Surface
 * colour at a point = the influence-weighted average of part colours (soft
 * morph) or the owning part's colour (hard cut), computed in RGB to avoid
 * hue-wrap averaging.
 */

import type { SdfParams } from '../types';
import { clamp, wrap01 } from '../lib/math';

export interface Rgb01 {
  r: number;
  g: number;
  b: number;
}

/** HSL (hue 0..1, sat/light 0..1) → RGB 0..1. Pure. */
export function hslToRgb01(hue01: number, sat: number, light: number): Rgb01 {
  const h = (((hue01 % 1) + 1) % 1) * 360;
  const s = clamp(sat, 0, 1);
  const l = clamp(light, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return { r: r + m, g: g + m, b: b + m };
}

/** A part's own colour — a gentle deterministic spread around the reading's hue.
 *  Hue is capped to ±0.12 (±43°) so the reading's hue stays the VISIBLE CENTRE
 *  of its parts (Round VI amendment 2): the part's identity is in its spread,
 *  never in jumping to an unrelated colour. Sat/light still carry gentle
 *  per-part variation (each voice in its own fabric). */
export function partRgb(sdf: SdfParams, i: number): Rgb01 {
  const m = sdf.material;
  const hue = wrap01(m.hue + partHueOffset(i));
  // Slightly MORE colour than the single-material read, still biased not clamped.
  const sat = clamp(m.saturation + 0.10 + ((i * 7) % 5) * 0.065, 0.05, 1);
  const light = clamp(m.lightness + ((i % 3) - 1) * 0.14, 0.2, 1);
  return hslToRgb01(hue, sat, light);
}

/** Deterministic, SIGNED, capped per-part hue offset (≤ ±0.12) around the
 *  reading's hue. The old formula could wrap a full colour circle and detach a
 *  part from its reading — the convention was present but undiscoverable. */
export function partHueOffset(i: number): number {
  const raw = (i * 13 + 5) % 29; // 0..28
  return ((raw / 28) - 0.5) * 0.24; // -0.12 .. +0.12
}

/** Influence-weighted average of part colours at a surface point. */
export function mergePartRgb(sdf: SdfParams, influence: ArrayLike<number>): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < influence.length; i += 1) {
    const w = influence[i] ?? 0;
    if (w <= 0) continue;
    const c = partRgb(sdf, i);
    r += c.r * w;
    g += c.g * w;
    b += c.b * w;
  }
  return [r, g, b];
}