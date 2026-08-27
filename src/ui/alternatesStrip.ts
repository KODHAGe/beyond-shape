/**
 * Alternates strip (spec §2 FR-9): after a run, show ≥ 3 alternate forms —
 * seeds s+1 … s+3 — so the encounter opens into a *distribution*, not a single
 * answer. Rendering real alternates needs decoder-v1 (each alternate z decodes
 * to its own SdfParams); before binaries exist the strip renders its cells as
 * seeded placeholders — the honest scaffold state.
 */

export interface AlternatesHandle {
  render(alternates: Float32Array[], seeds: number[], primarySeed: number): void;
  clear(): void;
}

export function createAlternatesStrip(mount: HTMLElement): AlternatesHandle {
  mount.className = 'bs-alternates';
  const title = document.createElement('h3');
  title.textContent = 'also near: three other readings';
  const container = document.createElement('div');
  container.className = 'bs-alternates-row';
  mount.append(title, container);

  function cell(drawSeed: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'bs-alternate-cell';
    canvas.dataset['seed'] = String(drawSeed);
    canvas.width = 160;
    canvas.height = 160;
    container.appendChild(canvas);
    return canvas;
  }

  return {
    clear() {
      container.replaceChildren();
    },
    render(alternates: Float32Array[], seeds: number[], primarySeed: number) {
      container.replaceChildren();
      // The strip shows the alternates (FR-9); the primary is the main view.
      if (alternates.length === 0) {
        container.append(Object.assign(document.createElement('p'), { textContent: 'no alternates yet' }));
        return;
      }
      // Cells are seeded placeholders until decoder-v1 decodes each alternate
      // into SdfParams (post-training); the counts and seeds are real (FR-9).
      for (let i = 0; i < Math.min(alternates.length, 4); i += 1) {
        const drawSeed = seeds[i] ?? primarySeed + 1 + i;
        cell(drawSeed);
      }
    },
  };
}