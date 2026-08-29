/**
 * Generation (spec §3.3 / ADR-4): latent diffusion over z ∈ R^64, conditioned
 * on c = concat(e, q) ∈ R^400. Fully implementable math lives here; the
 * *denoiser* is an injected callable so the sampler is unit-testable with a
 * fake before binaries land.
 *
 * Bindings honoured:
 *  - c = concat(e, q) — pure (FR-3(b): q measurably conditions generation).
 *  - 25-step DDIM; η = drift (d ∈ [0,1]) — d=0 deterministic, d=1 ancestral.
 *  - Canonical d=0 (AMEND-1): the initial latent is a FIXED canonical point,
 *    seed-independent; the seeded PRNG enters only through step-noise (zero
 *    at η=0) and through multi-seed alternates at d>0.
 *  - Seed discipline (FR-8/9/10): PRNG = xoshiro256** over SHA-256(text|drift|seed);
 *    alternates = seeds s … s+3. No Math.random in this module.
 *
 * The conditioning MLP (2×256 Swish+LayerNorm → c_emb ∈ R^128) lives INSIDE the
 * exported denoiser ONNX (input `c` (400), tensor `t` (1), tensor `x` (64);
 * output ε (64)). The train script mirrors that export contract.
 */

import type { ModelManifest } from '../types';
import { ModelMissingError } from '../types';
import { LazySession, requireModelFile } from './models';
import { ortSessionOptions } from './ortSession';
import { createSeededRng, SeededRng } from './seededRng';
import * as ort from 'onnxruntime-web';

export const LATENT_DIM = 64;
export const COND_DIM = 400; // e 384 + q 16
export const TOTAL_TIMESTEPS = 1000; // training schedule length (cosine β)
export const DDIM_STEPS = 25; // sampling steps
export const ALTERNATE_COUNT = 3; // FR-9: seeds s+1 … s+3

/**
 * Canonical d=0 initial latent (AMEND-1): a fixed point, seed-independent —
 * the community centre the deterministic trajectory returns to. Scale coupling
 * with the trained latent space is owned by scripts/train_generator.py (§3.3).
 */
export const CANONICAL_D0_LATENT: Float32Array = new Float32Array(LATENT_DIM);

// ── cosine β schedule (Nichol & Dhariwal), T=1000 ─────────────────────────────

function cosineAlphaBar(t: number, total = TOTAL_TIMESTEPS, s = 0.008): number {
  const x = ((t / total + s) / (1 + s)) * (Math.PI / 2);
  const c = Math.cos(x);
  const f = c * c;
  const norm = Math.cos((s / (1 + s)) * (Math.PI / 2));
  return f / (norm * norm);
}

/** Descending deterministic timestep list, e.g. [999, …, 0] for 25/1000. */
export function ddimTimesteps(numSteps = DDIM_STEPS, total = TOTAL_TIMESTEPS): number[] {
  const ts: number[] = [];
  for (let i = 0; i < numSteps; i += 1) {
    ts.push(Math.round(((numSteps - 1 - i) * (total - 1)) / (numSteps - 1)));
  }
  return ts;
}

// ── Conditioning: pure concat(e, q) → c ∈ R^400 (model-independent) ──────────

export function buildConditioning(e: Float32Array, q: Float32Array): Float32Array {
  if (e.length !== 384) throw new Error(`buildConditioning: e must be 384-d, got ${e.length}`);
  if (q.length !== 16) throw new Error(`buildConditioning: q must be 16-d, got ${q.length}`);
  const c = new Float32Array(384 + 16);
  c.set(e, 0);
  c.set(q, 384);
  return c;
}

// ── Denoiser contract ─────────────────────────────────────────────────────────

/**
 * Predicts the noise ε_t given the noised latent x_t and the condition c.
 * Async-tolerant so the real ONNX session can run per step; fake denoisers in
 * tests may return plain Float32Array.
 */
export interface Denoiser {
  predictNoise(xT: Float32Array, t: number, c: Float32Array): Float32Array | Promise<Float32Array>;
}

/** η = drift — linear mapping, bounded to [0,1] (FR-8). */
export function etaFromDrift(drift: number): number {
  const d = Math.min(1, Math.max(0, drift));
  return d;
}

function sampleGaussian(dim: number, rng: SeededRng): Float32Array {
  const out = new Float32Array(dim);
  for (let i = 0; i < dim; i += 1) out[i] = rng.nextGaussian();
  return out;
}

/**
 * One 25-step DDIM trajectory (Song et al. 2020, discrete form). η = drift:
 *  - η=0 → sigma=0 on every step → deterministic (no noise draws at all).
 *  - η>0 → each step adds seeded Gaussian noise scaled by sigma.
 * Deterministic for a fixed (init, seed, drift, denoiser).
 */
