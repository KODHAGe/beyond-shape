/**
 * Lighting grammar + EDGE POLICY (spec §3.4 / QR-4 minimal, A6).
 *
 * Grammar: warm key ~2.5 (#FFF3E0, shadow-casting), cool soft fill
 * (HemisphereLight pastel sky #FFE8F0 / warm ground #FFF4E0 ~0.5), cool rim
 * ~1.5 (#CFE8FF). Gradient pastel background; procedural PMREM env.
 *
 * Edge policy — at least ONE per composition of:
 *   1. a genuine shadow-casting key (soft ≠ absent),
 *   2. a saturated accent OUTSIDE the pastel bias range,
 *   3. withheld bloom.
 * Chosen deterministically from the run seed so the same reading always gets
 * the same composition (FR-10). The pastel palette is a bias, never a clamp.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { SeededRng } from '../core/seededRng';
import { clamp } from '../lib/math';

export const KEY_LIGHT = '#FFF3E0';
export const FILL_SKY = '#FFE8F0';
export const FILL_GROUND = '#FFF4E0';
export const RIM_LIGHT = '#CFE8FF';

export const PASTEL_SAT_RANGE: readonly [number, number] = [0.1, 0.7];
export const PASTEL_LIGHT_RANGE: readonly [number, number] = [0.5, 0.95];

export type EdgePolicyMode = 0 | 1 | 2; // shadow-key | saturated-accent | withheld-bloom

export interface EdgePolicy {
  mode: EdgePolicyMode;
  accentColor?: string;
  bloom: boolean; // withheld → false
}

export interface PaletteColors {
  /** CSS background string for RenderStateWire (used by the Canvas-2D path too). */
  background: string;
  /** Gradient stops for the Three.js texture background. */
  backgroundStops: [string, string];
  key: string;
  fill: string;
  rim: string;
}

function hslHex(hueIn: number, sat: number, light: number): string {
  const hue = (((hueIn % 1) + 1) % 1) * 360;
  const c = new THREE.Color().setHSL(hue / 360, clamp(sat, 0, 1), clamp(light, 0, 1));
  return `#${c.getHexString()}`;
}

/**
 * Palette derived from decoded SdfParams, biased (not clamped) toward pastel
 * (QR-4/A6). The fixed grammar colours stay bound; the material hue tints the
 * background gradient.
 */
export function paletteFromSdf(
  hue: number,
  saturation: number,
  lightness: number,
): PaletteColors {
  const bgTop = hslHex(hue, 0.20 + saturation * 0.15, 0.96);
  const bgBottom = hslHex(hue + 0.06, 0.16 + saturation * 0.12, 0.90 - lightness * 0.02);
  return {
    background: `linear-gradient(180deg, ${bgTop} 0%, ${bgBottom} 100%)`,
    backgroundStops: [bgTop, bgBottom],
    key: KEY_LIGHT,
    fill: FILL_SKY,
    rim: RIM_LIGHT,
  };
}

/**
 * Deterministic edge-policy pick per composition (seed-derived RNG).
 * mode 0 → shadow-casting key (soft PCF shadows, not absent — QR-4).
 * mode 1 → saturated accent OUTSIDE the pastel sat bias range.
 * mode 2 → withheld bloom (no bloom pass).
 */
export function chooseEdgePolicy(rng: SeededRng): EdgePolicy {
  const mode = rng.nextInt(3) as EdgePolicyMode;
  if (mode === 1) {
    const accentNum = new THREE.Color().setHSL(0.04, 0.92, 0.55).getHexString();
    return { mode, accentColor: `#${accentNum}`, bloom: true };
  }
  if (mode === 2) {
    return { mode, bloom: false };
  }
  return { mode, bloom: true };
}

export interface LightingHandle {
  key: THREE.DirectionalLight;
  fill: THREE.HemisphereLight;
  rim: THREE.DirectionalLight;
  policy: EdgePolicy;
  dispose(): void;
}

/**
 * Build the key/fill/rim grammar + apply the chosen edge policy.
 * `rng` is seed-derived: same reading → same rig, same edge choice (FR-10).
 * Env = procedural PMREM (RoomEnvironment), so reflections are on-device
 * generated, not network-loaded.
 */
export function buildLighting(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  rng: SeededRng,
): LightingHandle {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(KEY_LIGHT, 2.5);
  key.position.set(4, 6, 3);
  key.castShadow = true; // edge policy mode 0: genuine shadow-casting key
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0004;
  scene.add(key);

  const fill = new THREE.HemisphereLight(FILL_SKY, FILL_GROUND, 0.5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(RIM_LIGHT, 1.5);
  rim.position.set(-4, 2, -5);
  scene.add(rim);

  const policy = chooseEdgePolicy(rng);
  let accent: THREE.DirectionalLight | null = null;
  if (policy.mode === 1 && policy.accentColor) {
    accent = new THREE.DirectionalLight(policy.accentColor, 1.2);
    accent.position.set(-2, 1, 4);
    scene.add(accent);
  }

  return {
    key,
    fill,
    rim,
    policy,
    dispose() {
      scene.remove(key, fill, rim);
      if (accent) scene.remove(accent);
      pmrem.dispose();
    },
  };
}

/**
 * Gradient pastel background via CanvasTexture (register stays colour-light:
 * a field, not a filter — the reading's hue tints the gradient).
 */
export function gradientBackground(scene: THREE.Scene, stops: readonly [string, string]): void {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(1, stops[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}