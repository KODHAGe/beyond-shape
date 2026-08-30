/**
 * The aesthetic lab — a DECISION TOOL, not a slider buffet (Concept verdict
 * on the lever proposals). Two coherence cards (clay / collision) render the
 * SAME reading at the SAME drift through the register retune layer; a shared
 * spindle slider turns the consensus ⇄ edge axis; under each card the same
 * reading is shown at three stations of the spindle, left → right, so the
 * "distribution, center, and edges" is visible as one composition (C1/C2,
 * FR-8/FR-9). Everything derived from decoded SdfParams — no new semantics.
 */

import { retune, structureRichness } from '../aesthetics/register';
import type { RegisterKind } from '../aesthetics/register';
import { createCellScene } from '../render/scene';
import { getSolidMesh } from '../render/projection';
import { attachTurnHint } from '../render/input';
import { clamp } from '../lib/math';
import { fetchManifest, requireModelFile } from '../core/models';
import { BertTokenizer } from '../core/tokenizer';
import { Embedder } from '../core/embedding';
import { SensoryHead } from '../core/sensory';
import { OnnxDenoiser, generateDistribution } from '../core/generator';
import { Decoder } from '../core/sdfParams';
import type { SdfParams } from '../types';

const LAB_SEED = 7; // one camera language across the whole comparison
const GEN_SEED = 11; // generation seed — same sentence, same read
const STATIONS = [0.15, 0.5, 0.85];
const PRESENCE_SENTENCES = 30; // the whole (growing) seed corpus
const ACTIVE_SHAPE_THRESHOLD = 0.08;

/** How many parts of a reading are actually present (weight above a floor). */
function activeShapes(sdf: SdfParams): number {
  return sdf.weights.reduce((n, w) => (w > ACTIVE_SHAPE_THRESHOLD ? n + 1 : n), 0);
}

/** The reading's voices, loud to quiet ("amount of shapes", transparently). */
function voiceList(sdf: SdfParams): string {
  return sdf.weights
    .filter((w) => w > 0.02)
    .sort((a, b) => b - a)
    .map((w) => w.toFixed(2))
    .join(' · ');
}

function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

interface LabSeed {
  text: string;
  tokens: number;
  sdfParams: SdfParams;
}

async function loadSeedForms(): Promise<LabSeed[]> {
  const res = await fetch('seed-forms.json');
  if (!res.ok) throw new Error(`seed-forms.json HTTP ${res.status}`);
  const raw: unknown = await res.json();
  const seeds = Array.isArray(raw) ? raw : (raw as { seeds?: { text?: string; sdfParams?: SdfParams }[] }).seeds ?? [];
  return seeds
    .filter((s): s is { text?: string; sdfParams: SdfParams } => Boolean(s && s.sdfParams))
    .slice(0, PRESENCE_SENTENCES)
    .map((s, i) => ({
      text: s.text?.trim() || `reading ${i + 1}`,
      tokens: (s.text ?? '').trim().split(/\s+/).filter(Boolean).length,
      sdfParams: s.sdfParams,
    }));
}

interface CardHandle {
  main: SceneDispose[];
  stations: SceneDispose[];
}

type SceneDispose = () => void;

function disposeAll(handles: SceneDispose[]): void {
  for (const h of handles) h();
  handles.length = 0;
}

