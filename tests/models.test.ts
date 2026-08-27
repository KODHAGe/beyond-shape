import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkBudget,
  isEntryAvailable,
  parseManifest,
  requireModelFile,
  sensoryChannels,
  MODEL_BUDGET_BYTES,
} from '../src/core/models';
import { ModelMissingError } from '../src/types';

const MANIFEST_PATH = new URL('../public/models/models.json', import.meta.url);
const V0_CHANNELS = [
  'light', 'warmth', 'motion', 'weight', 'texture', 'soft', 'hard', 'metal',
  'fluid', 'time-of-day', 'scale', 'moisture', 'rhythm',
  'colour-temperature', 'colour-saturation', 'air',
];

function loadCommittedManifest() {
  const raw: unknown = JSON.parse(readFileSync(fileURLToPath(MANIFEST_PATH), 'utf8'));
  return parseManifest(raw);
}

/**
 * Synthetic manifest builder (AMEND-LR-3): the missing-model tests construct
 * their own empty-artifact manifests instead of asserting the committed
 * placeholder content — so the suite stays green both before AND after a
 * legitimate `scripts/train_generator.py` regeneration ships real binaries.
 */
function makeRawManifest(overrides: object = {}): unknown {
  const nullEntry = { file: null, sha256: '', sizeBytes: 0 };
  return {
    version: '0.0.0-test',
    slice: 1,
    generatedAt: 'content-test',
    totalBytes: 0,
    artifacts: {
      embedder: { ...nullEntry, dim: 384, maxTokens: 256 },
      tokenizer: { ...nullEntry, maxTokens: 256 },
      sensory: { ...nullEntry, dim: 16 },
      denoiser: { ...nullEntry, dim: 64, steps: 25 },
      decoder: { ...nullEntry, dim: 64 },
      aligner: null,
    },
    sensoryChannels: V0_CHANNELS.map((name) => ({ name })),
    licenses: [{ name: 'test-model', license: 'Apache-2.0' }],
    ...overrides,
  };
}

describe('models manifest', () => {
  it('parses the committed manifest; channels are names-as-data, registry shape stable', () => {
    const m = loadCommittedManifest();
    // Do NOT pin `version` — it changes on every legitimate regeneration (LR-9).
    expect(typeof m.version).toBe('string');
    expect(m.version.length).toBeGreaterThan(0);
    expect(m.slice).toBe(1);
    expect(m.artifacts.aligner).toBeNull(); // DR-5: aligner key present, null until Slice 2
    expect(sensoryChannels(m).map((c) => c.name)).toEqual(V0_CHANNELS);
    expect(m.licenses.some((l) => l.includes('Apache-2.0'))).toBe(true);
  });

  it('missing artifacts (synthetic manifest) are unavailable and raise ModelMissingError', async () => {
    const m = parseManifest(makeRawManifest());
    expect(isEntryAvailable(m.artifacts.embedder)).toBe(false);
    expect(() => requireModelFile(m.artifacts.embedder, 'embedder')).toThrow(ModelMissingError);
    expect(() => requireModelFile(m.artifacts.sensory, 'sensory')).toThrow(
      /not available|missing/i,
    );
  });

  it('manifest with real binaries (synthetic) is available and passes budget', () => {
    const m = parseManifest(
      makeRawManifest({
        artifacts: {
          ...(makeRawManifest() as { artifacts: object }).artifacts,
          embedder: { file: 'embedder.onnx', sha256: 'a'.repeat(64), sizeBytes: 23 * 1024 * 1024 },
        },
      }),
    );
    expect(isEntryAvailable(m.artifacts.embedder)).toBe(true);
    expect(checkBudget(m)).toBeLessThanOrEqual(MODEL_BUDGET_BYTES);
  });

  it('budget check accepts the committed manifest within the 120 MB ceiling', () => {
    const m = loadCommittedManifest();
    const sum = checkBudget(m);
    expect(sum).toBeGreaterThanOrEqual(0);
    expect(sum).toBeLessThanOrEqual(MODEL_BUDGET_BYTES);
    expect(MODEL_BUDGET_BYTES).toBe(120 * 1024 * 1024);
  });

  it('rejects a manifest that overruns the 120 MB budget', () => {
    const raw = makeRawManifest() as { artifacts: Record<string, unknown> };
    const big = {
      ...raw,
      artifacts: {
        ...raw.artifacts,
        embedder: { file: 'x.onnx', sha256: 'a'.repeat(64), sizeBytes: MODEL_BUDGET_BYTES + 1 },
      },
    };
    const parsed = parseManifest(big);
    expect(() => checkBudget(parsed)).toThrow(RangeError);
  });

  it('normalises null artifact entries to the strict in-memory shape', () => {
    const m = parseManifest(makeRawManifest());
    expect(typeof m.artifacts.embedder.file).toBe('string');
    expect(m.artifacts.embedder.file).toBe('');
  });

  it('throws TypeError on a malformed manifest', () => {
    expect(() => parseManifest({ version: 42 })).toThrow(TypeError);
  });
});