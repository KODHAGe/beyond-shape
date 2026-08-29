#!/usr/bin/env python3
"""
B1 — Export the on-device text embedder (spec §3.2 / ADR-5, LR-9).

Downloads `sentence-transformers/all-MiniLM-L6-v2` (Apache-2.0), exports the
transformer backbone to ONNX (dynamic batch/seq), dynamic-quantizes to int8,
and saves the tokenizer assets. Mean-pooling + L2-normalisation are applied in
the browser (src/core/embedding.ts) — NOT baked into the graph — so the
browser pipeline is explicit about the pooling contract.

Outputs:
  public/models/embedder-all-minilm-l6-v2-int8.onnx
  public/models/tokenizer/  (tokenizer.json, vocab.txt, special_tokens_map.json)
Prints: file sizes + sha256 for the manifest (B4).
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

OUT = Path("public/models")
TOKENIZER_DIR = OUT / "tokenizer"
MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    import torch
    from onnxruntime.quantization import QuantType, quantize_dynamic
    from transformers import BertModel, AutoTokenizer

    OUT.mkdir(parents=True, exist_ok=True)
    TOKENIZER_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[B1] loading {MODEL_ID} …")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = BertModel.from_pretrained(MODEL_ID)
    model.eval()
    model.config.use_cache = False

    class BertShell(torch.nn.Module):
        """Expose exactly (input_ids, attention_mask, token_type_ids) → last_hidden_state."""

        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, input_ids, attention_mask, token_type_ids):
            return self.m(
                input_ids=input_ids,
                attention_mask=attention_mask,
                token_type_ids=token_type_ids,
            ).last_hidden_state

    shell = BertShell(model)

    fp32 = OUT / "embedder-fp32.onnx"
    int8 = OUT / "embedder-all-minilm-l6-v2-int8.onnx"

    print("[B1] exporting to ONNX (legacy exporter — new dynamo exporter loses input dependency, verified 2026-08-28) …")
    dummy = torch.zeros(1, 8, dtype=torch.long)
    torch.onnx.export(
        shell,
        (dummy, dummy, dummy),  # input_ids, attention_mask, token_type_ids
        str(fp32),
        input_names=["input_ids", "attention_mask", "token_type_ids"],
        output_names=["last_hidden_state"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "token_type_ids": {0: "batch", 1: "seq"},
            "last_hidden_state": {0: "batch", 1: "seq"},
        },
        opset_version=17,
        dynamo=False,
    )

    print("[B1] dynamic int8 quantization …")
    quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QInt8)
    fp32.unlink(missing_ok=True)

    print("[B1] self-check: exported ONNX must differentiate inputs …")
    import numpy as np
    import onnxruntime as ort_py

    ort_sess = ort_py.InferenceSession(str(int8))
    text_a = "the sea is calm tonight"
    text_b = "cold rain on tin roofs"
    embeds = []

    def _e(text: str) -> np.ndarray:
        enc = tokenizer(text, max_length=256, truncation=True, padding=False, return_tensors="pt")
        ids = enc["input_ids"][0].tolist()
        mask = enc["attention_mask"][0].tolist()
        n = len(ids)
        out = ort_sess.run(["last_hidden_state"], {
            "input_ids": np.array([ids], np.int64),
            "attention_mask": np.array([mask], np.int64),
            "token_type_ids": np.array([[0] * n], np.int64),
        })[0][0]
        e = out.sum(axis=0) / n
        norm = float(np.linalg.norm(e))
        return e / norm if norm > 0 else e

    emb_a, emb_b = _e(text_a), _e(text_b)
    cos = float(np.dot(emb_a, emb_b))
    if cos > 0.9999:
        raise SystemExit(f"[B1] FAIL: exported embedder does not differentiate inputs (cos={cos:.4f})")
    print(f"[B1] self-check OK (cos('sea calm') vs cos('rain') = {cos:.3f})")

    print("[B1] saving tokenizer assets …")
    tokenizer.save_pretrained(str(TOKENIZER_DIR))
    # vocab.txt MUST be in INDEX order (token-for-token-id) — get_vocab() returns
    # arbitrary dict order, which silently scrambles the browser's WordPiece ids.
    vocab_lines = [tok for tok, _ in sorted(tokenizer.get_vocab().items(), key=lambda kv: kv[1])]
    (TOKENIZER_DIR / "vocab.txt").write_text("\n".join(vocab_lines), encoding="utf-8")

    print("[B1] sizes:")
    for f in [int8, TOKENIZER_DIR / "tokenizer.json", TOKENIZER_DIR / "vocab.txt"]:
        print(f"  {f.name}: {f.stat().st_size} bytes  sha256={sha256_of(f)[:16]}…")
    print(f"[B1] done → {int8} ({(int8.stat().st_size / 1e6):.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())