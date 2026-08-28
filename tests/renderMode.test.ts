import { describe, expect, it } from 'vitest';
import { resolveRenderMode } from '../src/render/renderer';

describe('render-mode resolution (LR-6)', () => {
  it('auto-detect: webgl2 present → webgl, absent → canvas2d', () => {
    expect(resolveRenderMode(null, true)).toBe('webgl');
    expect(resolveRenderMode(null, false)).toBe('canvas2d');
    expect(resolveRenderMode(undefined, false)).toBe('canvas2d');
  });

  it('explicit override wins over detection — canvas is selectable without a GPU', () => {
    expect(resolveRenderMode('canvas2d', true)).toBe('canvas2d');
    expect(resolveRenderMode('webgl', false)).toBe('webgl');
  });

  it('invalid explicit values fall back to auto-detection', () => {
    expect(resolveRenderMode('banana', true)).toBe('webgl');
    expect(resolveRenderMode('banana', false)).toBe('canvas2d');
  });
});