/**
 * Shared ONNX Runtime Web session options (wasm fallback path fix).
 *
 * The .wasm files are served from /ort-wasm/ (copied from
 * node_modules/onnxruntime-web/dist by scripts/copy-ort-wasm.mjs). Pointing
 * ort.env.wasm.wasmPaths there keeps BOTH `npm run dev` and the production
 * build working — Vite's dev server cannot resolve these from .vite/deps (it
 * returns the SPA fallback HTML, which breaks WebAssembly compilation).
 */
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = '/ort-wasm/';

export function ortSessionOptions(): ort.InferenceSession.SessionOptions {
  return {
    // WebGPU is preferred; WASM is the universal fallback (CR-6 / QR-2).
    executionProviders: ['webgpu', 'wasm'],
  };
}