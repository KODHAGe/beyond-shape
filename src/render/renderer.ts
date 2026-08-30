/**
 * Render path selection (spec §3.4 / QR-2): WebGL2 → Three.js scene; absent →
 * Canvas-2D SOFTWARE 3D PREVIEW (projection.ts) — the same decoded SdfParams,
 * marched to the same mesh three.js would render, but painted with a
 * per-face painter and ORBIT INPUT so the form can be turned in any browser.
 * The Three.js path is dynamically imported so the fallback never pays for the
 * WebGL bundle, and the painter never pays for three.
 *
 * RenderStateWire is computed purely (computeRenderState in scene.ts) so the
 * run record carries a deterministic wire state regardless of the render path.
 */

import type { RunRecord, SdfParams } from '../types';
import {
  attachOrbit,
  attachTurnHint,
  applyOrbitDelta,
  type ViewAngles,
} from './input';

export type RenderKind = 'webgl' | 'canvas2d';

/** Pure render-mode resolution (LR-6, testable without a GPU). */
export function resolveRenderMode(
  explicit: string | null | undefined,
  webgl2: boolean,
): RenderKind {
  if (explicit === 'webgl' || explicit === 'canvas2d') return explicit;
  return webgl2 ? 'webgl' : 'canvas2d';
}

/**
 * Runtime render-mode override (LR-6): URL `?render=webgl|canvas2d` first,
 * then the `VITE_BS_RENDER_MODE` env at build/dev time. Auto-detect otherwise.
 */
export function renderModeOverride(): string | null {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('render');
    if (q === 'webgl' || q === 'canvas2d') return q;
  }
  const env = import.meta.env?.VITE_BS_RENDER_MODE as string | undefined;
  return env === 'webgl' || env === 'canvas2d' ? env : null;
}

export interface AppRenderer {
  kind: RenderKind;
  /** Show a run's primary form. */
  show(run: RunRecord): void;
  /** Show an alternate/SdfParams directly (used by the alternates strip). */
  showSdf(sdf: SdfParams, seed: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** WebGL2 capability probe (three.js r163+ requires WebGL2; a WebGL1-only
 *  browser gets the software-3D tier, not a half-broken renderer). */
export function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return gl !== null && typeof gl === 'object';
  } catch {
    return false;
  }
}

/** QR-2: complete a run without WebGL2 by painting a shaded 2D projection. */
export async function createRenderer(container: HTMLElement): Promise<AppRenderer> {
  const mode = resolveRenderMode(renderModeOverride(), detectWebGL2());
  if (mode === 'webgl') {
    try {
      const { createWebglRenderer } = await import('./scene');
      return await createWebglRenderer(container);
    } catch (err) {
      console.warn('WebGL2 renderer failed to start — falling back to the software-3D preview:', err);
    }
  }
  return createCanvas2dRenderer(container);
}

// ── Canvas-2D software-3D tier ───────────────────────────────────────────────
// One marched mesh per reading (cached by the painter), repainted on orbit
// drags — reading the same "drag to turn" grammar as the WebGL tier.

function createCanvas2dRenderer(container: HTMLElement): AppRenderer {
  const canvas = document.createElement('canvas');
  canvas.className = 'bs-canvas2d';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas-2D unavailable — cannot render');

  type ProjectionModule = typeof import('./projection');
  let proj: ProjectionModule | null = null;
  let width = 640;
  let height = 480;
  let sdf: SdfParams | null = null;
  let view: ViewAngles = { yaw: 0, pitch: 0 };
  let frame = 0;

  async function ensureProj(): Promise<ProjectionModule> {
    if (proj) return proj;
    proj = await import('./projection');
    return proj;
  }

  function paint(): void {
    if (!proj || !sdf || !ctx) return;
    const mesh = proj.getSolidMesh(sdf);
    if (mesh.indices.length === 0) return;
    canvas.width = width;
    canvas.height = height;
    proj.paintSolid(ctx, mesh, sdf, view, { width, height });
  }

  function paintSoon(): void {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      paint();
    });
  }

  async function draw(next: SdfParams, drawSeed: number): Promise<void> {
    const p = await ensureProj();
    sdf = next;
    const mesh = p.getSolidMesh(next);
    if (mesh.indices.length === 0) {
      sdf = null;
      return;
    }
    view = p.initialView(drawSeed, next);
    paint();
  }

  // Orbit input (shared grammar with the WebGL tier — input.ts).
  const orbit = attachOrbit(canvas, (dYaw, dPitch) => {
    if (!sdf) return;
    view = applyOrbitDelta(view, dYaw, dPitch);
    paintSoon();
  });
  const hint = attachTurnHint(container, canvas);

  return {
    kind: 'canvas2d',
    show(run: RunRecord) {
      void draw(run.sdfParams, run.seed);
    },
    showSdf(s: SdfParams, drawSeed: number) {
      void draw(s, drawSeed);
    },
    resize(w: number, _h: number) {
      width = Math.max(320, w);
      height = Math.max(240, _h);
      if (sdf) paintSoon();
    },
    dispose() {
      if (frame !== 0) cancelAnimationFrame(frame);
      orbit.dispose();
      hint.dispose();
      canvas.remove();
    },
  };
}