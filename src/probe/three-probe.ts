/**
 * Standalone three.js render probe — does the RENDER LAYER work in this
 * browser at all, with zero app code in the way? It fetches one seed form,
 * marches the SDF exactly like the app, renders it with the app's material /
 * lighting grammar, and reports a live status line + frame counter + any
 * WebGL errors. Used to isolate whether "inaccessible renders" are a
 * three.js/WebGL2 problem (this page turns red) or something earlier in the
 * pipeline (this page stays healthy — then check probe-pipeline.html).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { sampleField } from '../core/sdfField';
import { marchCubes, laplacianSmooth } from '../render/marchingCubes';
import { buildLighting, gradientBackground, paletteFromSdf } from '../render/lighting';
import { physicalMaterial } from '../render/scene';
import { SeededRng } from '../core/seededRng';
import type { SdfParams } from '../types';

const panel = document.querySelector('#panel') as HTMLElement;
const fpsEl = document.querySelector('#fps') as HTMLElement;

function emit(className: 'ok' | 'err' | 'dim', text: string): void {
  const div = document.createElement('div');
  div.className = `s ${className}`;
  div.textContent = text;
  panel.appendChild(div);
}

emit('dim', `UA: ${navigator.userAgent}`);
emit('dim', `WebGPU (navigator.gpu): ${'gpu' in navigator ? 'present' : 'absent'}`);
emit('dim', `crossOriginIsolated: ${self.crossOriginIsolated ?? 'n/a'} · SharedArrayBuffer: ${typeof SharedArrayBuffer}`);

window.addEventListener('error', (ev) => emit('err', `window.onerror: ${ev.message} @ ${ev.filename}:${ev.lineno}`));
window.addEventListener('unhandledrejection', (ev) => emit('err', `unhandledrejection: ${String((ev.reason as Error | undefined)?.stack ?? ev.reason)}`));

// 1) WebGL2 capability probe (the same check the app uses).
let webgl2 = false;
try {
  const probe = document.createElement('canvas');
  webgl2 = probe.getContext('webgl2') !== null;
} catch {
  webgl2 = false;
}
emit(webgl2 ? 'ok' : 'err', `1. WebGL2 context: ${webgl2 ? 'AVAILABLE' : 'NOT AVAILABLE'}`);

// 2) three.js WebGLRenderer construction.
const container = document.querySelector('#view') as HTMLElement;
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  emit('ok', `2. THREE.WebGLRenderer created ✓ (isWebGL2=${renderer.capabilities.isWebGL2})`);
} catch (err) {
  emit('err', `2. THREE.WebGLRenderer FAILED: ${String(err)}`);
  throw err;
}

// 3) A real reading's mesh (first seed form; a plain sphere if fetch fails).
let sdf: SdfParams;
try {
  const res = await fetch('seed-forms.json');
  if (!res.ok) throw new Error(`seed-forms.json HTTP ${res.status}`);
  const raw: unknown = await res.json();
  const seeds = Array.isArray(raw) ? raw : (raw as { seeds?: { sdfParams?: SdfParams }[] }).seeds ?? [];
  const first = seeds[0]?.sdfParams ?? seeds[0];
  if (!first) throw new Error('no seed forms found');
  sdf = first as SdfParams;
  emit('ok', `3. seed form loaded ✓ ("${(seeds[0] as { text?: string }).text ?? ''}")`);
} catch (err) {
  emit('err', `3. seed fetch failed (${String(err)}) — falling back to a plain sphere; form palette may be neutral`);
  sdf = {
    weights: [1, 0, 0, 0, 0, 0, 0, 0],
    blendRadius: 0.15,
    parts: Array.from({ length: 8 }, () => ({ scale: [1, 1, 1] as [number, number, number], offset: [0, 0, 0] as [number, number, number], twist: 0, displacement: 0 })),
    material: { hue: 0.5, saturation: 0.4, lightness: 0.72, roughness: 0.5, metalness: 0, clearcoat: 0, emissive: 0 },
    motion: { breathe: 0, sway: 0 },
    pose: { yaw: 0, pitch: 0, roll: 0 },
  };
}

let geometry: THREE.BufferGeometry;
try {
  const field = sampleField(sdf);
  const marched = marchCubes(field, 48, 48, 48, -1.5, 1.5);
  const smooth = laplacianSmooth(marched.positions, marched.indices, 1);
  geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(smooth, 3));
  geometry.setIndex(new THREE.BufferAttribute(marched.indices, 1));
  geometry.computeVertexNormals();
  emit('ok', `4. mesh marched ✓ (${(marched.indices.length / 3) | 0} triangles, ${smooth.length / 3 | 0} verts)`);
} catch (err) {
  emit('err', `4. mesh build FAILED: ${String(err)}`);
  throw err;
}

// 5) Scene: same material/lighting grammar as the app's primary view.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(3.8, 2.2, 4.2);
camera.lookAt(0, 0, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;

// Real viewport-relative sizing (the app now does this too): without it the
// canvas keeps its default 300×150 backing and gets CSS-stretched → the
// "low res" artefact. Match CSS pixels × DPR capped at 2.
function sizeCanvas(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', sizeCanvas);

try {
  const palette = paletteFromSdf(sdf.material.hue, sdf.material.saturation, sdf.material.lightness);
  gradientBackground(scene, palette.backgroundStops);
  buildLighting(scene, renderer, new SeededRng(new Uint8Array(32)));
  const mesh = new THREE.Mesh(geometry, physicalMaterial(sdf));
  mesh.castShadow = true;
  scene.add(mesh);
  // Frame the actual object so "in shot" is guaranteed at any window size.
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere && sphere.radius > 0) {
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(dir, Math.max(2.6, sphere.radius * 2.85));
    camera.lookAt(sphere.center);
  }
  controls.update();
  sizeCanvas();
  emit('ok', '5. scene built ✓ (material + key/fill/rim lighting + gradient bg)');
} catch (err) {
  emit('err', `5. scene build FAILED: ${String(err)}`);
  throw err;
}

// 6) Live render loop with a frame counter + periodic GL error sweep.
let frames = 0;
let lastGlSweep = 0;
function animate(nowMs: number): void {
  controls.update();
  renderer.render(scene, camera);
  frames += 1;
  if (nowMs - lastGlSweep > 2000) {
    lastGlSweep = nowMs;
    const glErr = renderer.getContext().getError();
    if (glErr !== renderer.getContext().NO_ERROR) {
      emit('err', `WebGL error detected: gl.getError() = 0x${glErr.toString(16)}`);
    }
  }
  fpsEl.textContent = `${frames} frames rendered`;
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
emit('ok', '6. render loop running ✓ — see the counter top-right; the form should spin.');