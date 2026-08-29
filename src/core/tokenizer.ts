/**
 * Real BERT WordPiece tokenizer (all-MiniLM-L6-v2, ADR-5), reading `vocab.txt`
 * from the manifest's tokenizer artifact — SAME-ORIGIN static fetch, exempted
 * in scripts/ci-checks.mjs alongside `models.ts` (spec §3.2 R-f).
 *
 * Faithful to the HuggingFace BertTokenizer for the uncased MiniLM family:
 * lower → NFD-strip accents → whitespace + punctuation split → greedy
 * WordPiece → [CLS]…[SEP] → truncate at maxTokens (overflow on the right).
 */

export interface TokenizedInput {
  ids: number[];
  mask: number[];
  truncated: boolean;
}

export class BertTokenizer {
  private constructor(private readonly vocab: Map<string, number>) {}

  static async fromFile(url: string): Promise<BertTokenizer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`tokenizer: cannot load ${url} (${res.status})`);
    return BertTokenizer.fromVocabText(await res.text());
  }

  /** Build from raw vocab.txt content (used by tests and fromFile). */
  static fromVocabText(text: string): BertTokenizer {
    const vocab = new Map<string, number>();
    text.split('\n').forEach((line, i) => {
      const t = line.trim();
      if (t) vocab.set(t, i);
    });
    return new BertTokenizer(vocab);
  }

  /** NFD-normalise + strip combining marks (≈ HF basic tokenizer accents). */
  private static normalize(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /** lowercase → split on whitespace and punctuation into word-like tokens. */
  private basicTokenize(text: string): string[] {
    const lower = text.toLowerCase();
    const clean = BertTokenizer.normalize(lower);
    const out: string[] = [];
    for (const chunk of clean.split(/\s+/)) {
      if (!chunk) continue;
      // Split into runs of [a-z0-9] and isolated punctuation tokens.
      const parts = chunk.match(/[a-z0-9]+|[^a-z0-9]/g) ?? [];
      out.push(...parts);
    }
    return out;
  }

  tokenize(text: string, maxTokens: number): TokenizedInput {
    const unk = this.vocab.get('[UNK]') ?? 100;
    const cls = this.vocab.get('[CLS]') ?? 101;
    const sep = this.vocab.get('[SEP]') ?? 102;

    const ids: number[] = [cls];
    for (const word of this.basicTokenize(text)) {
      for (const piece of this.wordPiece(word, unk)) ids.push(piece);
    }
    ids.push(sep);

    // Truncate on the right, keeping [SEP] last (HF truncation semantics).
    let truncated = false;
    if (ids.length > maxTokens) {
      truncated = true;
      ids.length = Math.max(1, maxTokens - 1);
      ids.push(sep);
    }
    return { ids, mask: ids.map(() => 1), truncated };
  }

  private wordPiece(word: string, unk: number): number[] {
    if (this.vocab.has(word)) return [this.vocab.get(word)!];
    const pieces: number[] = [];
    let start = 0;
    let guard = 0;
    while (start < word.length && guard < 64) {
      guard += 1;
      const current = start > 0 ? `##${word.slice(start)}` : word;
      let found = false;
      for (let end = current.length; end > 0; end -= 1) {
        const sub = current.slice(0, end);
        if (this.vocab.has(sub)) {
          pieces.push(this.vocab.get(sub)!);
          start += sub.length - (start > 0 ? 2 : 0); // advance past the bare part
          found = true;
          break;
        }
      }
      if (!found) {
        if (pieces.length === 0) pieces.push(unk);
        break;
      }
    }
    return pieces.length > 0 ? pieces : [unk];
  }
}