function buildLab(): void {
  const root = document.querySelector('.lab-root') as HTMLElement;
  if (!detectWebGL2()) {
    root.innerHTML = '<div class="lab-missing">this design tool needs WebGL2 — open it in Safari, Firefox, or Chrome with a GPU.</div>';
    return;
  }

  const sentenceSelect = document.querySelector('#lab-sentence') as HTMLSelectElement;
  const sentenceText = document.querySelector('#lab-sentence-text') as HTMLElement;
  const driftInput = document.querySelector('#lab-drift') as HTMLInputElement;
  const driftReadout = document.querySelector('#lab-drift-readout') as HTMLSpanElement;
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.lab-card'));

  const cardDisposers = new Map<string, CardHandle>();
  let forms: LabSeed[] = [];

  // One "drag to turn" affordance per card, attached once (survives rebuilds).
  const cardHints: SceneDispose[] = [];
  for (const card of cards) {
    const trigger = card.querySelector('.lab-main') as HTMLElement;
    const hint = attachTurnHint(card, trigger);
    cardHints.push(() => hint.dispose());
  }

  function presenceOf(sdf: SdfParams): number {
    const mesh = getSolidMesh(sdf);
    return clamp(1.7 - mesh.radius / 1.7, 0.6, 1.7); // small stays small, large stays large
  }

  function buildSceneInto(mount: HTMLElement, sdf: SdfParams, disposers: SceneDispose[]): void {
    const handle = createCellScene(mount, LAB_SEED, sdf, { presence: presenceOf(sdf) });
    const rect = mount.getBoundingClientRect();
    handle.resize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)));
    disposers.push(() => handle.dispose());

    const resize = (): void => {
      const r = mount.getBoundingClientRect();
      handle.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    disposers.push(() => ro.disconnect());
    resize();
  }

  function renderCard(card: HTMLElement, form: SdfParams, drift: number, richness: number): void {
    const kind = card.dataset['register'] as RegisterKind;
    let cardHandle = cardDisposers.get(kind);
    if (cardHandle) {
      disposeAll(cardHandle.main);
      disposeAll(cardHandle.stations);
    } else {
      cardHandle = { main: [], stations: [] };
      cardDisposers.set(kind, cardHandle);
    }

    // Main view: the reading at this drift, register-lived.
    const mainMount = card.querySelector('.lab-main') as HTMLElement;
    mainMount.replaceChildren();
    buildSceneInto(mainMount, retune(form, kind, drift, richness), cardHandle.main);

    // Stations: the same reading turned along the spindle (left → right).
    const stationsMount = card.querySelector('.lab-stations') as HTMLElement;
    stationsMount.replaceChildren();
    for (const stationDrift of STATIONS) {
      const cell = document.createElement('div');
      cell.className = 'lab-station';
      const label = document.createElement('span');
      label.textContent = `drift ${stationDrift.toFixed(2)}`;
      cell.append(label);
      stationsMount.appendChild(cell);
      buildSceneInto(cell, retune(form, kind, stationDrift, richness), cardHandle.stations);
    }
  }

  function renderAll(): void {
    const drift = Number(driftInput.value) || 0;
    const idx = Math.max(0, Math.min(forms.length - 1, Number(sentenceSelect.value) || 0));
    const seed = forms[idx];
    if (!seed) return;
    driftReadout.textContent = drift.toFixed(2);

    // Structure: automatic (richness follows length) or the manual override.
    const richness = richnessAuto.checked
      ? structureRichness(seed.tokens)
      : Number(richnessInput.value) || 0;
    richnessReadout.textContent = richnessAuto.checked
      ? `auto · ${structureRichness(seed.tokens).toFixed(2)}`
      : richness.toFixed(2);

    const clayShapes = activeShapes(retune(seed.sdfParams, 'clay', drift, richness));
    const colShapes = activeShapes(retune(seed.sdfParams, 'collision', drift, richness));
    const clayVoices = voiceList(retune(seed.sdfParams, 'clay', drift, richness));
    const colVoices = voiceList(retune(seed.sdfParams, 'collision', drift, richness));
    // A rich-but-single-voice reading is a HONEST dead-end for the aesthetic
    // layer: the decoder produced a one-hot, and no flattening can surface
    // voices that were never decoded. Shown plainly — the fix is model-level.
    const collapsed = richness > 0.4 && colShapes === 1;
    sentenceText.textContent =
      `“${seed.text}” — ${seed.tokens} ${seed.tokens === 1 ? 'word' : 'words'} · structure ${richness.toFixed(2)}` +
      ` · parts: clay ${clayShapes} (${clayVoices}) · collision ${colShapes} (${colVoices})` +
      (collapsed
        ? ' — richness can’t raise voices the decoder never made (one-hot collapse); structure belongs in the model conditioning (Phase C).'
        : '');
    for (const card of cards) renderCard(card, seed.sdfParams, drift, richness);
  }

  // ── read your own sentence (the "longer sentences?" question, on device) ──
  const customInput = document.querySelector('#lab-custom') as HTMLInputElement;
  const readButton = document.querySelector('#lab-read') as HTMLButtonElement;
  let tokenizerPromise: Promise<BertTokenizer> | null = null;

  async function runCustomSentence(): Promise<void> {
    const text = customInput.value.trim();
    if (!text) return;
    readButton.disabled = true;
    sentenceText.textContent = `reading “${text.slice(0, 60)}” …`;
    try {
      const manifest = await fetchManifest();
      const maxTokens = manifest.artifacts.embedder.maxTokens ?? 256;
      if (!tokenizerPromise) {
        tokenizerPromise = BertTokenizer.fromFile(
          requireModelFile(manifest.artifacts.tokenizer, 'tokenizer'),
        );
      }
      const tokenizer = await tokenizerPromise;
      const { ids } = tokenizer.tokenize(text, maxTokens);

      const embedder = new Embedder(manifest);
      const sensory = new SensoryHead(manifest);
      const denoiser = new OnnxDenoiser(manifest);
      const decoder = new Decoder(manifest);

      const e = await embedder.embed(text);
      const q = await sensory.forward(e);
      const richness = structureRichness(await embedder.tokenCount(text));
      const zs = await generateDistribution({ text, e, q, drift: 0.4, seed: GEN_SEED, denoiser, richness });
      const sdfParams = await decoder.decode(zs[0] as Float32Array);

      const seed: LabSeed = { text, tokens: ids.length, sdfParams };
      forms.push(seed);
      const opt = document.createElement('option');
      opt.value = String(forms.length - 1);
      opt.textContent = seed.text;
      sentenceSelect.appendChild(opt);
      sentenceSelect.value = String(forms.length - 1);
      renderAll();
    } catch (err) {
      sentenceText.textContent = `couldn't read that: ${(err as Error).message}`;
    } finally {
      readButton.disabled = false;
    }
  }
  readButton.addEventListener('click', () => void runCustomSentence());
  customInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') void runCustomSentence();
  });

  driftInput.addEventListener('input', renderAll);
  sentenceSelect.addEventListener('change', renderAll);

  // Structure control: auto (richness by length) or a manual laboratory scrub.
  const richnessInput = document.querySelector('#lab-richness') as HTMLInputElement;
  const richnessReadout = document.querySelector('#lab-richness-readout') as HTMLSpanElement;
  const richnessAuto = document.querySelector('#lab-richness-auto') as HTMLInputElement;
  function syncRichnessControl(): void {
    richnessInput.disabled = richnessAuto.checked;
    renderAll();
  }
  richnessInput.addEventListener('input', renderAll);
  richnessAuto.addEventListener('change', syncRichnessControl);
  syncRichnessControl();

  loadSeedForms()
    .then((loaded) => {
      forms = loaded;
      loaded.forEach((seed, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = seed.text;
        sentenceSelect.appendChild(opt);
      });
      renderAll();
    })
    .catch((err: Error) => {
      root.insertAdjacentHTML(
        'beforeend',
        `<p class="lab-note">couldn't load the seed corpus: ${err.message}</p>`,
      );
    });
}

buildLab();