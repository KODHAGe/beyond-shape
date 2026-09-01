/**
 * Three.js scene factory (spec §3.4 / QR-4): ACES + sRGB + PCFSoftShadowMap,
 * MeshPhysicalMaterial from SdfParams, seed-derived camera with a fixed orbit
 * (idle animation opt-in, default OFF — FR-10), mesh from the in-repo marching
 * cubes (48³ + one Laplacian pass for 'soft' morph; 64³ raw for 'cut' creases)
 * + computeVertexNormals.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { RenderStateWire, RunRecord, SdfParams } from '../types';
import { SeededRng } from '../core/seededRng';
import type { BlendMode } from '../core/sdfField';
import { getSolidMesh, THREE_QUARTER_YAW_OFFSET } from './projection';
import { buildLighting, gradientBackground, paletteFromSdf } from './lighting';
import { attachTurnHint } from './input';

const CAMERA_FOV = 45;

/** Deterministic 32-byte scratch derived from an integer seed (camera/lights). */
function seedBytes(seed: number): Uint8Array {
  const out = new Uint8Array(32);
  let h = seed >>> 0;
  for (let i = 0; i < 32; i += 1) {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
    out[i] = (h ^ (h >>> 16)) & 0xff;
  }
  return out;
}

/** Deterministic camera pose for a reading (same seed → same view, FR-10). */
function cameraFromSeed(seed: number): { pos: [number, number, number]; target: [number, number, number] } {
  const rng = new SeededRng(seedBytes(seed));
  const radius = 3.6 + rng.nextFloat() * 0.4;
  const azimuth = rng.nextFloat() * Math.PI * 2 + THREE_QUARTER_YAW_OFFSET;
  const elevation = (rng.nextFloat() - 0.5) * 0.7;
  const target: [number, number, number] = [0, 0, 0];
  return {
    pos: [
      Math.cos(azimuth) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius + 0.4,
      Math.sin(azimuth) * Math.cos(elevation) * radius,
    ],
    target,
  };
}

/** Pure RenderStateWire for a run: seed-derived camera + sdf-derived palette. */
export function computeRenderState(seed: number, sdf: SdfParams): RenderStateWire {
  const palette = paletteFromSdf(sdf.material.hue, sdf.material.saturation, sdf.material.lightness);
  return {
    camera: cameraFromSeed(seed),
    palette: {
      background: palette.background,
      key: palette.key,
      fill: palette.fill,
      rim: palette.rim,
    },
  };
}

export function physicalMaterial(sdf: SdfParams, perPartColor = false): THREE.MeshPhysicalMaterial {
  const m = sdf.material;
  const hue = (((m.hue % 1) + 1) % 1);
  const color = new THREE.Color().setHSL(hue, Math.min(1, Math.max(0, m.saturation)), Math.min(1, Math.max(0, m.lightness)));
  return new THREE.MeshPhysicalMaterial({
    color: perPartColor ? 0xffffff : color,
    vertexColors: perPartColor,
    roughness: m.roughness,
    metalness: m.metalness,
    clearcoat: m.clearcoat,
    clearcoatRoughness: 0.35,
    emissive: new THREE.Color().setHSL(hue, m.saturation, Math.min(0.5, m.emissive * 0.5)),
    emissiveIntensity: m.emissive * 0.4,
  });
}

export interface SceneOptions {
  /** 'soft' = smooth morph (FR-7); 'cut' = hard union of active parts (the
   *  original's overlapping solids). Default 'soft'. */
  blend?: BlendMode;
  /** Per-part vertex colours (each voice in its own fabric). Default true. */
  perPartColor?: boolean;
}

export interface SceneHandle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  wireState: RenderStateWire;
  setSdf(sdf: SdfParams): void;
  resize(width: number, height: number): void;
  render(): void;
  dispose(): void;
}

