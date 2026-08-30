/**
 * App UI (spec §4 plain-reader strings + FR-1/FR-6/FR-8/FR-9/FR-11 bindings):
 *   - textarea input (free text, no emotion selector — FR-1)
 *   - drift knob "how close to the crowd?" 0..1 default 0.4 (FR-8/AMEND-3)
 *   - seed control "same sentence, same seed — same form."
 *   - Run button → thermometer of work → render → alternates → marginalia
 *   - Alternates strip (FR-9) + "a stranger's reading" panel (FR-6/FR-11)
 *   - progress surface (QR-1) + friendly scaffold state for missing models
 *
 * Orchestration lives here (main.ts only bootstraps). Everything is local:
 * no text leaves the device (FR-5).
 */

import type { ModelManifest, RunRecord, SdfParams, SeedForm } from '../types';
import { ModelMissingError } from '../types';
import { fetchManifest } from '../core/models';
import { Embedder } from '../core/embedding';
import { SensoryHead } from '../core/sensory';
import { OnnxDenoiser, generateDistribution } from '../core/generator';
import { Decoder } from '../core/sdfParams';
import { createRenderer, type AppRenderer } from '../render/renderer';
import { computeRenderState } from '../render/scene';
import { retune, structureRichness } from '../aesthetics/register';
import type { RegisterKind } from '../aesthetics/register';
import { RunStore } from '../state/runStore';
import { fingerprint as fingerprintOf } from '../lib/fingerprint';
import { Progress } from './progress';
import { createMarginaliaPanel, computeMarginality } from './marginaliaPanel';
import { createAlternatesStrip, type AlternateCell } from './alternatesStrip';

const SEED_FORMS_URL = 'seed-forms.json';
// D-B register verdict (aesthetic lab, 2026-08-30): collision — seamed,
// glossy, teetering; the drift knob is the consensus⇄edge spindle (C2, FR-8).
// Clay stays defined in REGISTERS for the future register toggle.
const REGISTER: RegisterKind = 'collision';
const DRIFT_DEFAULT = 0.55;

export interface AppHandle {
  dispose(): void;
}

