/**
 * Seeded PRNG — xoshiro256** (spec §3.3).
 *
 * All noise draws in the generative pipeline come from this PRNG, seeded by
 * `SHA-256(text|drift|seed)` (FR-8/FR-9/FR-10). The implementation uses BigInt
 * for the 64-bit xoshiro256** state so results are bit-identical across
 * browsers and Node — no float32/float64 pitfalls in the state arithmetic.
 *
 * The xoshiro family has a degenerate all-zero state; the constructor replaces
 * it with a fixed constant so an adversarial seed material can never dead-lock
 * the generator. nextFloat() uses the standard 53-bit Double mapping
 * (top 53 bits / 2^53) which is exactly reproducible.
 */

import { sha256Bytes } from '../lib/fingerprint';

const MASK64 = (1n << 64n) - 1n;
const TWO_POW_53 = 9007199254740992; // 2^53
const ALL_ZERO_FIX = 0x9e3779b97f4a7c15n; // derived from golden-ratio constant

function rotl(x: bigint, k: number): bigint {
  return ((x << BigInt(k)) | (x >> BigInt(64 - k))) & MASK64;
}

/** Little-endian read of 8 bytes → uint64 as BigInt. */
function bytesToUint64(bytes: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i -= 1) {
    v = (v << 8n) | BigInt(bytes[offset + i] ?? 0);
  }
  return v;
}

/** Derive the 256-bit seed bytes for a given seed material (spec §3.3). */
export async function deriveSeedBytes(seedMaterial: string): Promise<Uint8Array> {
  return sha256Bytes(seedMaterial);
}

export class SeededRng {
  private s: [bigint, bigint, bigint, bigint];

  /** Seed directly from ≥ 32 raw bytes (e.g. a SHA-256 digest). */
  constructor(seedBytes: Uint8Array) {
    if (seedBytes.length < 32) {
      throw new Error(`SeededRng needs ≥ 32 seed bytes, got ${seedBytes.length}`);
    }
    let s0 = bytesToUint64(seedBytes, 0);
    let s1 = bytesToUint64(seedBytes, 8);
    let s2 = bytesToUint64(seedBytes, 16);
    let s3 = bytesToUint64(seedBytes, 24);
    if (s0 === 0n && s1 === 0n && s2 === 0n && s3 === 0n) {
      // xoshiro256** is degenerate only at the all-zero state, but a zero s1
      // still gates the first output word to 0 — seed all four words with
      // distinct nonzero constants (SplitMix64 family values).
      s0 = ALL_ZERO_FIX;
      s1 = 0xbf58476d1ce4e5b9n;
      s2 = 0x94d049bb133111ebn;
      s3 = 0xd6e8feb86659fd93n;
    }
    this.s = [s0, s1, s2, s3];
  }

  /** One xoshiro256** step → 64-bit state update + generated 64-bit word (as BigInt). */
  private nextUint64(): bigint {
    const [s0, s1, s2, s3] = this.s;
    const result = rotl((s1 * 5n) & MASK64, 7) * 9n & MASK64;
    const t = (s1 << 17n) & MASK64;
    this.s[2] = s2 ^ s0;
    this.s[3] = s3 ^ s1;
    this.s[1] = s1 ^ this.s[2];
    this.s[0] = s0 ^ this.s[3];
    this.s[2] = this.s[2] ^ t;
    this.s[3] = rotl(this.s[3] as bigint, 45);
    return result;
  }

  /** Uniform float in [0, 1) with 53-bit resolution. */
  nextFloat(): number {
    const word = this.nextUint64();
    return Number(word >> 11n) / TWO_POW_53;
  }

  /** Uniform integer in [0, bound). Deterministic; bound must be ≥ 1. */
  nextInt(bound: number): number {
    if (!Number.isInteger(bound) || bound < 1) {
      throw new Error(`nextInt bound must be an integer ≥ 1, got ${bound}`);
    }
    return Math.floor(this.nextFloat() * bound);
  }

  /**
   * Standard-normal draw (Box–Muller over two seeded uniforms). Deterministic
   * for a fixed seed; guarded against u1 === 0 (log(0)).
   */
  nextGaussian(): number {
    const u1 = Math.max(this.nextFloat(), 1 / TWO_POW_53);
    const u2 = this.nextFloat();
    const r = Math.sqrt(-2 * Math.log(u1));
    return r * Math.cos(2 * Math.PI * u2);
  }

  /** Deterministic boolean helper (used by sampling sub-decisions). */
  nextBool(): boolean {
    return this.nextUint64() % 2n === 0n;
  }
}

/** Convenience: sha256(seedMaterial) → SeededRng, in one async step. */
export async function createSeededRng(seedMaterial: string): Promise<SeededRng> {
  return new SeededRng(await deriveSeedBytes(seedMaterial));
}