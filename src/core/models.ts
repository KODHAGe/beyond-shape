/**
 * Model registry (spec §3.6). Boot-fetch + parse of models.json, budget check,
 * lazy ONNX session plan, and the sensoryChannels reader (naming is data).
 *
 * This module is the SOLE fetch exception in src/core (spec §3.2 R-f): the
 * manifest is fetched same-origin at boot. No prompt text ever travels in a
 * request here or anywhere else.
 */

import type { ManifestEntry, ModelManifest, SensoryChannels } from '../types';
import { ModelMissingError } from '../types';

/** Σ public/models/*.onnx ≤ 120 MB int8 (spec §3.6 / CR-5). */
export const MODEL_BUDGET_BYTES = 120 * 1024 * 1024;
export const MODEL_BUDGET_MB = 120;

const MANIFEST_PATH = 'models/models.json';

/** Relative URL for the same-origin manifest (vite base '/'). */
export function manifestUrl(): string {
  return `${import.meta.env.BASE_URL}${MANIFEST_PATH}`;
}

/** An artifact is *available* only when it has a file path AND a sha-256 stub. */
export function isEntryAvailable(entry: ManifestEntry | null | undefined): boolean {
  if (!entry) return false;
  const file = entry.file;
  if (typeof file !== 'string' || file.trim().length === 0) return false;
  if (entry.sizeBytes <= 0) return false;
  return entry.sha256.length > 0;
}

/**
 * Get the file path of an artifact or throw. The scaffold manifest points at
 * null files — `ModelMissingError` is the EXPECTED load state until
 * scripts/train_generator.py regenerates the binaries (AGENTS.md §5).
 */
export function requireModelFile(
  entry: ManifestEntry | null | undefined,
  artifactKey: string,
): string {
  if (!isEntryAvailable(entry)) {
    throw new ModelMissingError(
      artifactKey,
      `model artifact "${artifactKey}" is not available (file/data missing in ` +
        `${MANIFEST_PATH}). Run scripts/train_generator.py to build the ONNX artifacts.`,
    );
  }
  return (entry as ManifestEntry).file;
}

function asRecord(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new TypeError(`models.json: expected an object for ${what}`);
  }
  return v as Record<string, unknown>;
}

function asString(v: unknown, what: string): string {
  if (typeof v !== 'string') throw new TypeError(`models.json: ${what} must be a string`);
  return v;
}

function asNumber(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new TypeError(`models.json: ${what} must be a finite number`);
  }
  return v;
}

function parseEntry(raw: unknown, key: string): ManifestEntry {
  if (raw === null || raw === undefined) {
    // Normalize "null" (missing artifact) to the in-memory strict shape with
    // an empty file — the JSON form may carry null, the TS form is `file: string`.
    return { file: '', sha256: '', sizeBytes: 0 };
  }
  const rec = asRecord(raw, `artifacts.${key}`);
  const file = rec['file'];
  return {
    file: file == null ? '' : asString(file, `artifacts.${key}.file`),
    sha256: rec['sha256'] == null ? '' : asString(rec['sha256'], `artifacts.${key}.sha256`),
    sizeBytes: rec['sizeBytes'] == null ? 0 : asNumber(rec['sizeBytes'], `artifacts.${key}.sizeBytes`),
    dim: rec['dim'] == null ? undefined : asNumber(rec['dim'], `artifacts.${key}.dim`),
    steps: rec['steps'] == null ? undefined : asNumber(rec['steps'], `artifacts.${key}.steps`),
    maxTokens:
      rec['maxTokens'] == null ? undefined : asNumber(rec['maxTokens'], `artifacts.${key}.maxTokens`),
  };
}

/**
 * Parse + validate a raw manifest JSON value into the strict ModelManifest
 * shape. Pure — used by the loader and by unit tests against the committed
 * placeholder manifest (no network needed).
 */
