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
import { createCoCreation } from './coCreation';
import { createTunePanel } from './tunePanel';
import { tuneSdf, DEFAULT_TUNE, type TuneState } from '../aesthetics/tune';
import {
  buildContribution,
  contributorId,
  submitContribution,
  textSha256,
} from '../state/contribution';

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
  const sub = document.createElement('p');
  sub.className = 'bs-sub';
  // The crowd, defined ONCE, plainly — so "how close to the crowd?" and
  // "whose crowd is this nearest" and "give this reading to the crowd" all
  // land. The machine reads; the crowd is everyone's readings (C6).
  sub.textContent = 'the machine reads as one reader among many — the crowd is everyone\u2019s readings.';
  header.append(h1, tagline, sub);
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
  driftLabel.textContent = 'how close to the crowd\u2019s way of reading?';
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
  const driftHint = document.createElement('span');
  driftHint.className = 'bs-drift-hint';
  driftHint.textContent = '0 = the machine\u2019s edge · 1 = the crowd\u2019s centre';
  driftLabel.append(drift, driftReadout, driftHint);
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
  // Label the OUTPUT plainly: the form is the machine's reading, not the
  // visitor's drawing (input = the sentence; output = the machine's reading).
  const readingLabel = document.createElement('p');
  readingLabel.className = 'bs-reading-label';
  readingLabel.textContent = 'the machine\u2019s reading of your sentence:';
  readingLabel.hidden = true;
  root.appendChild(readingLabel);
  const viewport = document.createElement('div');
  viewport.className = 'bs-viewport';
  root.appendChild(viewport);
  const alternatesMount = document.createElement('div');
  root.appendChild(alternatesMount);
  const marginaliaMount = document.createElement('div');
  root.appendChild(marginaliaMount);
  // Collection (Phase D): the co-creation loop + consent, mounted after the
  // form so the visitor judges the reading that just arrived.
  const coCreationMount = document.createElement('div');
  coCreationMount.hidden = true;
  root.appendChild(coCreationMount);
  const statusLine = document.createElement('p');
  statusLine.className = 'bs-status';
  root.appendChild(statusLine);
  // The most recent run — the one the co-creation loop judges / shares.
  let currentRun: RunRecord | null = null;

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
  const coCreation = createCoCreation(coCreationMount, {
    // Adjust: a new sample — the visitor's hand re-periods the shape (FR-16).
    onAdjust() {
      const nextSeed = Math.max(1, (currentRun?.seed ?? Math.floor(Number(seed.value) || 42)) + 1);
      seed.value = String(nextSeed);
      commitRun();
    },
    // The ONLY outbound call: an explicit share, gated on the opt-in (DR-2).
    // It submits the TUNED reading (the human's hand) + the tune delta — the
    // refinement field the aligner learns from.
    async onSubmit(gradient, consented) {
      if (!currentRun) return false;
      try {
        const sha = await textSha256(currentRun.inputText);
        const acceptedSdf = currentTunedSdf ?? currentRun.sdfParams;
        const payload = buildContribution(currentRun, gradient, {
          contributorId: contributorId(),
          textSha256: sha,
          consent: consented,
          register: REGISTER,
          formParams: acceptedSdf,
          tune: currentTuneState,
        });
        const res = await submitContribution(payload);
        return res.ok === true;
      } catch {
        return false;
      }
    },
  });

  // "Make it yours" (FR-16): the visitor tunes the machine's reading within its
  // own vocabulary; neutral = the machine's read. Tuning re-renders the primary
  // form live; the machine's proposal stays the base (the contribution records
  // the tuned form + the delta).
  const tuneMount = document.createElement('div');
  tuneMount.hidden = true;
  root.appendChild(tuneMount);
  let currentTunedSdf: SdfParams | null = null;
  let currentTuneState: TuneState = DEFAULT_TUNE;
  const tune = createTunePanel(tuneMount, {
    onTune(t) {
      if (!currentRun) return;
      currentTuneState = t;
      currentTunedSdf = tuneSdf(currentRun.sdfParams, t);
      renderer.showSdf(currentTunedSdf, currentRun.seed);
    },
  });

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

  // ── Live typing: reuse the ONNX wrappers so a debounced run doesn't re-warm.
  interface ModelSet {
    embedder: Embedder;
    sensory: SensoryHead;
    denoiser: OnnxDenoiser;
    decoder: Decoder;
  }
  let models: ModelSet | null = null;
  async function getModels(m: ModelManifest): Promise<ModelSet> {
    if (!models) {
      models = {
        embedder: new Embedder(m),
        sensory: new SensoryHead(m),
        denoiser: new OnnxDenoiser(m),
        decoder: new Decoder(m),
      };
    }
    return models;
  }

  // The pipeline is the cost (~1–2s after warm-up), so debounce and don't run
  // concurrently. A live run renders the reading; "make a form" is the commit.
  let busy = false;
  let pendingLive = false;
  let liveTimer: ReturnType<typeof setTimeout> | null = null;
  const LIVE_DEBOUNCE_MS = 700;
  function scheduleLiveRun(): void {
    if (liveTimer) clearTimeout(liveTimer);
    if (!textarea.value.trim()) return;
    liveTimer = setTimeout(() => void runOnce(true), LIVE_DEBOUNCE_MS);
  }

  // The explicit commit ("make a form" / "try another" / ⌘↵): cancel any
  // pending live re-run so a just-committed reading (or a just-shared
  // contribution) is never clobbered by a stale debounce.
  function commitRun(): void {
    if (liveTimer) clearTimeout(liveTimer);
    pendingLive = false;
    void runOnce(false);
  }

  async function runOnce(preview = false): Promise<void> {
    if (busy) {
      if (preview) pendingLive = true;
      return;
    }
    const text = textarea.value.trim();
    if (!text) {
      if (!preview) line('type a sentence first.');
      return;
    }
    const driftValue = Math.min(1, Math.max(0, Number(drift.value) || DRIFT_DEFAULT));
    const seedValue = Math.max(1, Math.floor(Number(seed.value) || 42));
    const runId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `run-${Date.now()}`;

    busy = true;
    if (!preview) {
      progress.reset();
      progress.setStage('run', 'active');
      runButton.disabled = true;
    }
    try {
      if (!manifest) await loadStatic();
      const m = manifest as ModelManifest;
      if (!preview) progress.setStage('models', 'active');
      const { embedder, sensory, denoiser, decoder } = await getModels(m);

      const e = await embedder.embed(text);
      if (!preview) progress.setStage('models', 'done');
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
      if (!preview) store.add(run);
      renderer.show(run);
      alternates.render(cells, renderer.kind);

      const notes = computeMarginality(e, z, seedForms);
      marginalia.render(run, notes, seedForms);
      if (!preview) line(`this run's hash: ${fp.slice(0, 16)}… (same words, same knob, same seed — same form)`);
      // The crowd's hand (FR-16): judge the reading that just arrived.
      currentRun = run;
      readingLabel.hidden = false;
      coCreation.reset();
      coCreation.show();
      // "Make it yours": reset to the machine's read (already rendered); the
      // tune panel lets the visitor shape it before judging.
      currentTunedSdf = null;
      currentTuneState = DEFAULT_TUNE;
      tune.reset();
      tuneMount.hidden = false;
    } catch (err) {
      if (!preview) {
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
      } else {
        // Live preview: keep the last good reading; never surface an error on
        // every keystroke.
        console.warn('live reading failed', err);
      }
    } finally {
      if (!preview) {
        runButton.disabled = false;
        progress.setStage('run', 'done');
      }
      busy = false;
      if (pendingLive) {
        pendingLive = false;
        void runOnce(true);
      }
    }
  }

  runButton.addEventListener('click', commitRun);
  textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) commitRun();
  });
  // Live typing: a debounced reading as you pause; the button stays the commit.
  textarea.addEventListener('input', scheduleLiveRun);
  drift.addEventListener('input', scheduleLiveRun);
  seed.addEventListener('input', scheduleLiveRun);

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