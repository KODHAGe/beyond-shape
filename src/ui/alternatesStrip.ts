/**
 * Alternates strip (spec §2 FR-9): after a run, show ≥ 3 alternate forms —
 * seeds s+1 … s+3 — so the encounter opens into a *distribution*, not a single
 * answer. Since Phase B shipped decoder-v1 each cell now DECODES its own
 * alternate z into SdfParams and renders the same 3D language as the primary:
 *   - WebGL tier  → a lightweight three scene (scene.createCellScene)
 *   - Canvas tier → the software-3D painter (projection.ts), orbitable, so a
 *     no-WebGL browser still gets turnable forms — never blank white boxes.
 * A cell whose decode fails keeps an honest seeded "sketch not yet" wash
 * rather than pretending to a form.
 */

import type { SdfParams } from '../types';
import type { RenderKind } from '../render/renderer';
import {
  attachOrbit,
  applyOrbitDelta,
  type OrbitHandle,
  type ViewAngles,
} from '../render/input';

const CELL_PX = 200;

export interface AlternateCell {
  seed: number;
  sdf: SdfParams | null;
}

export interface AlternatesOptions {
  onSelect?: (cell: AlternateCell) => void;
}

export interface AlternatesHandle {
  render(cells: AlternateCell[], kind: RenderKind): void;
  clear(): void;
}

export function createAlternatesStrip(mount: HTMLElement, opts?: AlternatesOptions): AlternatesHandle {
  mount.className = 'bs-alternates';
  const title = document.createElement('h3');
  // FR-9: the alternates are OTHER READINGS of the SAME sentence (same words, a
  // few seeds), not other sentences — made explicit so the strip isn't vague.
  title.textContent = 'the same words, read a few other ways';
  const container = document.createElement('div');
  container.className = 'bs-alternates-row';
  mount.append(title, container);

  // Lazy painter module (shared across cells; webgl chunk never loads it).
  let proj: typeof import('../render/projection') | null = null;
  async function ensureProj(): Promise<typeof import('../render/projection')> {
    if (proj) return proj;
    proj = await import('../render/projection');
    return proj;
  }

  const disposers: (() => void)[] = [];

  function disposeAll(): void {
    for (const d of disposers) d();
    disposers.length = 0;
  }

  /** Seeded pale wash — an honest placeholder, never a broken white void. */
  function paintPlaceholder(canvas: HTMLCanvasElement, seed: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = CELL_PX;
    canvas.height = CELL_PX;
    const t = Math.sin(seed * 7.31) * 43758.5453 % 1;
    const hue = (t < 0 ? t + 1 : t) * 360;
    const grad = ctx.createLinearGradient(0, 0, 0, CELL_PX);
    grad.addColorStop(0, `hsl(${hue} 45% 97%)`);
    grad.addColorStop(1, `hsl(${(hue + 8) % 360} 40% 93%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CELL_PX, CELL_PX);
  }

  function softwareCell(wrapper: HTMLElement, cell: AlternateCell): void {
    const canvas = document.createElement('canvas');
    canvas.className = 'bs-alternate-canvas';
    wrapper.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let view: ViewAngles = { yaw: 0, pitch: 0 };
    let frame = 0;
    let orbit: OrbitHandle | null = null;
    let cancelled = false;
    disposers.push(() => {
      cancelled = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      orbit?.dispose();
    });

    void ensureProj().then((p) => {
      if (cancelled || !cell.sdf) return;
      const mesh = p.getSolidMesh(cell.sdf);
      if (mesh.indices.length === 0) return;
      view = p.initialView(cell.seed, cell.sdf);
      const paint = (): void => {
        canvas.width = CELL_PX;
        canvas.height = CELL_PX;
        p.paintSolid(ctx, mesh, cell.sdf!, view, { width: CELL_PX, height: CELL_PX });
      };
      paint();
      orbit = attachOrbit(canvas, (dYaw, dPitch) => {
        if (cancelled || !cell.sdf) return;
        view = applyOrbitDelta(view, dYaw, dPitch);
        if (frame !== 0) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          p.paintSolid(ctx, mesh, cell.sdf!, view, { width: CELL_PX, height: CELL_PX });
        });
      });
    });
  }

  function webglCell(wrapper: HTMLElement, cell: AlternateCell): void {
    let h: ReturnType<typeof import('../render/scene').createCellScene> | null = null;
    let cancelled = false;
    disposers.push(() => {
      cancelled = true;
      h?.dispose();
    });
    void import('../render/scene').then(({ createCellScene }) => {
      if (cancelled || !cell.sdf) return;
      h = createCellScene(wrapper, cell.seed, cell.sdf);
      h.resize(CELL_PX, CELL_PX);
    });
  }

  return {
    clear() {
      disposeAll();
      container.replaceChildren();
    },
    render(cells: AlternateCell[], kind: RenderKind) {
      disposeAll();
      container.replaceChildren();
      if (cells.length === 0) {
        container.append(Object.assign(document.createElement('p'), { textContent: 'no alternates yet' }));
        return;
      }
      for (const cell of cells.slice(0, 4)) {
        const wrapper = document.createElement('div');
        wrapper.className = 'bs-alternate-cell';
        wrapper.dataset['seed'] = String(cell.seed);
        if (cell.sdf && opts?.onSelect) {
          wrapper.setAttribute('role', 'button');
          wrapper.setAttribute('tabindex', '0');
          wrapper.setAttribute('aria-label', `alternate reading seed ${cell.seed}`);
          const select = (): void => {
            if (cell.sdf && opts?.onSelect) opts.onSelect(cell);
          };
          wrapper.addEventListener('click', select);
          wrapper.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              select();
            }
          });
        }
        if (cell.sdf && kind === 'webgl') {
          webglCell(wrapper, cell);
        } else if (cell.sdf) {
          softwareCell(wrapper, cell);
        } else {
          const canvas = document.createElement('canvas');
          canvas.className = 'bs-alternate-placeholder';
          wrapper.appendChild(canvas);
          paintPlaceholder(canvas, cell.seed);
        }
        container.appendChild(wrapper);
      }
    },
  };
}