export function parseManifest(raw: unknown): ModelManifest {
  const root = asRecord(raw, 'manifest root');
  const artifacts = asRecord(root['artifacts'], 'artifacts');
  const artifactsOut = {
    embedder: parseEntry(artifacts['embedder'], 'embedder'),
    tokenizer: parseEntry(artifacts['tokenizer'], 'tokenizer'),
    sensory: parseEntry(artifacts['sensory'], 'sensory'),
    denoiser: parseEntry(artifacts['denoiser'], 'denoiser'),
    decoder: parseEntry(artifacts['decoder'], 'decoder'),
    aligner: artifacts['aligner'] == null ? null : parseEntry(artifacts['aligner'], 'aligner'),
  };

  const channelsRaw = root['sensoryChannels'];
  if (!Array.isArray(channelsRaw)) {
    throw new TypeError('models.json: sensoryChannels must be an array');
  }
  const sensoryChannels = channelsRaw.map((c) => {
    const rec = asRecord(c, 'sensoryChannels entry');
    return { name: asString(rec['name'], 'sensoryChannels[].name') };
  });

  const tsRaw = root['trainingSource'];
  const trainingSource =
    tsRaw == null
      ? undefined
      : {
          seedForms: asNumber(asRecord(tsRaw, 'trainingSource')['seedForms'], 'trainingSource.seedForms'),
          generatedAt: asString(
            asRecord(tsRaw, 'trainingSource')['generatedAt'],
            'trainingSource.generatedAt',
          ),
        };

  const licensesRaw = root['licenses'];
  if (!Array.isArray(licensesRaw)) {
    throw new TypeError('models.json: licenses must be an array');
  }
  // The JSON may carry richer license objects ({name, license, note}); the
  // bound in-memory type is `string[]`, so normalise each to a plain string.
  const licenses = licensesRaw.map((l) => {
    if (typeof l === 'string') return l;
    const rec = asRecord(l, 'licenses entry');
    const name = asString(rec['name'], 'licenses[].name');
    const license = rec['license'] == null ? '' : asString(rec['license'], 'licenses[].license');
    return license.length > 0 ? `${name} (${license})` : name;
  });

  return {
    version: asString(root['version'], 'version'),
    slice: asNumber(root['slice'], 'slice'),
    generatedAt: asString(root['generatedAt'], 'generatedAt'),
    totalBytes: asNumber(root['totalBytes'], 'totalBytes'),
    artifacts: artifactsOut,
    sensoryChannels,
    trainingSource,
    licenses,
  };
}

/**
 * Budget check (CR-5): the summed sizeBytes of all present artifacts must stay
 * ≤ 120 MB. Returns the computed sum in bytes. Throws RangeError on breach.
 */
export function checkBudget(manifest: ModelManifest): number {
  const entries: Array<ManifestEntry | null> = [
    manifest.artifacts.embedder,
    manifest.artifacts.tokenizer,
    manifest.artifacts.sensory,
    manifest.artifacts.denoiser,
    manifest.artifacts.decoder,
    manifest.artifacts.aligner,
  ];
  const sum = entries.reduce((acc, e) => acc + (e && isEntryAvailable(e) ? e.sizeBytes : 0), 0);
  if (sum > MODEL_BUDGET_BYTES) {
    throw new RangeError(
      `model payload ${sum} bytes exceeds the ${MODEL_BUDGET_MB} MB budget (CR-5)`,
    );
  }
  return sum;
}

/** Sensory channel names, re-composable as data (FR-3/C1). */
export function sensoryChannels(manifest: ModelManifest): SensoryChannels {
  return manifest.sensoryChannels;
}

/**
 * Lazy ONNX session plan (QR-1): a session is built once on first use and
 * reused; failures (e.g. ModelMissingError on a null artifact) are cached so
 * repeated calls don't re-attempt a doomed load. The manifest revalidation at
 * boot wipes this cache naturally by creating fresh modules/instances.
 */
export class LazySession<T> {
  private promise: Promise<T> | null = null;
  private readonly factory: () => Promise<T>;

  constructor(factory: () => Promise<T>) {
    this.factory = factory;
  }

  get(): Promise<T> {
    if (this.promise === null) {
      this.promise = this.factory();
      this.promise.catch(() => {
        // Cache the rejection: a missing artifact will not spontaneously appear
        // within a page session.
      });
    }
    return this.promise;
  }
}

/** Same-origin boot fetch of models.json (the one fetch in src/core). */
export async function fetchManifest(): Promise<ModelManifest> {
  const res = await fetch(manifestUrl(), { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`manifest fetch failed: HTTP ${res.status} (${manifestUrl()})`);
  }
  const raw: unknown = await res.json();
  return parseManifest(raw);
}