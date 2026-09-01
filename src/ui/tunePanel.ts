/**
 * "Make it yours" — the visitor's hand on the machine's reading (FR-16).
 *
 * Three EXPRESSIVE controls over the machine's own vocabulary (not a property
 * inspector): voices, how the parts sit, lean. Neutral = the machine's read;
 * every move away from neutral is the human's mark (the delta). A "machine's
 * read" button returns to neutral. The machine's original proposal is never
 * destroyed — the visitor tunes a copy and the contribution records the tuned
 * form + the delta (the refinement field the aligner learns from).
 */

import type { TuneState } from '../aesthetics/tune';
import { DEFAULT_TUNE, tuneSummary } from '../aesthetics/tune';

export interface TuneCallbacks {
  /** Re-render the primary form with the tuned reading. */
  onTune(t: TuneState): void;
}

export interface TuneHandle {
  reset(): void;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function slider(label: string, min: number, max: number, step: number, value: number): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute('aria-label', label);
  input.dataset['label'] = label;
  return input;
}

export function createTunePanel(mount: HTMLElement, cb: TuneCallbacks): TuneHandle {
  mount.className = 'bs-tune';
  const heading = el('p', 'bs-tune-heading', 'and make it yours:');
  const row = el('div', 'bs-tune-row');

  const voices = slider('how much one thing', 0, 1, 0.01, DEFAULT_TUNE.voices);
  const separation = slider('how the parts sit', 0, 1, 0.01, DEFAULT_TUNE.separation);
  const lean = slider('lean into it', -1, 1, 0.01, DEFAULT_TUNE.lean);
  for (const [s, label] of [[voices, 'how much one thing'], [separation, 'how the parts sit'], [lean, 'lean into it']] as const) {
    const wrap = el('label', 'bs-tune-control');
    const name = el('span', 'bs-tune-name', label);
    const readout = el('span', 'bs-tune-readout');
    readout.dataset['for'] = label;
    s.addEventListener('input', () => {
      readout.textContent = Number(s.value).toFixed(2);
      emit();
    });
    // initial readout
    readout.textContent = Number(s.value).toFixed(2);
    wrap.append(name, s, readout);
    row.appendChild(wrap);
  }

  const summary = el('span', 'bs-tune-summary');
  const resetBtn = el('button', 'bs-tune-reset', 'machine\u2019s read') as HTMLButtonElement;
  resetBtn.type = 'button';
  resetBtn.addEventListener('click', () => setState(DEFAULT_TUNE, true));

  mount.append(heading, row, summary, resetBtn);

  function state(): TuneState {
    return { voices: Number(voices.value), separation: Number(separation.value), lean: Number(lean.value) };
  }

  function emit(): void {
    summary.textContent = `your hand: ${tuneSummary(state())}`;
    cb.onTune(state());
  }

  function setState(t: TuneState, emitChange: boolean): void {
    voices.value = String(t.voices);
    separation.value = String(t.separation);
    lean.value = String(t.lean);
    if (emitChange) {
      emit();
    } else {
      summary.textContent = `your hand: ${tuneSummary(t)}`;
    }
  }

  return {
    // UI neutral without re-rendering (the run already rendered the machine's
    // read); the reset button above re-renders it.
    reset: () => setState(DEFAULT_TUNE, false),
  };
}