export async function mountApp(root: HTMLElement): Promise<AppHandle> {
  // ── Shell (stage 1 of the QR-1 load order) ────────────────────────────────
  root.className = 'bs-root';
  const header = document.createElement('header');
  header.className = 'bs-header';
  const h1 = document.createElement('h1');
  h1.textContent = 'beyond shape';
  const tagline = document.createElement('p');
  tagline.className = 'bs-tagline';
  tagline.textContent = 'type a sentence · watch a form arrive';
  header.append(h1, tagline);
  root.appendChild(header);

  const stageLine = document.createElement('p');
  stageLine.className = 'bs-placeholder';
  stageLine.textContent = '…a quiet shape before the words';
  root.appendChild(stageLine);

  const progressMount = document.createElement('div');
  root.appendChild(progressMount);
  const progress = new Progress(progressMount);
  progress.setStage('shell', 'done');
  progress.setStage('placeholder', 'active');

  // ── Inputs ─────────────────────────────────────────────────────────────────
  const form = document.createElement('section');
  form.className = 'bs-form';
  const textarea = document.createElement('textarea');
  textarea.id = 'bs-prompt';
  textarea.rows = 3;
  textarea.placeholder = 'a sentence of your own';
  form.appendChild(textarea);

  const driftLabel = document.createElement('label');
  driftLabel.htmlFor = 'bs-drift';
  driftLabel.textContent = 'how close to the crowd?';
  const drift = document.createElement('input');
  drift.id = 'bs-drift';
  drift.type = 'range';
  drift.min = '0';
  drift.max = '1';
  drift.step = '0.05';
  drift.value = String(DRIFT_DEFAULT);
  const driftReadout = document.createElement('span');
  driftReadout.className = 'bs-drift-value';
  driftReadout.textContent = '0.40';
  drift.addEventListener('input', () => {
    driftReadout.textContent = Number(drift.value).toFixed(2); // FR-8: re-samples on change
  });
  driftLabel.append(drift, driftReadout);
  form.appendChild(driftLabel);

  const seedLabel = document.createElement('label');
  seedLabel.htmlFor = 'bs-seed';
  seedLabel.textContent = 'same sentence, same seed — same form.';
  const seed = document.createElement('input');
  seed.id = 'bs-seed';
  seed.type = 'number';
  seed.min = '1';
  seed.step = '1';
  seed.value = '42';
  seedLabel.append(seed);
  form.appendChild(seedLabel);

  const runButton = document.createElement('button');
  runButton.type = 'button';
  runButton.textContent = 'make a form';
  form.appendChild(runButton);
  root.appendChild(form);

  // ── Render viewport + distribution ─────────────────────────────────────────
  const viewport = document.createElement('div');
  viewport.className = 'bs-viewport';
  root.appendChild(viewport);
  const alternatesMount = document.createElement('div');
  root.appendChild(alternatesMount);
  const marginaliaMount = document.createElement('div');
  root.appendChild(marginaliaMount);
  const statusLine = document.createElement('p');
  statusLine.className = 'bs-status';
  root.appendChild(statusLine);

  // ── Warm-up (stages 2-4: renderer → embedder → generator) ─────────────────
  progress.setStage('placeholder', 'done');
  progress.setStage('renderer', 'active');
  const renderer: AppRenderer = await createRenderer(viewport);
  viewport.dataset['renderMode'] = renderer.kind; // LR-6: tier observable in tests
  progress.setStage('renderer', 'done');

  // The renderer must actually SIZE to its container (LR-6 realism): the old
  // path left the canvas at the 640×480 default and CSS-stretched it — blurry
  // on big screens, wrong aspect on narrow ones. Bind live to the viewport.
  function bindViewportSize(target: HTMLElement, apply: (w: number, h: number) => void): () => void {
    const read = (): void => {
      const r = target.getBoundingClientRect();
      apply(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    };
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(read);
      ro.observe(target);
      read();
      return () => ro.disconnect();
    }
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }
  const unbindViewportSize = bindViewportSize(viewport, (w, h) => renderer.resize(w, h));

  const store = new RunStore();
  const marginalia = createMarginaliaPanel(marginaliaMount);
  const alternates = createAlternatesStrip(alternatesMount);

  let manifest: ModelManifest | null = null;
  let seedForms: SeedForm[] = [];

  async function loadStatic(): Promise<void> {
    progress.setStage('manifest', 'active');
    manifest = await fetchManifest();
    progress.setStage('manifest', 'done');
    // Cold-start backdrop (FR-6); empty seeds are the scaffold's honest state.
    const res = await fetch(SEED_FORMS_URL);
    if (res.ok) {
      const raw: unknown = await res.json();
      seedForms = Array.isArray(raw) ? raw : (raw as { seeds?: SeedForm[] }).seeds ?? [];
    }
  }

  function line(message: string): void {
    statusLine.textContent = message;
  }

  async function runOnce(): Promise<void> {
    const text = textarea.value.trim();
    if (!text) {
      line('type a sentence first.');
      return;
    }
    const driftValue = Math.min(1, Math.max(0, Number(drift.value) || DRIFT_DEFAULT));
    const seedValue = Math.max(1, Math.floor(Number(seed.value) || 42));
    const runId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `run-${Date.now()}`;

    progress.reset();
    progress.setStage('run', 'active');
    runButton.disabled = true;
    try {
      if (!manifest) await loadStatic();
      const m = manifest as ModelManifest;
      progress.setStage('models', 'active');
      const embedder = new Embedder(m);
      const sensory = new SensoryHead(m);
      const denoiser = new OnnxDenoiser(m);
      const decoder = new Decoder(m);

      const e = await embedder.embed(text);
      progress.setStage('models', 'done');
      // Structure signal (Phase C §3): "richness follows structure" — derived
      // on-device from WordPiece ids; deterministic, never transmitted (FR-5).
      const richness = structureRichness(await embedder.tokenCount(text));
      const q = await sensory.forward(e);
      const zs = await generateDistribution({
        text,
        e,
        q,
        drift: driftValue,
        seed: seedValue,
        denoiser,
        richness,
      });
      const z = zs[0] as Float32Array;
      const zAlternates = zs.slice(1);
      // The register carries the decoded reading (collision, D-B verdict):
      // `sdfParams` is the RENDERED form; the raw decode lives in `z`.
      const sdfParams = retune(await decoder.decode(z), REGISTER, driftValue, richness);
      // Decode each alternate so the strip can render real forms (FR-9). A
      // failed decode keeps an honest "sketch" cell — never a broken run.
      const cells: AlternateCell[] = [];
      for (const za of zAlternates.slice(0, 3)) {
        let sdf: SdfParams | null = null;
        try {
          sdf = retune(await decoder.decode(za), REGISTER, driftValue, richness);
        } catch {
          sdf = null;
        }
        cells.push({ seed: seedValue + 1 + cells.length, sdf });
      }
      const fp = await fingerprintOf(text, driftValue, seedValue);
      const renderState = computeRenderState(seedValue, sdfParams);

      const run: RunRecord = {
        id: runId,
        inputText: text,
        e,
        q,
        z,
        zAlternates,
        sdfParams,
        renderState,
        drift: driftValue,
        seed: seedValue,
        fingerprint: fp,
        createdAt: Date.now(),
        webgl: renderer.kind === 'webgl',
      };
      store.add(run);
      renderer.show(run);
      alternates.render(cells, renderer.kind);

      const notes = computeMarginality(e, z, seedForms);
      marginalia.render(run, notes, seedForms);
      line(`this run's hash: ${fp.slice(0, 16)}… (same words, same knob, same seed — same form)`);
    } catch (err) {
      if (err instanceof ModelMissingError) {
        progress.setStage('models', 'error');
        if (/not available/.test(err.message)) {
          // Truly absent binaries → honest interim (LR-3 / AMEND-1); the
          // directive lives only in the dev console.
          progress.message('the machines are still sleeping; this sentence will find a form once the models are built.', 'error');
          console.warn('models not built yet — run scripts/train_generator.py');
          line('even so — a crowd is forming, one reading at a time.');
        } else {
          // A real load/run failure — show the cause, never hide it behind
          // the sleeping copy.
          progress.message(`something wasn't ready: ${err.message}`, 'error');
          console.warn('run failed', err);
        }
      } else if (err instanceof Error) {
        progress.message(`something wasn't ready: ${err.message}`, 'error');
        console.warn('run failed', err);
      }
    } finally {
      runButton.disabled = false;
      progress.setStage('run', 'done');
    }
  }

  runButton.addEventListener('click', () => void runOnce());
  textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) void runOnce();
  });

  // Bootstrap: manifest + seed corpus + initial warm state.
  void loadStatic().catch((err: Error) => {
    progress.setStage('manifest', 'error');
    progress.message(`couldn't reach the models: ${err.message}`, 'error');
  });

  return {
    dispose() {
      unbindViewportSize();
      renderer.dispose();
      root.replaceChildren();
    },
  };
}