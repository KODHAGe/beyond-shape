#!/usr/bin/env python3
"""
B2 — Export the v0 sensory-feature head (spec §3.2, provisional).

A deterministic linear head 384 → 16 with a warm per-register bias — the
explicit stand-in for the trained probes of Slice 2. It "performs its
stubness": channel NAMES live in models.json as data, not in the graph; the
weights are fixed-seed so regeneration is reproducible (LR-9). Clamping to
[0,1] happens in the browser wrapper (src/core/sensory.ts).

Output: public/models/sensory-v0-int8.onnx
Prints size + sha256 for the manifest.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import torch
import torch.nn as nn

OUT = Path("public/models")
IN_DIM = 384
OUT_DIM = 16
SEED = 42

NORM = 0.02  # weight scale; bias warms each register toward ~0.5 (C7 light register)


def main() -> int:
    from onnxruntime.quantization import QuantType, quantize_dynamic

    OUT.mkdir(parents=True, exist_ok=True)

    torch.manual_seed(SEED)
    head = nn.Linear(IN_DIM, OUT_DIM, bias=True)
    with torch.no_grad():
        head.weight.normal_(0.0, NORM)
        head.bias.fill_(0.5)  # warm register: channels start mid-range, not at zero

    head.eval()
    fp32 = OUT / "sensory-fp32.onnx"
    int8 = OUT / "sensory-v0-int8.onnx"

    dummy = torch.zeros(1, IN_DIM)
    torch.onnx.export(
        head,
        (dummy,),
        str(fp32),
        input_names=["e"],
        output_names=["raw"],
        opset_version=13,
        dynamo=False,
    )
    quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QInt8)
    fp32.unlink(missing_ok=True)

    size = int8.stat().st_size
    h = hashlib.sha256(int8.read_bytes()).hexdigest()
    print(f"  sensory-v0-int8.onnx: {size} bytes  sha256={h[:16]}…")
    print(f"[B2] done → {int8}")
    return 0


if __name__ == "__main__":
    sys.exit(main())