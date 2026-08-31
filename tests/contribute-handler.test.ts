import { describe, expect, it } from 'vitest';
import { handleContribution, validateContribution, type DbLike } from '../functions/api/contribute';

/** Fake D1 binding that records the prepared SQL and the bound args. */
function makeDb() {
  const sqls: string[] = [];
  const inserts: unknown[][] = [];
  const db: DbLike = {
    prepare(sql: string) {
      sqls.push(sql);
      return {
        bind(...values: unknown[]) {
          inserts.push(values);
          return { run: async () => ({}) };
        },
      };
    },
  };
  return { db, sqls, inserts };
}

function validBody(over: Record<string, unknown> = {}) {
  return {
    contributor_anon_id: 'anon-1',
    input_text: 'a small yellow bird',
    text_sha256: 'a'.repeat(64),
    form_params: { weights: [1, 0, 0, 0, 0, 0, 0, 0], blendRadius: 0.15 },
    z: Array(64).fill(0.25),
    drift: 0.55,
    seed: 42,
    gradient: 'accept',
    consent_flag: 1,
    fingerprint: 'deadbeef',
    register: 'collision',
    blend_mode: 'cut',
    ...over,
  };
}

describe('validateContribution (DR-2 / DR-1)', () => {
  it('accepts a complete, consented contribution', () => {
    expect(validateContribution(validBody())).toBeNull();
  });

  it('rejects without consent (server-enforced, never client-trust)', () => {
    expect(validateContribution(validBody({ consent_flag: 0 }))).toMatch(/consent/);
    expect(validateContribution(validBody({ consent_flag: 'yes' }))).toMatch(/consent/);
  });

  it('rejects a missing/invalid field', () => {
    expect(validateContribution(validBody({ input_text: '' }))).toMatch(/input_text/);
    expect(validateContribution(validBody({ gradient: 'maybe' }))).toMatch(/gradient/);
    expect(validateContribution(validBody({ blend_mode: 'fuzzy' }))).toMatch(/blend_mode/);
    expect(validateContribution(null)).toMatch(/malformed/);
  });
});

describe('handleContribution (DR-3 append-only write path)', () => {
  it('INSERTs a consented contribution and returns ok', async () => {
    const { db, sqls, inserts } = makeDb();
    const res = await handleContribution(db, validBody());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; id: string };
    expect(body.ok).toBe(true);
    expect(body.id.length).toBeGreaterThan(0);

    expect(sqls).toHaveLength(1);
    expect(sqls[0]).toMatch(/^INSERT INTO contributions/i);
    // Append-only (DR-3): the only SQL in the handler is INSERT.
    expect(sqls[0]).not.toMatch(/UPDATE|DELETE/i);
    expect(inserts).toHaveLength(1);
    const args = inserts[0]!;
    expect(args[0]).toBe(body.id);
    expect(args[2]).toBe('anon-1'); // contributor_anon_id
    expect(args[3]).toBe('a small yellow bird'); // input_text (DR-2: stored)
    expect(args[10]).toBe(1); // consent_flag
    expect(args[11]).toBe('deadbeef'); // fingerprint
  });

  it('rejects a non-consented contribution: 400 and NO insert (DR-2/DR-3)', async () => {
    const { db, sqls, inserts } = makeDb();
    const res = await handleContribution(db, validBody({ consent_flag: 0 }));
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
    expect(sqls).toHaveLength(0);
  });

  it('rejects a malformed body without touching the DB', async () => {
    const { db, sqls, inserts } = makeDb();
    const res = await handleContribution(db, { drift: 'x' });
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
    expect(sqls).toHaveLength(0);
  });
});
