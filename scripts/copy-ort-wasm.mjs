// Copy the onnxruntime-web .wasm assets into public/ort-wasm/ so both the
// dev server and the production build serve them with a correct MIME type.
// (Vite's dev server cannot serve these from .vite/deps — they 404 to the SPA
// fallback HTML, which breaks `WebAssembly.instantiate`.)
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const dist = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const dest = join(root, 'public', 'ort-wasm');

mkdirSync(dest, { recursive: true });
let copied = 0;
for (const file of readdirSync(dist)) {
  // Both the .wasm binaries and the .jsep.mjs glue are load-time assets.
  if (file.startsWith('ort-wasm')) {
    copyFileSync(join(dist, file), join(dest, file));
    copied += 1;
  }
}
console.log(`[ort] copied ${copied} ort-wasm asset(s) → public/ort-wasm/`);