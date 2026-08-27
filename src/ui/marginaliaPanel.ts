/**
 * Marginalia panel (spec §3.5 / FR-6 / FR-11): titled "a stranger's reading" —
 * "whose crowd is this nearest". Renders the seed constellation, the current
 * reading's position, the nearest seed text + centre form (cos-e / cos-z), and
 * the non-suppressible FR-11 marginal note when cos-e > 0.35. Populated with
 * zero network beyond same-origin static assets.
 */

import type { MarginalityNote, RunRecord, SeedForm } from '../types';
import { cosineSimilarity } from '../lib/math';

export const MARGINAL_NOTE_THRESHOLD = 0.35;

/** Pure positioning of a reading against the seed constellation (FR-6/FR-11). */
export function computeMarginality(e: Float32Array, z: Float32Array, seeds: readonly SeedForm[]): MarginalityNote[] {
  const notes: MarginalityNote[] = [];
  for (const seed of seeds) {
    const seedE = Float32Array.from(seed.e);
    const seedZ = Float32Array.from(seed.zCenter);
    const cosE = cosineSimilarity(e, seedE);
    const cosZ = cosineSimilarity(z, seedZ);
    notes.push({
      seed,
      cosE,
      cosZ,
      differs: cosZ < 0.9,
      note: composeNote(cosE, cosZ, seed),
    });
  }
  return notes.sort((a, b) => b.cosE - a.cosE);
}

function composeNote(cosE: number, cosZ: number, seed: SeedForm): string {
  if (cosE > MARGINAL_NOTE_THRESHOLD) {
    if (cosZ < 0.5) {
      return `a stranger reads this closer to "${seed.text}"; your form leans away from theirs.`;
    }
    return `a stranger reads this closer to "${seed.text}"; your form leans toward theirs.`;
  }
  return `the machine reads this nearest to "${seed.text}".`;
}

export interface MarginaliaHandle {
  render(run: RunRecord, notes: readonly MarginalityNote[], seeds: readonly SeedForm[]): void;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createMarginaliaPanel(mount: HTMLElement): MarginaliaHandle {
  mount.className = 'bs-marginalia';
  const title = el('h2', 'bs-marginalia-title', "a stranger's reading");
  const subtitle = el('p', 'bs-marginalia-sub', 'whose crowd is this nearest');
  const body = el('div', 'bs-marginalia-body');
  const note = el('p', 'bs-marginalia-note');
  note.hidden = true; // the FR-11 note is never suppressible once shown
  mount.append(title, subtitle, body, note);

  function render(_run: RunRecord, notes: readonly MarginalityNote[], seeds: readonly SeedForm[]): void {
    body.replaceChildren();
    if (seeds.length === 0) {
      body.append(el('p', 'bs-marginalia-empty', 'the crowd is still forming'));
      note.hidden = true;
      return;
    }
    const nearestE = notes[0];
    if (!nearestE) return;

    const pos = notes.indexOf(nearestE) + 1;
    const crowd = el('p', 'bs-marginalia-crowd');

    // Constellation: every centre, with the nearest read as "closest crowd".
    const constellation = el('ol', 'bs-marginalia-constellation');
    for (const n of notes) {
      const item = el('li', 'bs-marginalia-item', n.seed.text);
      if (n.seed.id === nearestE.seed.id) item.classList.add('nearest');
      const dist = el('span', 'bs-marginalia-dist');
      dist.textContent = `→ ${n.cosE.toFixed(3)} / ${n.cosZ.toFixed(3)}`;
      item.append(document.createTextNode(' '), dist);
      constellation.appendChild(item);
    }
    crowd.textContent = `this reading is closest to "${nearestE.seed.text}" (nearest ${pos + 1} of ${notes.length}).`;

    if (nearestE.cosE > MARGINAL_NOTE_THRESHOLD) {
      note.textContent = nearestE.note;
      note.hidden = false; // FR-11: the note must not be suppressible
    } else {
      note.hidden = true;
    }

    body.append(crowd, constellation);
  }

  return { render };
}