/**
 * Embedder boundary (ADR-5): all-MiniLM-L6-v2 int8 → e ∈ R^384.
 *
 * Skeleton class with the full on-device path typed out (lazy ONNX session,
 * token -> id -> mean-pool -> L2-normalise) plus a *placeholder* WordPiece
 * tokenizer. The scaffold manifest carries no binary, so getting a session
 * raises ModelMissingError — the loader throws with a clear dev message until
 * the artifacts exist. NO fetch here (spec §3.2 R-f): the session loads from
 * the same-origin path given by the manifest.
 */

import type { ModelManifest } from '../types';
import { ModelMissingError } from '../types';
import { LazySession, requireModelFile } from './models';
import * as ort from 'onnxruntime-web';

export const EMBED_DIM = 384;

/** Deterministic non-crypto hash (FNV-1a 32-bit) — placeholder token id source. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// All-MiniLM-L6-v2 is a WordPiece tokenizer over a 30522-token vocab, max
// position 256. The committed scaffold has no vocab artifact, so this is a
// whitespace + a-z/0-9 split that fingerprints unknown words into the vocab
// range. TODO(model): replace with the real WordPiece vocab shipped with the
// embedder artifact — this placeholder exists ONLY so the pipeline is typed
// and unit-testable before binaries land (spec §4: skeleton where bound).
function tokenizePlaceholder(text: string, maxTokens: number): number[] {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z0-9]+/g) ?? [];
  const ids: number[] = [];
  for (const word of words) {
    if (ids.length >= maxTokens) break;
    ids.push(fnv1a(word) % 30522);
  }
  if (ids.length === 0) ids.push(100); // [UNK]
  return ids;
}

export class Embedder {
  private readonly session: LazySession<ort.InferenceSession>;
  private readonly manifestRef: ModelManifest;

  constructor(manifest: ModelManifest) {
    this.manifestRef = manifest;
    this.session = new LazySession<ort.InferenceSession>(() => this.createSession());
  }

  private createSession(): Promise<ort.InferenceSession> {
    // requireModelFile throws ModelMissingError when the artifact is absent.
    const file = requireModelFile(this.manifestRef.artifacts.embedder, 'embedder');
    return ort.InferenceSession.create(file, {
      executionProviders: ['webgpu', 'wasm'],
    });
  }

  private maxTokens(): number {
    return this.manifestRef.artifacts.embedder.maxTokens ?? 256;
  }

  /** Returns the model's hidden dim (manifest dim ?: 384). */
  private hiddenDim(): number {
    return this.manifestRef.artifacts.embedder.dim ?? EMBED_DIM;
  }

  /**
   * text → e (384-d, L2-normalised mean-pooled last hidden state).
   * Truncates over maxTokens with a warning (spec §3.2).
   */
  async embed(text: string): Promise<Float32Array> {
    const maxTokens = this.maxTokens();
    const ids = tokenizePlaceholder(text, maxTokens);
    if (ids.length > maxTokens) {
      console.warn(`embedder: truncated ${ids.length} tokens to ${maxTokens}`);
    }
    const seqLen = Math.min(ids.length, maxTokens);

    const session = await this.session.get().catch((err: unknown) => {
      if (err instanceof ModelMissingError) throw err;
      throw new ModelMissingError(
        'embedder',
        `embedder session failed to initialise: ${(err as Error).message}`,
      );
    });

    const inputIds = new ort.Tensor('int64', BigInt64Array.from(ids.slice(0, seqLen), BigInt), [
      1,
      seqLen,
    ]);
    const attentionMask = new ort.Tensor('int64', BigInt64Array.from({ length: seqLen }, () => 1n), [
      1,
      seqLen,
    ]);
    const feeds: Record<string, ort.Tensor> = {
      input_ids: inputIds,
      attention_mask: attentionMask,
    };
    const output = await session.run(feeds);
    const hiddenTensor = output[session.outputNames[0]!] as ort.Tensor;
    const dims = hiddenTensor.dims;
    const data = hiddenTensor.data as Float32Array;
    const D = this.hiddenDim();
    const L = dims.length >= 2 ? (dims[dims.length - 2] as number) : seqLen;

    // Mean-pool over tokens (attention mask is all-ones here; shape [1, L, D]).
    const e = new Float32Array(D);
    for (let t = 0; t < L; t += 1) {
      const row = data.subarray(t * D, (t + 1) * D);
      for (let d = 0; d < D; d += 1) e[d] = (e[d] ?? 0) + (row[d] ?? 0);
    }
    normalize(e);
    return e;
  }
}

/** In-place L2 normalisation (FR-2: e is a point on the unit sphere). */
export function normalize(vec: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) sum += (vec[i] ?? 0) * (vec[i] ?? 0);
  const norm = Math.sqrt(sum);
  if (norm === 0) return;
  for (let i = 0; i < vec.length; i += 1) vec[i] = (vec[i] ?? 0) / norm;
}