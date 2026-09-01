/**
 * Standalone model-pipeline probe. Isolates the ONNX path from the renderer:
 * manifest → embedder → sensory → denoiser → decoder, each stage timed and
 * reported on screen with the exact error if it fails. If the three.js render
 * probe stays healthy but THIS hangs/flags on a browser, the "inaccessible
 * renders" are actually an inference-path problem, not a rendering problem.
 */

import * as ort from 'onnxruntime-web/wasm';
import { fetchManifest } from '../core/models';
import { Embedder } from '../core/embedding';
import { SensoryHead } from '../core/sensory';
import { OnnxDenoiser, generateDistribution } from '../core/generator';
import { Decoder } from '../core/sdfParams';
import { structureRichness } from '../aesthetics/register';

const log = document.querySelector('#log') as HTMLElement;
const runButton = document.querySelector('#run') as HTMLButtonElement;

function emit(kind: 'ok' | 'err' | 'dim' | 't' | 'ping', text: string): void {
  const div = document.createElement('div');
  div.className = `s ${kind}`;
  div.textContent = text;
  log.appendChild(div);
}

const mark = (): number => performance.now();
const ms = (a: number): string => `${(performance.now() - a).toFixed(0)} ms`;

emit('dim', `UA: ${navigator.userAgent}`);
emit('dim', `onnxruntime-web v${(ort.env as unknown as { version?: string }).version ?? '?'}`);
emit('dim', `WebGPU (navigator.gpu): ${'gpu' in navigator ? 'present' : 'absent'}`);
emit('dim', `crossOriginIsolated: ${self.crossOriginIsolated ?? 'n/a'} · SharedArrayBuffer: ${typeof SharedArrayBuffer} · hardwareConcurrency: ${navigator.hardwareConcurrency}`);

window.addEventListener('error', (ev) => emit('err', `window.onerror: ${ev.message} @ ${ev.filename}:${ev.lineno}`));
window.addEventListener('unhandledrejection', (ev) => emit('err', `unhandledrejection: ${String((ev.reason as Error | undefined)?.stack ?? ev.reason)}`));

runButton.addEventListener('click', () => void (async () => {
  runButton.disabled = true;
  const t0 = mark();

  // Keep the page visibly alive while a stage may be silently hanging.
  // Keep the page visibly alive while a stage may be silently hanging.
  const ping = window.setInterval(() => {
    pingCount += 1;
    emit('ping', '.');
  }, 5000);
  let pingCount = 0;
  const clearPings = (): void => window.clearInterval(ping);
  const notePing = (): string =>
    pingCount > 0 ? ` (≈${pingCount}× 5 s gaps — a stage HUNG ahead)` : '';

  try {
    // 1 — manifest
    let a = mark();
    const manifest = await fetchManifest();
    emit('ok', `1. manifest ✓ ${ms(a)} (v${manifest.version})`);

    // 2 — embedder: load session + embed one sentence
    a = mark();
    const embedder = new Embedder(manifest);
    const e = await embedder.embed('the sea is calm tonight');
    emit('ok', `2. embedder ✓ ${ms(a)} → 384-d embedding${notePing()}`);

    // 3 — sensory head
    a = mark();
    const sensory = new SensoryHead(manifest);
    const q = await sensory.forward(e);
    emit('ok', `3. sensory ✓ ${ms(a)} → 16 channels${notePing()}`);

    // 4 — denoiser: DDPM sampling → 4 latents
    a = mark();
    const denoiser = new OnnxDenoiser(manifest);
    const richness = structureRichness(await embedder.tokenCount('the sea is calm tonight'));
    const zs = await generateDistribution({ text: 'the sea is calm tonight', e, q, drift: 0.4, seed: 42, denoiser, richness });
    emit('ok', `4. denoiser ✓ ${ms(a)} → ${zs.length} latents × ${zs[0]?.length ?? 0}-d${notePing()}`);

    // 5 — decoder: latent → SdfParams
    const z = zs[0] as Float32Array;
    a = mark();
    const decoder = new Decoder(manifest);
    const sdf = await decoder.decode(z);
    const hue = (((sdf.material.hue % 1) + 1) % 1).toFixed(2);
    emit('ok', `5. decoder ✓ ${ms(a)} → SdfParams (hue ${hue}, ${sdf.parts.length} parts)${notePing()}`);

    // 6 — quick render sanity: can the decoded form become a three mesh?
    a = mark();
    const { sampleField } = await import('../core/sdfField');
    const { marchCubes, laplacianSmooth } = await import('../render/marchingCubes');
    const field = sampleField(sdf);
    const marched = marchCubes(field, 48, 48, 48, -1.5, 1.5);
    laplacianSmooth(marched.positions, marched.indices, 1);
    emit('ok', `6. mesh readiness ✓ ${ms(a)} (${(marched.indices.length / 3) | 0} triangles)`);

    emit('ok', `\nPIPELINE COMPLETE in ${ms(t0)} — the model path works in this browser.`);
    emit('ok', `If this page succeeds but the app shows nothing, the fault is in page wiring (see three-probe for the render half).`);
  } catch (err) {
    emit('err', `\nPIPELINE FAILED after ${ms(t0)}: ${String(err)}`);
    emit('err', `stack: ${(err as Error).stack ?? '—'}`);
  } finally {
    clearPings();
    runButton.disabled = false;
  }
})());