export async function ddimSampleLatent(
  init: Float32Array,
  c: Float32Array,
  eta: number,
  rng: SeededRng,
  denoiser: Denoiser,
): Promise<Float32Array> {
  const timesteps = ddimTimesteps(DDIM_STEPS, TOTAL_TIMESTEPS);
  let x = new Float32Array(init);

  for (let i = 0; i < timesteps.length; i += 1) {
    const t = timesteps[i] ?? 0;
    const tPrev = i + 1 < timesteps.length ? (timesteps[i + 1] ?? 0) : Math.max(0, t - 1);

    const eps = await denoiser.predictNoise(x, t, c);
    if (eps.length !== LATENT_DIM) {
      throw new Error(`denoiser returned ${eps.length}-d ε, expected ${LATENT_DIM}`);
    }

    const ab = cosineAlphaBar(t);
    const abPrev = cosineAlphaBar(tPrev);
    const predX0 = new Float32Array(LATENT_DIM);
    for (let d = 0; d < LATENT_DIM; d += 1) {
      predX0[d] =
        ((x[d] ?? 0) - Math.sqrt(Math.max(0, 1 - ab)) * (eps[d] ?? 0)) / Math.sqrt(Math.max(ab, 1e-8));
    }

    if (tPrev <= 0) {
      x = predX0;
      break;
    }

    const sigma =
      eta *
      Math.sqrt((1 - abPrev) / Math.max(1 - ab, 1e-8)) *
      Math.sqrt(Math.max(0, 1 - ab / Math.max(abPrev, 1e-8)));
    const dir = Math.sqrt(Math.max(0, 1 - abPrev - sigma * sigma));

    // Seeded noise enters ONLY through step-noise; at η=0 sigma is zero and we
    // skip the draw entirely (the RNG stream stays untouched at d=0 — AMEND-1).
    const noise = sigma > 1e-12 ? sampleGaussian(LATENT_DIM, rng) : CANONICAL_D0_LATENT;

    const next = new Float32Array(LATENT_DIM);
    for (let d = 0; d < LATENT_DIM; d += 1) {
      next[d] =
        Math.sqrt(Math.max(abPrev, 1e-8)) * (predX0[d] ?? 0) +
        dir * (eps[d] ?? 0) +
        sigma * (noise[d] ?? 0);
    }
    x = next;
  }
  return x;
}

// ── Public surface ────────────────────────────────────────────────────────────

export interface GenerateParams {
  text: string; // raw prompt — used ONLY to derive the seed bytes, never transmitted
  e: Float32Array;
  q: Float32Array;
  drift: number;
  seed: number;
  denoiser: Denoiser;
}

/** Primary latent z (64-d) for a run. */
export async function generatePrimary(p: GenerateParams): Promise<Float32Array> {
  const c = buildConditioning(p.e, p.q);
  const eta = etaFromDrift(p.drift);
  const rng = await createSeededRng(`${p.text}|${p.drift}|${p.seed}`);
  return ddimSampleLatent(CANONICAL_D0_LATENT, c, eta, rng, p.denoiser);
}

/**
 * Primary + FR-9 alternates: seeds s, s+1, s+2, s+3 with independent PRNGs.
 * Identical params ⇒ identical distribution, bit-for-bit (FR-9/FR-10).
 */
export async function generateDistribution(
  p: GenerateParams,
  alternates = ALTERNATE_COUNT,
): Promise<Float32Array[]> {
  const c = buildConditioning(p.e, p.q);
  const eta = etaFromDrift(p.drift);
  const out: Float32Array[] = [];
  for (let a = 0; a <= alternates; a += 1) {
    const seed = p.seed + a;
    const rng = await createSeededRng(`${p.text}|${p.drift}|${seed}`);
    out.push(await ddimSampleLatent(CANONICAL_D0_LATENT, c, eta, rng, p.denoiser));
  }
  return out;
}

// ── Real ONNX adapter (lazy, ModelMissingError when absent) ───────────────────

/**
 * Denoiser backed by denoiser-v1-int8.onnx. Inputs: x (64), t (1, normalised
 * 0..1 = timestep / T_total), c (400). Output: ε (64) — the c_emb conditioning
 * MLP (2×256 Swish+LayerNorm → 128) is part of this exported graph (spec §3.3).
 */
export class OnnxDenoiser implements Denoiser {
  private readonly session: LazySession<ort.InferenceSession>;
  private readonly manifestRef: ModelManifest;

  constructor(manifest: ModelManifest) {
    this.manifestRef = manifest;
    this.session = new LazySession<ort.InferenceSession>(() => this.createSession());
  }

  private createSession(): Promise<ort.InferenceSession> {
    const file = requireModelFile(this.manifestRef.artifacts.denoiser, 'denoiser');
    return ort.InferenceSession.create(file, ortSessionOptions());
  }

  async predictNoise(xT: Float32Array, t: number, c: Float32Array): Promise<Float32Array> {
    const session = await this.session.get().catch((err: unknown) => {
      if (err instanceof ModelMissingError) throw err;
      throw new ModelMissingError('denoiser', `denoiser session failed: ${(err as Error).message}`);
    });
    const normT = new Float32Array([t / TOTAL_TIMESTEPS]);
    const feeds: Record<string, ort.Tensor> = {
      x: new ort.Tensor('float32', new Float32Array(xT), [1, LATENT_DIM]),
      t: new ort.Tensor('float32', normT, [1]),
      c: new ort.Tensor('float32', new Float32Array(c), [1, COND_DIM]),
    };
    const output = await session.run(feeds);
    const eps = new Float32Array(LATENT_DIM);
    const data = (output[session.outputNames[0]!] as ort.Tensor).data as Float32Array;
    for (let d = 0; d < LATENT_DIM; d += 1) eps[d] = data[d] ?? 0;
    return eps;
  }
}