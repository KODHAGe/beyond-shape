/**
 * Decode (spec §3.3): latent z ∈ R^64 → SdfParams (8-primitive smooth-min
 * blend weights + per-part params + palette/material + pose). The decoder
 * boundary is an ONNX session (decoder-v1); the validation/clamping is pure
 * and unit-testable without binaries.
 *
 * ONNX output contract (mirrored by scripts/train_generator.py export):
 *   weights       [1,8]   raw logits     → softmax → w ∈ R^8 (sum 1)
 *   blend_radius  [1,1]   → clamp [0.05, 0.5]
 *   parts         [1,64]  8 prims × [sx,sy,sz, ox,oy,oz, twist, displacement]
 *   material      [1,7]   hue,sat,light,roughness,metalness,clearcoat,emissive
 *   motion        [1,2]   breathe, sway
 *   pose          [1,3]   yaw, pitch, roll
 *
 * Validity boundaries are hard-clamped; PALETTE bias (sat/light) is a soft
 * bias, never a clamp (QR-4/A6 — "pastel is a field, not a filter").
 */

import type { ModelManifest, SdfParams } from '../types';
import { ModelMissingError } from '../types';
import { LazySession, requireModelFile } from './models';
import { clamp, softBias, softmax, wrap01, wrapTwoPi } from '../lib/math';
import * as ort from 'onnxruntime-web';

export const PRIMITIVE_COUNT = 8;
export const BLEND_RADIUS_RANGE: readonly [number, number] = [0.05, 0.5];
export const PASTEL_SAT_RANGE: readonly [number, number] = [0.1, 0.7];
export const PASTEL_LIGHT_RANGE: readonly [number, number] = [0.5, 0.95];

export interface DecoderRaw {
  weights: number[]; // 8 raw logits
  blendRadius: number;
  parts: number[]; // 64 flattened
  material: number[]; // 7
  motion: number[]; // 2
  pose: number[]; // 3
}

interface PartParams {
  scale: [number, number, number];
  offset: [number, number, number];
  twist: number;
  displacement: number;
}

function parsePart(raw: number[], base: number): PartParams {
  const sx = clamp(raw[base + 0] ?? 1, 0.05, 3);
  const sy = clamp(raw[base + 1] ?? 1, 0.05, 3);
  const sz = clamp(raw[base + 2] ?? 1, 0.05, 3);
  const ox = clamp(raw[base + 3] ?? 0, -1.5, 1.5);
  const oy = clamp(raw[base + 4] ?? 0, -1.5, 1.5);
  const oz = clamp(raw[base + 5] ?? 0, -1.5, 1.5);
  const twist = clamp(raw[base + 6] ?? 0, -Math.PI, Math.PI);
  const displacement = clamp(raw[base + 7] ?? 0, 0, 0.5);
  return {
    scale: [sx, sy, sz],
    offset: [ox, oy, oz],
    twist,
    displacement,
  };
}

/**
 * Raw decoder outputs → validated, clamped SdfParams. Pure function used by
 * the session wrapper and by unit tests.
 */
export function decodeRawToSdfParams(raw: DecoderRaw): SdfParams {
  if (raw.weights.length !== PRIMITIVE_COUNT) {
    throw new RangeError(`decoder: expected 8 weights, got ${raw.weights.length}`);
  }
  const weights = softmax(raw.weights);

  const parts: PartParams[] = [];
  for (let i = 0; i < PRIMITIVE_COUNT; i += 1) {
    parts.push(parsePart(raw.parts, i * 8));
  }

  const [satLo, satHi] = PASTEL_SAT_RANGE;
  const [lightLo, lightHi] = PASTEL_LIGHT_RANGE;

  return {
    weights,
    blendRadius: clamp(raw.blendRadius, BLEND_RADIUS_RANGE[0], BLEND_RADIUS_RANGE[1]),
    parts: parts as SdfParams['parts'],
    material: {
      hue: wrap01(raw.material[0] ?? 0),
      // These are BIASES toward the pastel band, not hard clamps (QR-4/A6).
      saturation: clamp(softBias(raw.material[1] ?? 0.4, satLo, satHi), 0, 1),
      lightness: clamp(softBias(raw.material[2] ?? 0.7, lightLo, lightHi), 0, 1),
      roughness: clamp(raw.material[3] ?? 0.5, 0, 1),
      metalness: clamp(raw.material[4] ?? 0, 0, 1),
      clearcoat: clamp(raw.material[5] ?? 0, 0, 1),
      emissive: clamp(raw.material[6] ?? 0, 0, 1),
    },
    motion: {
      breathe: clamp(raw.motion[0] ?? 0, 0, 1),
      sway: clamp(raw.motion[1] ?? 0, 0, 1),
    },
    pose: {
      yaw: wrapTwoPi(raw.pose[0] ?? 0),
      pitch: clamp(raw.pose[1] ?? 0, -Math.PI / 2, Math.PI / 2),
      roll: wrapTwoPi(raw.pose[2] ?? 0),
    },
  };
}

/** Lazy ONNX decoder boundary → SdfParams (ModelMissingError when absent). */
export class Decoder {
  private readonly session: LazySession<ort.InferenceSession>;
  private readonly manifestRef: ModelManifest;

  constructor(manifest: ModelManifest) {
    this.manifestRef = manifest;
    this.session = new LazySession<ort.InferenceSession>(() => this.createSession());
  }

  private createSession(): Promise<ort.InferenceSession> {
    const file = requireModelFile(this.manifestRef.artifacts.decoder, 'decoder');
    return ort.InferenceSession.create(file, {
      executionProviders: ['webgpu', 'wasm'],
    });
  }

  async decode(z: Float32Array): Promise<SdfParams> {
    if (z.length !== 64) throw new RangeError(`decoder: expected 64-d latent, got ${z.length}`);
    const session = await this.session.get().catch((err: unknown) => {
      if (err instanceof ModelMissingError) throw err;
      throw new ModelMissingError('decoder', `decoder session failed: ${(err as Error).message}`);
    });
    const feeds: Record<string, ort.Tensor> = {
      z: new ort.Tensor('float32', new Float32Array(z), [1, 64]),
    };
    const output = await session.run(feeds);
    const names = session.outputNames;

    const dataOf = (name: string): Float32Array =>
      ((output[name] as ort.Tensor).data as Float32Array) ?? new Float32Array(0);

    const weightsOut = dataOf(names[0] ?? 'weights');
    const radiusOut = dataOf(names[1] ?? 'blend_radius');
    const partsOut = dataOf(names[2] ?? 'parts');
    const materialOut = dataOf(names[3] ?? 'material');
    const motionOut = dataOf(names[4] ?? 'motion');
    const poseOut = dataOf(names[5] ?? 'pose');

    return decodeRawToSdfParams({
      weights: Array.from(weightsOut.slice(0, 8)),
      blendRadius: radiusOut[0] ?? 0.15,
      parts: Array.from(partsOut.slice(0, 64)),
      material: Array.from(materialOut.slice(0, 7)),
      motion: Array.from(motionOut.slice(0, 2)),
      pose: Array.from(poseOut.slice(0, 3)),
    });
  }
}