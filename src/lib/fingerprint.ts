/**
 * Deterministic SHA-256 helpers (Web Crypto). Used for the run fingerprint
 * `sha256(text|drift|seed)` (QR-6) and for seed-material derivation into the
 * seeded PRNG (FR-10). Deterministic across browsers and Node ≥ 20.
 */

const textEncoder = new TextEncoder();

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c || typeof c.subtle === 'undefined') {
    throw new Error('Web Crypto (crypto.subtle) is unavailable in this environment');
  }
  return c.subtle;
}

export async function sha256Bytes(data: string | Uint8Array): Promise<Uint8Array> {
  const raw = typeof data === 'string' ? textEncoder.encode(data) : data;
  const digest = await subtle().digest('SHA-256', raw as BufferSource);
  return new Uint8Array(digest);
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = await sha256Bytes(data);
  return bytesToHex(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/** The exact seed material string the whole pipeline derives from (spec §3.3). */
export function fingerprint(text: string, drift: number, seed: number): Promise<string> {
  return sha256Hex(`${text}|${drift}|${seed}`);
}