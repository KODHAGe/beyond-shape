/**
 * Phase D Slice 1 — the co-creation loop (FR-16) + consent (FR-17/DR-2).
 *
 * After a form is generated the visitor judges it: KEEP (accept) / TRY ANOTHER
 * (adjust) / NOT THIS ONE (reject). Accept & reject arm an EXPLICIT "share to
 * the crowd" gated on one plain-language opt-in (DR-2); adjust regenerates a
 * new sample. Everything stays local until the share fires — `onSubmit`.
 */

export interface CoCreationCallbacks {  /** Regenerate with a new sample (adjust) — parent re-runs and reset()s us. */
  onAdjust(): void;
  /** Submit the judged gradient with the current consent state. */
  onSubmit(gradient: 'accept' | 'reject', consented: boolean): Promise<boolean>;
}

export interface CoCreationHandle {
  show(): void;
  reset(): void;
  setResult(text: string): void;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createCoCreation(mount: HTMLElement, cb: CoCreationCallbacks): CoCreationHandle {
  mount.className = 'bs-cocreation';

  const judgeRow = el('div', 'bs-cocreation-judge');
  const keepBtn = el('button', 'bs-cocreation-btn', 'keep this form') as HTMLButtonElement;
  const againBtn = el('button', 'bs-cocreation-btn', 'try another') as HTMLButtonElement;
  const rejectBtn = el('button', 'bs-cocreation-btn', 'not this one') as HTMLButtonElement;
  for (const b of [keepBtn, againBtn, rejectBtn]) b.type = 'button';
  judgeRow.append(keepBtn, againBtn, rejectBtn);

  // The consent area appears only once a terminal judge (keep / not this one)
  // is chosen — one plain-language opt-in, never a consent wall (Concept).
  const consentWrap = el('div', 'bs-cocreation-consent');
  consentWrap.hidden = true;
  const consentLabel = el('label', 'bs-cocreation-consent-label');
  const consentBox = document.createElement('input');
  consentBox.type = 'checkbox';
  consentLabel.append(
    consentBox,
    document.createTextNode(
      ' this is a collective artwork — your sentence and the form it made can ' +
        'join the crowd, published openly under CC BY-SA. nothing is sent unless ' +
        'you opt in (anonymous; no account).',
    ),
  );
  consentWrap.append(consentLabel);

  const shareRow = el('div', 'bs-cocreation-share');
  shareRow.hidden = true;
  const shareBtn = el('button', 'bs-cocreation-share-btn', 'share to the crowd') as HTMLButtonElement;
  shareBtn.type = 'button';
  shareBtn.disabled = true;
  const shareNote = el('span', 'bs-cocreation-share-note');
  shareRow.append(shareBtn, shareNote);
  consentWrap.append(shareRow);

  const result = el('p', 'bs-cocreation-result');
  result.hidden = true;

  mount.append(judgeRow, consentWrap, result);

  let gradient: 'accept' | 'reject' | null = null;

  function arm(g: 'accept' | 'reject'): void {
    gradient = g;
    consentWrap.hidden = false;
    shareRow.hidden = false;
    keepBtn.classList.toggle('chosen', g === 'accept');
    rejectBtn.classList.toggle('chosen', g === 'reject');
    againBtn.classList.toggle('chosen', false);
    shareBtn.disabled = !consentBox.checked;
    shareNote.textContent = g === 'accept' ? 'give this reading to the crowd' : 'record that this one missed';
  }

  keepBtn.addEventListener('click', () => arm('accept'));
  rejectBtn.addEventListener('click', () => arm('reject'));
  againBtn.addEventListener('click', () => cb.onAdjust());
  consentBox.addEventListener('change', () => {
    shareBtn.disabled = !consentBox.checked;
  });
  shareBtn.addEventListener('click', () => {
    if (!gradient || !consentBox.checked) return;
    shareBtn.disabled = true;
    void cb.onSubmit(gradient, consentBox.checked).then((ok) => {
      if (ok) {
        result.textContent = 'in the crowd now.';
        result.hidden = false;
        consentWrap.hidden = true;
        keepBtn.disabled = true;
        rejectBtn.disabled = true;
      } else {
        shareBtn.disabled = !consentBox.checked;
        shareNote.textContent = 'that didn\u2019t reach the crowd — try again.';
      }
    });
  });

  return {
    show() {
      mount.hidden = false;
    },
    reset() {
      gradient = null;
      consentBox.checked = false;
      consentWrap.hidden = true;
      shareRow.hidden = true;
      shareBtn.disabled = true;
      shareNote.textContent = '';
      result.hidden = true;
      result.textContent = '';
      keepBtn.disabled = false;
      rejectBtn.disabled = false;
      keepBtn.classList.remove('chosen');
      rejectBtn.classList.remove('chosen');
    },
    setResult(text: string) {
      result.textContent = text;
      result.hidden = false;
    },
  };
}
