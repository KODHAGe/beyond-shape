/**
 * Render path selection (spec §3.4 / QR-2): WebGL2 → Three.js scene; absent →
 * Canvas-2D preview renderer (a 2D shaded/pastel projection of the DECODED
 * SdfParams — same parameter pipeline, untouched). The Three.js path is
 * dynamically imported so the fallback never pays for the WebGL bundle.
 *
 * RenderStateWire is computed purely (computeRenderState in scene.ts) so the
 * run record carries a deterministic wire state regardless of the render path.
 */

import type { RunRecord, SdfParams } from '../types';
import { SeededRng } from '../core/seededRng';

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

/** WebGL2 capability probe (deterministic, no side effects on real canvases). */
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
      console.warn('WebGL2 renderer failed to start — falling back to canvas-2D:', err);
    }
  }
  return createCanvas2dRenderer(container);
}

// ── Canvas-2D fallback ────────────────────────────────────────────────────────

function bisect<T extends { z: number }>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => b.z - a.z);
}

function createCanvas2dRenderer(container: HTMLElement): AppRenderer {
  const canvas = document.createElement('canvas');
  canvas.className = 'bs-canvas2d';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas-2D unavailable — cannot render');

  let width = 640;
  let height = 480;

  async function draw(sdf: SdfParams, drawSeed: number): Promise<void> {
    canvas.width = width;
    canvas.height = height;
    const g = ctx;
    if (!g) return;
    // Pastel gradient backdrop tinted by the reading's hue.
    const hue = (((sdf.material.hue % 1) + 1) % 1);
    const gradBack = g.createLinearGradient(0, 0, 0, height);
    gradBack.addColorStop(0, `hsl(${hue * 360} 60% 96%)`);
    gradBack.addColorStop(1, `hsl(${(hue + 0.05) * 360} 50% 90%)`);
    g.fillStyle = gradBack;
    g.fillRect(0, 0, width, height);

    const n = 48;
    const { sampleField } = await import('../core/sdfField');
    const field = sampleField(sdf, n, -1.5, 1.5);
    const { marchCubes } = await import('./marchingCubes');
    const mesh = marchCubes(field, n, n, n, -1.5, 1.5);
    if (mesh.indices.length === 0) return;
    const vl = mesh.positions;
    const il = mesh.indices;

    // Simple camera: yaw from drawSeed, pitch from pose.
    const rng = new SeededRng(
      new Uint8Array(32).fill(0).map((_, i) => (drawSeed * (i + 1)) & 0xff),
    );
    const yaw = rng.nextFloat() * Math.PI * 2;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(sdf.pose.pitch ?? 0);
    const sinP = Math.sin(sdf.pose.pitch ?? 0);
    const scale = Math.min(width, height) / 3.2;

    const tris: { z: number; pts: [number, number][]; shade: number }[] = [];
    for (let t = 0; t + 2 < il.length; t += 3) {
      let zAvg = 0;
      const pts: [number, number][] = [];
      const a = il[t]! * 3;
      const b = il[t + 1]! * 3;
      const c = il[t + 2]! * 3;
      const verts = [a, b, c];
      for (const v of verts) {
        const x = vl[v] ?? 0;
        const y2 = vl[v + 1] ?? 0;
        const z = vl[v + 2] ?? 0;
        // rotate yaw (about Y) then pitch (about X)
        const rx = x * cosY + z * sinY;
        const rz = -x * sinY + z * cosY;
        const ry = y2 * cosP - rz * sinP;
        const rz2 = y2 * sinP + rz * cosP;
        const px = width / 2 + rx * scale;
        const py = height / 2 - ry * scale;
        pts.push([px, py]);
        zAvg += rz2;
      }
      zAvg /= 3;
      // lambert-ish shading proxy: faces higher on screen read lighter
      // (light from above), edges read darker — a pastel field, not flat.
      const midY = (pts[0]![1] + pts[1]![1] + pts[2]![1]) / 3;
      const shade =
        0.55 +
        0.45 * Math.min(1, Math.max(0, 0.5 + (midY - height / 2) / (height * 0.6)));
      tris.push({ z: zAvg, pts, shade });
    }

    const sorted = bisect(tris);
    const baseSat = 0.25 + sdf.material.saturation * 0.5;
    const baseLig = 0.72 + sdf.material.lightness * 0.25;
    for (const tr of sorted) {
      const fill = `hsl(${hue * 360} ${Math.round(baseSat * 100)}% ${Math.round(
        baseLig * tr.shade * 100,
      )}%)`;
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(tr.pts[0]![0], tr.pts[0]![1]);
      g.lineTo(tr.pts[1]![0], tr.pts[1]![1]);
      g.lineTo(tr.pts[2]![0], tr.pts[2]![1]);
      g.closePath();
      g.fill();
    }
  }

  return {
    kind: 'canvas2d',
    show(run: RunRecord) {
      void draw(run.sdfParams, run.seed);
    },
    showSdf(sdf: SdfParams, drawSeed: number) {
      void draw(sdf, drawSeed);
    },
    resize(w: number, _h: number) {
      width = Math.max(320, w);
      height = Math.max(240, _h);
    },
    dispose() {
      canvas.remove();
    },
  };
}