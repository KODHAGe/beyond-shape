/**
 * Small deterministic math helpers shared across the typed core. Pure functions
 * only — no RNG, no IO. (Not in the spec module list; a minimal shared leaf.)
 */

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-arc circular hue interpolation on [0, 1). */
export function lerpHue(h1: number, h2: number, t: number): number {
  const a = wrap01(h1);
  const b = wrap01(h2);
  let d = b - a;
  if (d > 0.5) d -= 1;
  else if (d < -0.5) d += 1;
  return wrap01(a + d * t);
}

/** Standard cubic ease-out curve for natural deceleration. */
export function easeOutCubic(t: number): number {
  const inv = 1 - clamp(t, 0, 1);
  return 1 - inv * inv * inv;
}

/** Softmax over a number array (used for the 8 blend weights). */
export function softmax(values: readonly number[]): number[] {
  const max = values.reduce((m, v) => (v > m ? v : m), -Infinity);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((s, v) => s + v, 0);
  return exps.map((v) => (sum > 0 ? v / sum : 1 / values.length));
}

export function wrap01(x: number): number {
  const m = x % 1;
  return m < 0 ? m + 1 : m;
}

export function wrapTwoPi(x: number): number {
  const m = x % (2 * Math.PI);
  return m < 0 ? m + 2 * Math.PI : m;
}

/**
 * A bias, not a clamp (QR-4 / A6: "pastel is a field, not a filter").
 * Pulls a value toward [lo, hi] through a bounded sigmoid; values can still
 * escape the band (edge-colour is legal), they are just biased toward it.
 */
export function softBias(x: number, lo: number, hi: number): number {
  const center = (lo + hi) / 2;
  const radius = (hi - lo) / 2 + 0.18; // soft shoulder outside the band
  const z = (x - center) / radius;
  const squashed = z / (1 + Math.abs(z)); // soft sign-preserving squash
  return center + radius * squashed;
}

/** Cosine similarity of two equal-length vectors. Bounded to [-1, 1]. */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = a.length;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  const c = dot / denom;
  return clamp(c, -1, 1);
}