/** One full Three.js scene for a reading (seeded for determinism, FR-10). */
export function createScene(container: HTMLElement, seed: number, sdf: SdfParams, opts?: SceneOptions): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const blend = opts?.blend ?? sdf.blendMode ?? 'soft';
  const perPartColor = opts?.perPartColor ?? true;

  const scene = new THREE.Scene();
  const camPose = cameraFromSeed(seed);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  camera.position.set(...camPose.pos);
  camera.lookAt(...camPose.target);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...camPose.target);
  controls.enableDamping = false; // no idle loop here — drags repaint via 'change'
  controls.autoRotate = false; // idle animation opt-in, default OFF (FR-10)
  controls.enablePan = false; // the form stays centred — you turn it, you don't park it
  controls.update();

  const turnHint = attachTurnHint(container, renderer.domElement);

  const lightingRng = new SeededRng(seedBytes(seed ^ 0x5f3759df));
  const lighting = buildLighting(scene, renderer, lightingRng);
  const palette = paletteFromSdf(sdf.material.hue, sdf.material.saturation, sdf.material.lightness);
  gradientBackground(scene, palette.backgroundStops);

  let mesh: THREE.Mesh | null = null;
  let geometry: THREE.BufferGeometry | null = null;

  function renderScene(): void {
    // Render ONLY — not controls.update(). OrbitControls settles the camera
    // and dispatches 'change' before our listener runs; re-entering update()
    // from a change listener recurses (three snapshots _lastPosition AFTER
    // dispatchEvent, so the next update sees a "moved" camera → re-dispatch →
    // RangeError: Maximum call stack size exceeded).
    renderer.render(scene, camera);
  }

  /**
   * Frame the object, not a guess: keep the seeded azimuth/elevation (FR-10
   * determinism for the reading) but pull the distance out to the mesh's
   * bounding sphere, and target its centre — so any decoded form, however
   * large or lopsided, sits centred and in shot.
   */
  function fitCameraToMesh(): void {
    if (!geometry) return;
    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    if (!sphere || sphere.radius <= 0) return;
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (dir.lengthSq() < 1e-9) dir.set(0, 1, 0);
    dir.normalize();
    // FOV-correct fit: the bounding sphere's projected radius must fit within
    // the view frustum, with a little margin (old `radius * 2.85` was a
    // constant heuristic that clipped very large / drift-separated forms).
    const fit = sphere.radius / Math.tan((CAMERA_FOV * Math.PI) / 360) * 1.12;
    const distance = Math.max(2.6, fit);
    const centre = sphere.center;
    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(dir, distance);
    controls.minDistance = Math.max(1.2, distance * 0.5);
    controls.maxDistance = distance * 4;
    camera.lookAt(centre);
    controls.update();
  }

  const handle: SceneHandle = {
    renderer,
    scene,
    camera,
    controls,
    wireState: {
      camera: camPose,
      palette: {
        background: palette.background,
        key: palette.key,
        fill: palette.fill,
        rim: palette.rim,
      },
    },
    setSdf(next: SdfParams) {
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        mesh = null;
      }
      // Shared builder (same mesh both tiers): positions + per-part vertex
      // colours, in the requested blend mode (soft morph / hard cut).
      const solid = getSolidMesh(next, blend);
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(solid.positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(solid.indices, 1));
      geometry.computeVertexNormals(); // spec §3.4
      if (perPartColor) {
        geometry.setAttribute('color', new THREE.BufferAttribute(solid.colors, 3));
      }
      mesh = new THREE.Mesh(geometry, physicalMaterial(next, perPartColor));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      fitCameraToMesh();
    },
    resize(width: number, height: number) {
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderScene();
    },
    render() {
      renderScene();
    },
    dispose() {
      controls.dispose();
      turnHint.dispose();
      renderer.dispose();
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      lighting.dispose();
      renderer.domElement.remove();
    },
  };

  // Repaint live while the user drags the form (no idle loop — FR-10 keeps
  // auto-rotation off; the change event carries the interaction instead).
  controls.addEventListener('change', renderScene);

  handle.setSdf(sdf);
  return handle;
}

// ── WebGL adapter surface for AppRenderer (renderer.ts dynamic-imports this) ─

