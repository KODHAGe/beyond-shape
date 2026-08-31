/**
 * Register retune layer — the aesthetic lab's "spindle".
 *
 * A register is a COHERENT COMPOUND, not a slider menu: a pure function that
 * retunes an already-decoded SdfParams toward a register's way of inhabiting
 * the consensus ⇄ edge axis. Every movement is derived from the reading's own
 * decoded values (weights, blend radius, offsets, twist, displacement,
 * material, pose) — no gesture libraries, no new semantic parameters, no
 * imported poetry (CONCEPT §5: the constraint space is the hidden author).
 *
 * On the spindle:
 *   - drift → 0 (consensus): the reading is ONE clean, legible, resting object;
 *     all register-specific material play is muted, so every register shows the
 *     same centre (C2: meaning is the centre).
 *   - drift → 1 (edge): the register reveals itself. CLAY welds the parts and
 *     goes matte/restful; COLLISION shrinks the blend radius so the invented
 *     solids meet at visible seams, detaches them outward, and turns glossy —
 *     the arbitrariness of the sign becomes visible in the collisions (C1).
 */

import type { SdfParams } from '../types';
import { clamp, lerp, softBias, wrapTwoPi } from '../lib/math';

export type RegisterKind = 'clay' | 'collision';

export interface RegisterSpec {
  kind: RegisterKind;
  name: string;
  blurb: string;
  /** blend-radius multiplier applied at the edge (clay >1 welds, collision <1 seams). */
  weld: number;
  /** roughness target at the edge (0 = glossy, 1 = matte). */
  gloss: number;
  /** clearcoat target at the edge. */
  clearcoatTarget: number;
  /** out-wards gap (world units) at drift 1 — how far the reading's other
   *  parts orbit the dominant one (see separation in `retune`). */
  gapMax: number;
  /** material saturation shaping. */
  satMode: 'bias' | 'gain';
  satAmount: number;
  /** lightness shift at the edge (positive = brighter, negative = deeper). */
  lightShift: number;
  /** emissive gain at the edge. */
  emissiveGain: number;
  /** dominant-primitive displacement amplification at the edge. */
  dispAmp: number;
  /** non-dominant twist amplification at the edge. */
  twistAmp: number;
  /** pose teeter amplitude at the edge (the reading leans by its own hue). */
  tilt: number;
}

export const REGISTERS: Record<RegisterKind, RegisterSpec> = {
  clay: {
    kind: 'clay',
    name: 'clay',
    blurb: 'welded · matte · restful',
    weld: 1.8,
    gapMax: 0.35,
    gloss: 0.88,
    clearcoatTarget: 0.05,
    satMode: 'bias',
    satAmount: 0.55, // pulls saturation into the pastel band (soft bias, never a clamp)
    lightShift: 0.05,
    emissiveGain: 1.4,
    dispAmp: 0.6,
    twistAmp: 0.25,
    tilt: 0.12,
  },
  collision: {
    kind: 'collision',
    name: 'collision',
    blurb: 'seamed · glossy · teetering',
    weld: 0.45,
    gapMax: 1.2,
    gloss: 0.16,
    clearcoatTarget: 0.8,
    satMode: 'gain',
    satAmount: 1.9, // vivid at the edge; quiet at the centre
    lightShift: -0.09,
    emissiveGain: 7,
    dispAmp: 1.5,
    twistAmp: 1.0,
    tilt: 0.55,
  },
};

/** Spindle base: sharpen the blend weights toward the dominant primitive at
 *  the consensus end (one clear voice), relax to the decoded distribution at
 *  the edge (parts already show). `richness` is the STRUCTURE signal (0..1):
 *  long readings keep a higher exponent floor so their latent voices can speak
 *  instead of collapsing into one part — "richness follows structure," a
 *  visible machine grammar (see structureRichness). Derives only from the
 *  decoded weights and the length structure. */
function blendWeights(weights: readonly number[], edginess: number, richness: number): number[] {
  // Richness lowers the exponent itself (flatten), independent of drift:
  //   richness 0 → [2.2 … 1.0] as before (length-blind);
  //   richness 1 → [0.55 … 0.35] — the reading's silent voices can speak all
  //   along the spindle instead of collapsing to one part.
  const p = clamp(lerp(2.2 - 1.65 * richness, 1.0 - 0.65 * richness, edginess), 0.3, 2.5);
  const powered = weights.map((w) => Math.pow(Math.max(w, 0), p));
  const sum = powered.reduce((s, v) => s + v, 0);
  if (sum <= 0) return weights.slice();
  return powered.map((v) => v / sum);
}

/**
 * The structure convention, stated plainly: a reading's richness scales with
 * its length, from 0 at ~3 tokens to 1 at ~25+. Pure and labelable — this is
 * the machine's grammar, visible in the UI ("richness follows structure"),
 * not a hidden thumb on the scales.
 */
export function structureRichness(tokens: number): number {
  return clamp((tokens - 3) / 22, 0, 1);
}

function clampVec(v: [number, number, number], lo: number, hi: number): [number, number, number] {
  return [clamp(v[0], lo, hi), clamp(v[1], lo, hi), clamp(v[2], lo, hi)];
}

