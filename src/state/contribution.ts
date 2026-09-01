/**
 * Phase D Slice 1 — client contribution path (DR-1/DR-2/DR-3, FR-16/FR-17).
 *
 * The co-creation loop is LOCAL until the visitor explicitly opts in and
 * shares: nothing is transmitted by these helpers unless `submitContribution`
 * is called, and only with `consent_flag = 1` (which the edge re-verifies).
 */

import type { RunRecord, SdfParams } from '../types';

export type ContribGradient = 'accept' | 'adjust' | 'reject';

export interface ContributionPayload {
  contributor_anon_id: string;
  input_text: string;
  text_sha256: string;
  form_params: SdfParams;
  z: number[];
  drift: number;
  seed: number;
  gradient: ContribGradient;
  consent_flag: 0 | 1;
  fingerprint: string;
  register: string;
  blend_mode: 'soft' | 'cut';
  /** The visitor's hand (FR-16) — the delta from the machine's proposal. */
  tune?: { voices: number; separation: number; lean: number };
}

export interface ContributionResponse {
  ok: boolean;
  id?: string;
  error?: string;
}

const CONTRIBUTOR_ID_KEY = 'bs:contributorId';

/** Minimal storage surface so tests can inject a fake localStorage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Stable, device-pseudonymous id (stated in the consent copy as "anonymous");
 *  no account, generated client-side, never leaves except as this id. */
export function contributorId(storage?: StorageLike | null): string {
  const gen = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const active = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  try {
    if (active) {
      let id = active.getItem(CONTRIBUTOR_ID_KEY);
      if (!id) {
        id = gen();
        active.setItem(CONTRIBUTOR_ID_KEY, id);
      }
      return id;
    }
  } catch {
    // privacy-restricted storage — fall through to a per-call id
  }
  return gen();
}

/** SHA-256 of the submitted text (DR-2 integrity of the stored sentence). */
export async function textSha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Build the contribution payload for a run + a terminal gradient. Pure. */
export function buildContribution(
  run: RunRecord,
  gradient: 'accept' | 'reject',
  opts: {
    contributorId: string;
    textSha256: string;
    consent: boolean;
    register: string;
    /** The ACCEPTED form — the tuned reading if the visitor shaped it, else the machine's. */
    formParams?: SdfParams;
    /** The tune delta (FR-16) — the direction the visitor pushed the reading. */
    tune?: { voices: number; separation: number; lean: number };
  },
): ContributionPayload {
  return {
    contributor_anon_id: opts.contributorId,
    input_text: run.inputText,
    text_sha256: opts.textSha256,
    form_params: opts.formParams ?? run.sdfParams,
    z: Array.from(run.z),
    drift: run.drift,
    seed: run.seed,
    gradient,
    consent_flag: opts.consent ? 1 : 0,
    fingerprint: run.fingerprint,
    register: opts.register,
    blend_mode: run.sdfParams.blendMode ?? 'soft',
    tune: opts.tune,
  };
}

/** The ONLY outbound call of the collection loop; fired by an explicit share. */
export async function submitContribution(payload: ContributionPayload): Promise<ContributionResponse> {
  const res = await fetch('/api/contribute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as ContributionResponse;
}