export interface WebglRendererSurface {
  kind: 'webgl';
  show(run: RunRecord): void;
  showSdf(sdf: SdfParams, seed: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** One scene per reading — rebuilt when the seed/sdf changes (deterministic). */
export function createWebglRenderer(container: HTMLElement): WebglRendererSurface {
  let handle: SceneHandle | null = null;
  let lastWidth = 640;
  let lastHeight = 480;

  function build(seed: number, sdf: SdfParams): void {
    handle?.dispose();
    handle = createScene(container, seed, sdf);
    handle.resize(lastWidth, lastHeight);
    handle.render();
  }

  return {
    kind: 'webgl',
    show(run: RunRecord) {
      build(run.seed, run.sdfParams);
    },
    showSdf(sdf: SdfParams, seed: number) {
      build(seed, sdf);
    },
    resize(width: number, height: number) {
      lastWidth = width;
      lastHeight = height;
      handle?.resize(width, height);
      handle?.render();
    },
    dispose() {
      handle?.dispose();
      handle = null;
    },
  };
}

// ── Alternate-cell scene (the "also near" strip shares the 3D preview) ──────

export interface CellSceneHandle {
  resize(width: number, height: number): void;
  dispose(): void;
}

export interface CellSceneOptions {
  /** Presence multiplier: >1 pulls the camera back (small-in-frame), <1 tightens. */
  presence?: number;
  /** Soft morph (default) or the original's hard-cut overlapping solids. */
  blend?: BlendMode;
  /** Per-part vertex colours (default true). */
  perPartColor?: boolean;
}

/**
 * A lightweight three scene for one alternate-cell: the same mesh + material
 * grammar as the primary, but a FLAT generated background and no PMREM env —
 * three small contexts must stay cheap. Orbit-controlled (turn), never
 * pannable/zoomable, so a cell reads as "the same form, another reading".
 */
export function createCellScene(container: HTMLElement, seed: number, sdf: SdfParams, opts?: CellSceneOptions): CellSceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Flat palette wash (no gradient texture needed at cell scale).
  const palette = paletteFromSdf(sdf.material.hue, sdf.material.saturation, sdf.material.lightness);
  scene.background = new THREE.Color(palette.backgroundStops[0]);

  const camPose = cameraFromSeed(seed);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  camera.position.set(...camPose.pos);
  camera.lookAt(...camPose.target);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...camPose.target);
  controls.enableDamping = false;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.autoRotate = false;
  controls.update();

  // Fixed key/fill/rim (no environment, no shadow maps — cheap cells).
  const key = new THREE.DirectionalLight('#FFF3E0', 2.2);
  key.position.set(4, 6, 3);
  const fill = new THREE.HemisphereLight('#FFE8F0', '#FFF4E0', 0.55);
  const rim = new THREE.DirectionalLight('#CFE8FF', 1.1);
  rim.position.set(-4, 2, -5);
  scene.add(key, fill, rim);

  const solid = getSolidMesh(sdf, opts?.blend ?? sdf.blendMode ?? 'soft');
  const perPart = opts?.perPartColor ?? true;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(solid.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(solid.indices, 1));
  geometry.computeVertexNormals();
  if (perPart) geometry.setAttribute('color', new THREE.BufferAttribute(solid.colors, 3));
  const mesh = new THREE.Mesh(geometry, physicalMaterial(sdf, perPart));
  scene.add(mesh);

  // Frame the actual form (bounding sphere) so any cell centres its object.
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere && sphere.radius > 0) {
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    const presence = Math.max(1, opts?.presence ?? 1); // never tighten below fit
    // FOV-correct fit so a large form never clips the cell frame (old
    // `radius * 3.0 * presence` tightened presence<1 and cut large forms).
    const fit = sphere.radius / Math.tan((CAMERA_FOV * Math.PI) / 360) * 1.12;
    const distance = Math.max(2.4, fit * presence);
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(dir, distance);
    camera.lookAt(sphere.center);
    controls.update();
  }

  function draw(): void {
    // Render only — never controls.update() from the 'change' listener (the
    // same re-entrancy trap as createScene: update() re-dispatches 'change'
    // for a stale camera snapshot and recurses to a stack overflow).
    renderer.render(scene, camera);
  }
  controls.addEventListener('change', draw);
  draw();

  return {
    resize(width: number, height: number) {
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      draw();
    },
    dispose() {
      controls.removeEventListener('change', draw);
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      renderer.domElement.remove();
    },
  };
}