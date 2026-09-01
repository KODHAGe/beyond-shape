/**
 * Shared ONNX Runtime Web session options (wasm fallback path fix).
 *
 * The .wasm files are served from /ort-wasm/ (copied from
 * node_modules/onnxruntime-web/dist by scripts/copy-ort-wasm.mjs). Pointing
 * ort.env.wasm.wasmPaths there keeps BOTH `npm run dev` and the production
 * build working — Vite's dev server cannot resolve these from .vite/deps (it
 * returns the SPA fallback HTML, which breaks WebAssembly compilation).
 */
import * as ort from 'onnxruntime-web/wasm';

ort.env.wasm.wasmPaths = '/ort-wasm/';

export function ortSessionOptions(): ort.InferenceSession.SessionOptions {
  return {
    // WASM provider only (classic onnxruntime-web/wasm build). The default
    // onnxruntime-web entry is the WebGPU/JSEP build whose wasm is ~26.5 MiB —
    // over Cloudflare Pages' 25 MiB single-file cap, so it can't be shipped.
    // The classic wasm build's wasm is ~13.3 MiB; WASM is the tested fallback
    // (QR-2). WebGPU inference is a deferred enhancement.
    executionProviders: ['wasm'],
  };
}