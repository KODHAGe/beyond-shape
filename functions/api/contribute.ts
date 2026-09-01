/**
 * Phase D Slice 1 — consent-gated write path (DR-1/DR-2/DR-3).
 *
 * Thin Pages Function: imports NOTHING from src/. Validates the contribution,
 * rejects anything without an explicit consent flag, and INSERTs into D1.
 * Append-only (DR-3): the only SQL here is INSERT — no UPDATE/DELETE anywhere.
 */

export interface DbLike {
  prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } };
}

const GRADIENTS = new Set(['accept', 'adjust', 'reject']);
const BLEND_MODES = new Set(['soft', 'cut']);

export interface ContributionBody {
  contributor_anon_id: string;
  input_text: string;
  text_sha256: string;
  form_params: Record<string, unknown>;
  z: number[];
  drift: number;
  seed: number;
  gradient: string;
  consent_flag: number;
  fingerprint: string;
  register: string;
  blend_mode: string;
  tune?: Record<string, unknown>;
}

function isString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Structural + consent validation (DR-2: consent is SERVER-enforced, not
 *  client-trust). Returns a message or null when the body is acceptable. */
export function validateContribution(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'malformed body';
  const b = body as Record<string, unknown>;
  if (b.consent_flag !== 1) return 'consent required (DR-2)';
  if (!isString(b.contributor_anon_id)) return 'contributor_anon_id required';
  if (!isString(b.input_text)) return 'input_text required';
  if (!isString(b.text_sha256)) return 'text_sha256 required';
  if (!b.form_params || typeof b.form_params !== 'object') return 'form_params required';
  if (!Array.isArray(b.z) || !b.z.every(isFiniteNumber)) return 'z required';
  if (!isFiniteNumber(b.drift)) return 'drift required';
  if (!isFiniteNumber(b.seed)) return 'seed required';
  if (!isString(b.gradient) || !GRADIENTS.has(b.gradient)) return 'gradient required';
  if (!isString(b.fingerprint)) return 'fingerprint required';
  if (!isString(b.register)) return 'register required';
  if (!isString(b.blend_mode) || !BLEND_MODES.has(b.blend_mode)) return 'blend_mode required';
  if (b.tune !== undefined && (typeof b.tune !== 'object' || b.tune === null)) return 'tune invalid';
  return null;
}

/** Pure handler verdict — INSERT into D1 (append-only). Returns a Response. */
export async function handleContribution(db: DbLike, body: unknown): Promise<Response> {
  const problem = validateContribution(body);
  if (problem) {
    return Response.json({ ok: false, error: problem }, { status: 400 });
  }
  const b = body as ContributionBody;
  const id = crypto.randomUUID();
  const sql =
    'INSERT INTO contributions ' +
    '(id, created_at, contributor_anon_id, input_text, text_sha256, form_params, ' +
    'z, drift, seed, gradient, consent_flag, fingerprint, register, blend_mode, tune) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const values = [
    id,
    Date.now(),
    b.contributor_anon_id,
    b.input_text,
    b.text_sha256,
    JSON.stringify(b.form_params),
    JSON.stringify(b.z),
    b.drift,
    b.seed,
    b.gradient,
    b.consent_flag,
    b.fingerprint,
    b.register,
    b.blend_mode,
    b.tune ? JSON.stringify(b.tune) : null,
  ];
  await db.prepare(sql).bind(...values).run();
  return Response.json({ ok: true, id }, { status: 200 });
}

export const onRequestPost = async (ctx: { request: Request; env: { DB: DbLike } }) => {
  const body: unknown = await ctx.request.json().catch(() => null);
  return handleContribution(ctx.env.DB, body);
};
