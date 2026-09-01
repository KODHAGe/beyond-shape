// Copy the onnxruntime-web .wasm assets into public/ort-wasm/ so both the
// dev server and the production build serve them with a correct MIME type.
// (Vite's dev server cannot serve these from .vite/deps — they 404 to the SPA
// fallback HTML, which breaks `WebAssembly.instantiate`.)
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const dist = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const dest = join(root, 'public', 'ort-wasm');

mkdirSync(dest, { recursive: true });
let copied = 0;
const MAX_BYTES = 25 * 1024 * 1024; // Cloudflare Pages single-file cap
for (const file of readdirSync(dist)) {
  // Both the .wasm binaries and the .jsep.mjs glue are load-time assets.
  if (file.startsWith('ort-wasm')) {
    const source = join(dist, file);
    // Drop builds over the Pages cap (e.g. the ~26.5 MiB WebGPU/JSEP wasm) so
    // they never enter the deploy; onnxruntime-web runs fine on the WASM EP.
    const size = statSync(source).size;
    if (size > MAX_BYTES) {
      console.warn(`[ort] skipping ${file} (${(size / 1024 / 1024).toFixed(1)} MiB > ${MAX_BYTES / 1024 / 1024} MiB Pages cap)`);
      continue;
    }
    copyFileSync(source, join(dest, file));
    copied += 1;
  }
}
console.log(`[ort] copied ${copied} ort-wasm asset(s) → public/ort-wasm/`);