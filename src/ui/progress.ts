/**
 * QR-1 warm-up surface (spec §3.1 load order): app shell → low-fi placeholder
 * → renderer → embedder → generator. The progress panel shows what is waking
 * up before the first run finishes, and surfaces the friendly scaffold error
 * when binaries are missing ("models not built yet — run
 * scripts/train_generator.py").
 */

export type StageId = 'shell' | 'placeholder' | 'manifest' | 'renderer' | 'models' | 'run';

const STAGE_LABELS: { [k in StageId]: string } = {
  shell: 'the room is waking up',
  placeholder: 'a quiet shape before the words',
  manifest: 'finding the models',
  renderer: 'setting up the light',
  models: 'waking the machines',
  run: 'reading your sentence',
};

export type StageStatus = 'idle' | 'active' | 'done' | 'error';

export class Progress {
  private readonly el: HTMLElement;
  private readonly rows = new Map<StageId, HTMLElement>();

  constructor(mount: HTMLElement) {
    this.el = mount;
    this.el.className = 'bs-progress';
    (Object.keys(STAGE_LABELS) as StageId[]).forEach((id) => {
      const row = document.createElement('div');
      row.className = 'bs-progress-row';
      row.dataset['stage'] = id;
      const dot = document.createElement('span');
      dot.className = 'bs-progress-dot';
      const label = document.createElement('span');
      label.className = 'bs-progress-label';
      label.textContent = STAGE_LABELS[id];
      row.append(dot, label);
      this.el.appendChild(row);
      this.rows.set(id, row);
    });
  }

  setStage(stage: StageId, status: StageStatus): void {
    const row = this.rows.get(stage);
    if (!row) return;
    row.dataset['status'] = status;
    const dot = row.querySelector('.bs-progress-dot');
    if (dot) dot.textContent = status === 'done' ? '✓' : status === 'active' ? '…' : status === 'error' ? '!' : '·';
  }

  reset(): void {
    for (const row of this.rows.values()) {
      row.dataset['status'] = 'idle';
      const dot = row.querySelector('.bs-progress-dot');
      if (dot) dot.textContent = '·';
    }
  }

  /** Plain-reader note in the progress area (scaffold / error states). */
  message(text: string, kind: 'info' | 'error' = 'info'): void {
    let note = this.el.querySelector('.bs-progress-note');
    if (!note) {
      note = document.createElement('p');
      note.className = 'bs-progress-note';
      this.el.appendChild(note);
    }
    note.textContent = text;
    (note as HTMLElement).dataset['kind'] = kind;
  }
}