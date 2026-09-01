/**
 * "Make it yours" — the human's hand on the machine's reading (FR-16 "shapes a
 * form"; C6 convention-crystallizer; the Mapper returned).
 *
 * The machine proposes a reading (`base` = the decoded+retuned SdfParams); the
 * visitor *tunes it within the same vocabulary* (voices / separation / lean) —
 * not free-drawing, but handling the arbitrary parameters themselves (C1:
 * arbitrariness made visible by being movable). `DEFAULT_TUNE` = the machine's
 * read (the identity). The tune state IS the delta from the machine's proposal
 * — the direction the human pushed the reading, which is the refinement field
 * the aligner (D4) learns from.
 */

import type { SdfParams } from '../types';
import { clamp, lerp } from '../lib/math';

export interface TuneState {
  /** 0..1 — how much the reading speaks as ONE voice (0) vs its spread (1). 0.5 = the machine's balance. */
  voices: number;
  /** 0..1 — how the parts sit: held together / overlapping (0) vs spread apart (1). 0.5 = the machine's. */
  separation: number;
  /** -1..1 — the lean/tilt of the whole reading. 0 = upright. */
  lean: number;
}

export const DEFAULT_TUNE: TuneState = { voices: 0.5, separation: 0.5, lean: 0 };

export function dominantIndex(w: readonly number[]): number {
  let d = 0;
  for (let i = 1; i < w.length; i += 1) if ((w[i] ?? 0) > (w[d] ?? 0)) d = i;
  return d;
}

function tuneWeights(w: readonly number[], voices: number): number[] {
  // voices 0.5 -> identity (p=1); voices 1 -> flatten (more voices surface);
  // voices 0 -> sharpen to one clear voice.
  const p = clamp(1 - (voices - 0.5) * 2, 0.55, 2.5);
  if (Math.abs(p - 1) < 1e-9) return Array.from(w); // neutral = the machine's read, exactly
  const powered = w.map((x) => Math.pow(Math.max(x, 0), p));
  const sum = powered.reduce((s, v) => s + v, 0);
  if (sum <= 0) return Array.from(w);
  return powered.map((v) => v / sum);
}

function tuneParts(base: SdfParams, separation: number): SdfParams['parts'] {
  const dom = dominantIndex(base.weights);
  const domOff = base.parts[dom]?.offset ?? [0, 0, 0];
  // separation 0.5 -> identity (f=1); 0 -> pull the parts in; 1 -> spread out.
  const f = lerp(0.4, 1.6, separation);
  if (Math.abs(f - 1) < 1e-9) return base.parts; // neutral = the machine's read, exactly
  return base.parts.map((p, i) => {
    if (i === dom) return p;
    const off = p.offset;
    return {
      ...p,
      offset: [
        (domOff[0] ?? 0) + (off[0] - (domOff[0] ?? 0)) * f,
        (domOff[1] ?? 0) + (off[1] - (domOff[1] ?? 0)) * f,
        (domOff[2] ?? 0) + (off[2] - (domOff[2] ?? 0)) * f,
      ] as [number, number, number],
    };
  });
}

function tunePose(pose: SdfParams['pose'], lean: number): SdfParams['pose'] {
  return {
    yaw: pose.yaw,
    pitch: clamp((pose.pitch ?? 0) + lean * 0.5, -1.2, 1.2),
    roll: (pose.roll ?? 0) + lean * 0.4,
  };
}

/** Apply the visitor's hand to the machine's reading. Pure; identity at DEFAULT_TUNE. */
export function tuneSdf(base: SdfParams, t: TuneState): SdfParams {
  return {
    ...base,
    weights: tuneWeights(base.weights, t.voices),
    parts: tuneParts(base, t.separation) as SdfParams['parts'],
    pose: tunePose(base.pose, t.lean),
  };
}

/** Human-readable "your hand moved: …" — the direction pushed from the proposal. */
export function tuneSummary(t: TuneState): string {
  const parts: string[] = [];
  const dv = t.voices - 0.5;
  if (Math.abs(dv) > 0.04) parts.push(dv < 0 ? 'more one thing' : 'more voices');
  const ds = t.separation - 0.5;
  if (Math.abs(ds) > 0.04) parts.push(ds < 0 ? 'parts closer' : 'parts apart');
  if (Math.abs(t.lean) > 0.04) parts.push(t.lean > 0 ? 'leaning' : 'counter-leaning');
  return parts.length ? parts.join(' · ') : 'unchanged';
}