/** Retune one decoded reading for a register at a drift (0..1) and a
 *  structure richness (0..1, default 0 = length-blind). Pure. */
export function retune(form: SdfParams, kind: RegisterKind, drift: number, richness = 0): SdfParams {
  const spec = REGISTERS[kind];
  const e = clamp(drift, 0, 1);
  const rich = clamp(richness, 0, 1);
  const m = form.material;

  // Dominant primitive (the reading's clearest voice), by weight only.
  let dom = 0;
  for (let i = 1; i < form.weights.length; i += 1) {
    if ((form.weights[i] ?? 0) > (form.weights[dom] ?? 0)) dom = i;
  }
  const domW = form.weights[dom] ?? 1;
  const domOffset = form.parts[dom]?.offset ?? [0, 0, 0];

  const weights = blendWeights(form.weights, e, rich);

  /**
   * SEPARATION — revive "distance between shapes" as a real variable.
   * Decoded offsets cluster at ~0 (measured: means 0.01–0.06), so parts
   * physically occupy the same point and every form reads overlaid/merged.
   * The registration: the DOMINANT part holds the centre; every other part
   * is pushed outward ALONG ITS LEARNED DECODED DIRECTION by
   *   extension = drift × gapMax × (1 − 0.6·weight-share)
   * so the direction comes from the reading, the spacing from the register's
   * grammar (a visible convention, not smuggled semantics — C1). Parts whose
   * decoded offset sits exactly on the anchor get a deterministic golden-angle
   * bearing instead (a settlement rule of the grammar).
   */
  const parts = form.parts.map((p, idx) => {
    const nonDom = 1 - (form.weights[idx] ?? 0);
    const share = form.weights[idx] ?? 0;
    const dx = (p.offset[0] ?? 0) - (domOffset[0] ?? 0);
    const dy = (p.offset[1] ?? 0) - (domOffset[1] ?? 0);
    const dz = (p.offset[2] ?? 0) - (domOffset[2] ?? 0);
    const len = Math.hypot(dx, dy, dz);
    let nx: number;
    let ny: number;
    let nz: number;
    if (len > 1e-6) {
      nx = dx / len;
      ny = dy / len;
      nz = dz / len;
    } else {
      // On the anchor: golden-angle bearing, deterministic per part index.
      const phi = idx * 2.3999632297;
      nx = Math.cos(phi);
      ny = 0.35 * Math.sin(phi * 0.5);
      nz = Math.sin(phi);
    }
    const extension = (idx === dom ? 0 : e * spec.gapMax * (1 - 0.6 * share)) * lerp(1, 1.6, rich);
    const offset = clampVec(
      [
        (domOffset[0] ?? 0) + nx * extension,
        (domOffset[1] ?? 0) + ny * extension,
        (domOffset[2] ?? 0) + nz * extension,
      ],
      -1.5,
      1.5,
    );
    return {
      scale: p.scale,
      offset,
      twist: clamp(
        (p.twist ?? 0) * (1 + e * spec.twistAmp * nonDom),
        -Math.PI,
        Math.PI,
      ),
      displacement: clamp(
        (p.displacement ?? 0) * (1 + e * spec.dispAmp * (idx === dom ? 1 : 0.35)),
        0,
        0.5,
      ),
    };
  });

  // Material: register differences are gated by drift so the centre is shared.
  let saturation: number;
  if (spec.satMode === 'bias') {
    const biased = softBias(m.saturation, 0.12, spec.satAmount);
    saturation = clamp(lerp(m.saturation, biased, e), 0, 1);
  } else {
    saturation = clamp(m.saturation * lerp(1, spec.satAmount, e), 0, 1);
  }

  const material = {
    hue: m.hue,
    saturation,
    lightness: clamp(lerp(m.lightness, m.lightness + spec.lightShift, e * 0.7), 0, 1),
    roughness: clamp(lerp(m.roughness, spec.gloss, e * 0.75), 0.02, 1),
    metalness: clamp(m.metalness * (spec.gloss > 0.5 ? 0.3 : 1), 0, 1),
    clearcoat: clamp(lerp(m.clearcoat, spec.clearcoatTarget, e), 0, 1),
    emissive: clamp(m.emissive * (1 + e * spec.emissiveGain), 0, 1),
  };

  const pose = {
    yaw: form.pose.yaw,
    pitch: clamp(
      (form.pose.pitch ?? 0) + (domW - 0.5) * 0.7 * spec.tilt * e,
      -1.4,
      1.4,
    ),
    roll: wrapTwoPi((form.pose.roll ?? 0) + (m.hue - 0.5) * spec.tilt * e),
  };

  return {
    weights,
    // The spindle turns the SAME blend radius one way or the other — clamping
    // to the decode's own valid band so the session topology never breaks.
    blendRadius: clamp(form.blendRadius * lerp(1, spec.weld, e), 0.05, 0.5),
    // Blend MODE is the machine's surface quality — passed through untouched.
    // Drift moves space/seam/materials; it does not overwrite the decoded mode.
    blendMode: form.blendMode ?? 'soft',
    parts: parts as SdfParams['parts'],
    material,
    motion: form.motion,
    pose,
  };
}