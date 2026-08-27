import { describe, expect, it } from 'vitest';
import type { RunRecord, SdfParams } from '../src/types';
import { RunStore, STORAGE_KEY, type StorageLike } from '../src/state/runStore';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function sdf(): SdfParams {
  return {
    weights: [1, 0, 0, 0, 0, 0, 0, 0],
    blendRadius: 0.15,
    parts: Array.from({ length: 8 }, () => ({
      scale: [1, 1, 1],
      offset: [0, 0, 0],
      twist: 0,
      displacement: 0,
    })) as SdfParams['parts'],
    material: { hue: 0.4, saturation: 0.4, lightness: 0.75, roughness: 0.5, metalness: 0, clearcoat: 0, emissive: 0 },
    motion: { breathe: 0, sway: 0 },
    pose: { yaw: 0, pitch: 0, roll: 0 },
  };
}

function run(id: string): RunRecord {
  return {
    id,
    inputText: 'the sea is calm tonight',
    e: new Float32Array(384),
    q: new Float32Array(16),
    z: new Float32Array(64),
    zAlternates: [new Float32Array(64), new Float32Array(64), new Float32Array(64)],
    sdfParams: sdf(),
    renderState: {
      camera: { pos: [1, 2, 3], target: [0, 0, 0] },
      palette: { background: 'linear-gradient(180deg, #fff 0%, #fee 100%)', key: '#fff3e0', fill: '#ffe8f0', rim: '#cfe8ff' },
    },
    drift: 0.4,
    seed: 42,
    fingerprint: 'a'.repeat(64),
    createdAt: 1234,
    webgl: true,
  };
}

describe('runStore (spec §5)', () => {
  it('mirrors the last run to storage and loads it back intact', () => {
    const storage = fakeStorage();
    const store = new RunStore(storage);
    store.add(run('r1'));
    expect(store.all.length).toBe(1);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();

    const reloaded = new RunStore(storage);
    const mirrored = reloaded.loadMirrored();
    expect(mirrored).not.toBeNull();
    expect(mirrored!.id).toBe('r1');
    expect(mirrored!.inputText).toBe('the sea is calm tonight');
    expect(mirrored!.renderState.camera.pos).toEqual([1, 2, 3]);
  });

  it('keeps the newest run as the mirror (LIFO)', () => {
    const storage = fakeStorage();
    const store = new RunStore(storage);
    store.add(run('first'));
    store.add(run('second'));
    expect(store.lastRun!.id).toBe('second');
    const reloaded = new RunStore(storage);
    expect(reloaded.loadMirrored()!.id).toBe('second');
  });

  it('clear removes the mirror and the in-memory list', () => {
    const storage = fakeStorage();
    const store = new RunStore(storage);
    store.add(run('r1'));
    store.clear();
    expect(store.all.length).toBe(0);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(new RunStore(storage).loadMirrored()).toBeNull();
  });

  it('tolerates a storage area without sessionStorage (pure in-memory)', () => {
    const store = new RunStore(null);
    store.add(run('r1'));
    expect(store.all.length).toBe(1);
    expect(store.loadMirrored()).toBeNull(); // no mirror without storage
    expect(() => store.clear()).not.toThrow();
  });

  it('recovers from a corrupt mirror', () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    const store = new RunStore(storage);
    expect(store.loadMirrored()).toBeNull();
  });
});