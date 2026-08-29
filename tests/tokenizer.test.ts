import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BertTokenizer } from '../src/core/tokenizer';

const VOCAB = new URL('../public/models/tokenizer/vocab.txt', import.meta.url);

function load(): BertTokenizer {
  return BertTokenizer.fromVocabText(readFileSync(fileURLToPath(VOCAB), 'utf8'));
}

describe('bert wordpiece tokenizer (B1/B5, ADR-5)', () => {
  it('wraps with [CLS]…[SEP]', () => {
    const { ids } = load().tokenize('the sea is calm tonight', 256);
    expect(ids[0]).toBe(101); // [CLS]
    expect(ids[ids.length - 1]).toBe(102); // [SEP]
    expect(ids.length).toBeGreaterThan(2);
  });

  it('is deterministic for identical input', () => {
    const t = load();
    const a = t.tokenize('a small yellow bird', 256);
    const b = t.tokenize('a small yellow bird', 256);
    expect(b.ids).toEqual(a.ids);
  });

  it('produces different id sequences for different texts', () => {
    const t = load();
    const a = t.tokenize('the sea is calm tonight', 256);
    const b = t.tokenize('cold rain on tin roofs', 256);
    expect(a.ids).not.toEqual(b.ids);
  });

  it('falls back to [UNK] for unknown tokens without diverging', () => {
    const t = load();
    const r = t.tokenize('☕', 256); // not in the ASCII WordPiece vocab
    expect(r.ids).toContain(100); // [UNK]
  });

  it('truncates to maxTokens', () => {
    const t = load();
    const { ids, truncated } = t.tokenize('sugar and '.repeat(120), 64);
    expect(ids.length).toBe(64);
    expect(truncated).toBe(true);
  });

  it('lowercases and strips accents (uncased model)', () => {
    const t = load();
    const a = t.tokenize('Café', 256);
    const b = t.tokenize('cafe', 256);
    expect(b.ids).toEqual(a.ids);
  });
});