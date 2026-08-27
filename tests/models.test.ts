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

describe('models manifest (scaffold)', () => {
  it('parses the committed placeholder manifest and exposes channels as data', () => {
    const m = loadCommittedManifest();
    expect(m.version).toBe('0.0.1-scaffold');
    expect(m.slice).toBe(1);
    expect(m.artifacts.aligner).toBeNull(); // DR-5 registry shape stable now
    expect(sensoryChannels(m).map((c) => c.name)).toEqual(V0_CHANNELS);
    expect(m.licenses.some((l) => l.includes('Apache-2.0'))).toBe(true);
  });

  it('missing artifacts are unavailable and loading them raises ModelMissingError', async () => {
    const m = loadCommittedManifest();
    expect(isEntryAvailable(m.artifacts.embedder)).toBe(false);
    expect(() => requireModelFile(m.artifacts.embedder, 'embedder')).toThrow(ModelMissingError);
    expect(() => requireModelFile(m.artifacts.sensory, 'sensory')).toThrow(
      /not available.*train_generator/i,
    );
  });

  it('budget check passes on the placeholder (Σ=0 ≤ 120 MB) and returns the sum', () => {
    const m = loadCommittedManifest();
    expect(checkBudget(m)).toBe(0);
    expect(MODEL_BUDGET_BYTES).toBe(120 * 1024 * 1024);
  });

  it('rejects a manifest that overruns the 120 MB budget', () => {
    const m = loadCommittedManifest();
    const big: unknown = {
      ...m,
      artifacts: {
        ...m.artifacts,
        embedder: { file: 'x.onnx', sha256: 'a'.repeat(64), sizeBytes: MODEL_BUDGET_BYTES + 1 },
      },
    };
    const parsed = parseManifest(big);
    expect(() => checkBudget(parsed)).toThrow(RangeError);
  });

  it('normalises null artifact entries to the strict in-memory shape', () => {
    const m = loadCommittedManifest();
    expect(typeof m.artifacts.embedder.file).toBe('string');
    expect(m.artifacts.embedder.file).toBe('');
  });

  it('throws TypeError on a malformed manifest', () => {
    expect(() => parseManifest({ version: 42 })).toThrow(TypeError);
  });
});