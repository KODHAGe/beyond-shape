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
import { BertTokenizer } from './tokenizer';
import { ortSessionOptions } from './ortSession';
import * as ort from 'onnxruntime-web/wasm';

export const EMBED_DIM = 384;

/** Lazy in-memory WordPiece vocab (same-origin fetch, exempted by ci-checks). */
let tokenizerPromise: Promise<BertTokenizer> | null = null;

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
    return ort.InferenceSession.create(file, ortSessionOptions());
  }

  private maxTokens(): number {
    return this.manifestRef.artifacts.embedder.maxTokens ?? 256;
  }

  /** Returns the model's hidden dim (manifest dim ?: 384). */
  private hiddenDim(): number {
    return this.manifestRef.artifacts.embedder.dim ?? EMBED_DIM;
  }

  private async ensureTokenizer(): Promise<BertTokenizer> {
    if (!tokenizerPromise) {
      tokenizerPromise = BertTokenizer.fromFile(
        requireModelFile(this.manifestRef.artifacts.tokenizer, 'tokenizer'),
      );
    }
    return tokenizerPromise;
  }

  /**
   * Token count → the structure signal ("richness follows structure",
   * Implementation Spec Phase C §3). On-device WordPiece ids; deterministic
   * (FR-10); no text leaves the device (FR-5).
   */
  async tokenCount(text: string): Promise<number> {
    const tokenizer = await this.ensureTokenizer();
    return tokenizer.tokenize(text, this.maxTokens()).ids.length;
  }

  /**
   * text → e (384-d, L2-normalised mean-pooled last hidden state).
   * Truncates over maxTokens with a warning (spec §3.2).
   */
  async embed(text: string): Promise<Float32Array> {
    const maxTokens = this.maxTokens();
    const tokenizer = await this.ensureTokenizer();
    const { ids, truncated } = tokenizer.tokenize(text, maxTokens);
    if (truncated) console.warn(`embedder: truncated to ${maxTokens} tokens`);
    const seqLen = ids.length;

    const session = await this.session.get().catch((err: unknown) => {
      if (err instanceof ModelMissingError) throw err;
      throw new ModelMissingError(
        'embedder',
        `embedder session failed to initialise: ${(err as Error).message}`,
      );
    });

    const inputIds = new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, seqLen]);
    const attentionMask = new ort.Tensor('int64', BigInt64Array.from({ length: seqLen }, () => 1n), [
      1,
      seqLen,
    ]);
    const tokenTypeIds = new ort.Tensor('int64', BigInt64Array.from({ length: seqLen }, () => 0n), [
      1,
      seqLen,
    ]);
    const feeds: Record<string, ort.Tensor> = {
      input_ids: inputIds,
      attention_mask: attentionMask,
      token_type_ids: tokenTypeIds,
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