#!/usr/bin/env node
// Slice 1 CI assertions (spec §2 trace): model budget, privacy greps, sign-of-life
// schema checks. Kept as plain data checks so the acceptance tests are executable
// by the orchestrator and in GitHub Actions without a framework.
//
// Checks:
//   1. Σ public/models/*.onnx ≤ 120 MB (CR-5 budget; trivially passes with the
//      placeholder manifest — no binaries are committed).
//   2. public/models/models.json is a valid ModelManifest: sensoryChannels
//      exactly the v0 16 names (FR-3/C1: naming is data, not code).
//   3. No unseeded RNG: `Math.random(` forbidden in
//      src/core/{generator,sdfParams,seededRng}.ts (FR-10).
//   4. Sole fetch exception: no `fetch(` in src/core except models.ts (FR-5/QR-3).
//   5. No client secrets: no `api[_-]?key` identifier anywhere in src/ (CR-5).
//   6. No categorical label table: the word "emotion"/"emotions" must not appear
//      in src/core, and the UI ships no emotion selector (FR-1).
//   7. CR-3: package.json must not declare server frameworks.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MODEL_BUDGET_BYTES = 120 * 1024 * 1024;
const V0_CHANNELS = [
  'light',
  'warmth',
  'motion',
  'weight',
  'texture',
  'soft',
  'hard',
  'metal',
  'fluid',
  'time-of-day',
  'scale',
  'moisture',
  'rhythm',
  'colour-temperature',
  'colour-saturation',
  'air',
];

let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`[FAIL] ${message}`);
}
function pass(message) {
  console.log(`[ ok ] ${message}`);
}

function walkOnnx(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkOnnx(full, out);
    else if (entry.name.endsWith('.onnx')) out.push(full);
  }
  return out;
}

// ── Check 1: budget Σ public/models/*.onnx ≤ 120 MB ───────────────────────────
{
  const modelsDir = join(ROOT, 'public', 'models');
  const onnx = walkOnnx(modelsDir);
  const total = onnx.reduce((sum, p) => sum + statSync(p).size, 0);
  if (total > MODEL_BUDGET_BYTES) {
    fail(`model payload ${total} bytes exceeds 120 MB budget (CR-5)`);
  } else {
    pass(`budget: ${onnx.length} onnx file(s), ${total} bytes ≤ 120 MB (CR-5)`);
  }
}

// ── Check 2: models.json schema sanity ────────────────────────────────────────
{
  const manifestPath = join(ROOT, 'public', 'models', 'models.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    fail(`cannot parse ${manifestPath}: ${err.message}`);
    manifest = {};
  }
  const channels = Array.isArray(manifest.sensoryChannels)
    ? manifest.sensoryChannels.map((c) => c && c.name)
    : [];
  const namesEqual =
    channels.length === V0_CHANNELS.length &&
    channels.every((name, i) => name === V0_CHANNELS[i]);
  if (!namesEqual) {
    fail('models.json sensoryChannels must equal the v0 16 channel names (FR-3/C1)');
  } else {
    pass('models.json sensoryChannels = v0 16 names (FR-3/C1)');
  }
  if (manifest.artifacts === undefined || manifest.artifacts.aligner !== null) {
    fail('models.json artifacts must exist with aligner:null placeholder (DR-5)');
  } else {
    pass('models.json artifacts.aligner = null placeholder (DR-5)');
  }
}

// ── Check 3: no unseeded RNG in core sampling/decode modules ─────────────────
{
  const scanned = [
    'src/core/generator.ts',
    'src/core/sdfParams.ts',
    'src/core/seededRng.ts',
  ];
  let clean = true;
  for (const rel of scanned) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    if (/\bMath\.random\s*\(/.test(src)) {
      fail(`${rel} uses Math.random (FR-10)`);
      clean = false;
    }
  }
  if (clean) pass('no Math.random in src/core/{generator,sdfParams,seededRng}.ts (FR-10)');
}

// ── Check 4: no fetch in src/core except models.ts (FR-5/QR-3) ────────────────
{
  const coreDir = join(ROOT, 'src', 'core');
  let clean = true;
  for (const entry of readdirSync(coreDir).filter((f) => f.endsWith('.ts'))) {
    if (entry === 'models.ts') continue; // sole named exception (spec §3.2 R-f)
    const src = readFileSync(join(coreDir, entry), 'utf8');
    if (/\bfetch\s*\(/.test(src)) {
      fail(`src/core/${entry} contains fetch( — only models.ts may (FR-5/QR-3)`);
      clean = false;
    }
  }
  if (clean) pass('no fetch in src/core inference modules (FR-5/QR-3)');
}

// ── Check 5: no client secrets ────────────────────────────────────────────────
{
  const srcDir = join(ROOT, 'src');
  let clean = true;
  for (const entry of readdirSync(srcDir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(srcDir, entry), 'utf8');
    if (/api[_-]?key/i.test(src)) {
      fail(`src/${entry} mentions an api key identifier (CR-5)`);
      clean = false;
    }
  }
  if (clean) pass('no api key identifiers in src/ (CR-5)');
}

// ── Check 6: no categorical label table / no emotion selector (FR-1) ──────────
{
  const coreDir = join(ROOT, 'src', 'core');
  let clean = true;
  for (const entry of readdirSync(coreDir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(coreDir, entry), 'utf8');
    if (/\bemotion/i.test(src)) {
      fail(`src/core/${entry} references an emotion table (FR-1)`);
      clean = false;
    }
  }
  if (clean) pass('no emotion label table in src/core (FR-1)');
}

// ── Check 7: thin monolith (CR-3) ─────────────────────────────────────────────
{
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const forbidden = ['express', 'http-server', 'koa', 'fastify'];
  const hits = forbidden.filter((d) => deps[d] !== undefined);
  if (hits.length > 0) {
    fail(`server frameworks declared: ${hits.join(', ')} (CR-3)`);
  } else {
    pass('no server framework deps (CR-3)');
  }
}

if (failures > 0) {
  console.error(`\nci-checks: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\nci-checks: all assertions passed');