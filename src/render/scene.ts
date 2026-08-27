/**
 * Three.js scene factory (spec §3.4 / QR-4): ACES + sRGB + PCFSoftShadowMap,
 * MeshPhysicalMaterial from SdfParams, seed-derived camera with a fixed orbit
 * (idle animation opt-in, default OFF — FR-10), mesh from the in-repo marching
 * cubes + one Laplacian smoothing pass + computeVertexNormals.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { RenderStateWire, RunRecord, SdfParams } from '../types';
import { SeededRng } from '../core/seededRng';
import { sampleField } from '../core/sdfField';
import { marchCubes, laplacianSmooth } from './marchingCubes';
import { buildLighting, gradientBackground, paletteFromSdf } from './lighting';

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
  const azimuth = rng.nextFloat() * Math.PI * 2;
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

export function physicalMaterial(sdf: SdfParams): THREE.MeshPhysicalMaterial {
  const m = sdf.material;
  const hue = (((m.hue % 1) + 1) % 1);
  const color = new THREE.Color().setHSL(hue, Math.min(1, Math.max(0, m.saturation)), Math.min(1, Math.max(0, m.lightness)));
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: m.roughness,
    metalness: m.metalness,
    clearcoat: m.clearcoat,
    clearcoatRoughness: 0.35,
    emissive: new THREE.Color().setHSL(hue, m.saturation, Math.min(0.5, m.emissive * 0.5)),
    emissiveIntensity: m.emissive * 0.4,
  });
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
export function createScene(container: HTMLElement, seed: number, sdf: SdfParams): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camPose = cameraFromSeed(seed);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  camera.position.set(...camPose.pos);
  camera.lookAt(...camPose.target);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...camPose.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = false; // idle animation opt-in, default OFF (FR-10)
  controls.update();

  const lightingRng = new SeededRng(seedBytes(seed ^ 0x5f3759df));
  const lighting = buildLighting(scene, renderer, lightingRng);
  const palette = paletteFromSdf(sdf.material.hue, sdf.material.saturation, sdf.material.lightness);
  gradientBackground(scene, palette.backgroundStops);

  let mesh: THREE.Mesh | null = null;

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
      const field = sampleField(next);
      const marched = marchCubes(field, 48, 48, 48, -1.5, 1.5);
      const smooth = laplacianSmooth(marched.positions, marched.indices, 1);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(smooth, 3));
      geometry.setIndex(new THREE.BufferAttribute(marched.indices, 1));
      geometry.computeVertexNormals(); // spec §3.4
      mesh = new THREE.Mesh(geometry, physicalMaterial(next));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    },
    resize(width: number, height: number) {
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },
    render() {
      controls.update();
      renderer.render(scene, camera);
    },
    dispose() {
      controls.dispose();
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