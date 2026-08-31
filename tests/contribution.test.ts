import { describe, expect, it } from 'vitest';
import type { RunRecord } from '../src/types';
import {
  buildContribution,
  contributorId,
  textSha256,
  type ContributionPayload,
  type StorageLike,
} from '../src/state/contribution';

function fakeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: 'run-1',
    inputText: 'a small yellow bird',
    e: new Float32Array(384),
    q: new Float32Array(16),
    z: new Float32Array(64).fill(0.25),
    zAlternates: [],
    sdfParams: {
      weights: [1, 0, 0, 0, 0, 0, 0, 0],
      blendRadius: 0.15,
      blendMode: 'cut',
      parts: Array.from({ length: 8 }, () => ({
        scale: [1, 1, 1] as [number, number, number],
        offset: [0, 0, 0] as [number, number, number],
        twist: 0,
        displacement: 0,
      })),
      material: { hue: 0.5, saturation: 0.4, lightness: 0.7, roughness: 0.5, metalness: 0, clearcoat: 0, emissive: 0 },
      motion: { breathe: 0, sway: 0 },
      pose: { yaw: 0, pitch: 0, roll: 0 },
    },
    renderState: { camera: { pos: [0, 0, 1], target: [0, 0, 0] }, palette: { background: '#fff', key: '#fff', fill: '#fff', rim: '#fff' } },
    drift: 0.55,
    seed: 42,
    fingerprint: 'deadbeef',
    createdAt: 123,
    webgl: true,
    ...overrides,
  };
}

const opts = (over: Partial<Parameters<typeof buildContribution>[2]> = {}) => ({
  contributorId: 'anon-1',
  textSha256: 'a'.repeat(64),
  consent: true,
  register: 'collision',
  ...over,
});

describe('contributorId', () => {
  it('is stable per storage and name-agnostic about the device (DR-1)', () => {
    const data = new Map<string, string>();
    const mem: StorageLike = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    const a = contributorId(mem);
    const b = contributorId(mem);
    expect(a).toBe(b); // second read returns the stored id, no new gen
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('textSha256', () => {
  it('hashes to a 64-hex digest (DR-2 integrity of the stored sentence)', async () => {
    const h = await textSha256('a small yellow bird');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('buildContribution', () => {
  it('carries the judged form + gradient + consent + trace fields (DR-1/FR-20)', () => {
    const run = fakeRun();
    const p = buildContribution(run, 'accept', opts());
    expect(p.input_text).toBe('a small yellow bird');
    expect(p.form_params).toEqual(run.sdfParams);
    expect(p.z).toEqual(Array.from(run.z));
    expect(p.gradient).toBe('accept');
    expect(p.consent_flag).toBe(1);
    expect(p.drift).toBe(0.55);
    expect(p.seed).toBe(42);
    expect(p.fingerprint).toBe('deadbeef');
    expect(p.register).toBe('collision');
    expect(p.blend_mode).toBe('cut'); // from the decoded reading's blendMode
  });

  it('records the consent flag as 0 when the opt-in is off (DR-2 gate)', () => {
    const p = buildContribution(fakeRun(), 'reject', opts({ consent: false }));
    expect(p.consent_flag).toBe(0);
    expect(p.gradient).toBe('reject');
  });

  it('defaults blend_mode to soft for a legacy (mode-less) reading', () => {
    const run = fakeRun();
    run.sdfParams.blendMode = undefined;
    const p = buildContribution(run, 'accept', opts());
    expect(p.blend_mode).toBe('soft');
  });

  it('serialises z as a plain number[] (JSON-safe for the write path)', () => {
    const p = buildContribution(fakeRun(), 'accept', opts());
    expect(Array.isArray(p.z)).toBe(true);
    expect(p.z.every((n) => typeof n === 'number')).toBe(true);
  });
});

// Type-level guard that the payload shape matches the edge contract.
const _payloadCheck: ContributionPayload = buildContribution(fakeRun(), 'accept', opts());
void _payloadCheck;
