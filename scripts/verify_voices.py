#!/usr/bin/env python3
"""Slice 2 acceptance: does the LIVE path surface multiple voices for rich text?

Mirrors src/core/generator.ts exactly — canonical zero init, 25-step DDIM,
cosine ᾱ, η=drift — but runs the shipped ONNX (embedder → sensory → denoiser
v2 → decoder) offline. Reports active voices (>0.08 weight) per test text at
the drift(s) given. This is the fast iteration loop for the structure training;
the final gate is the same path in the browser (e2e/lab).

Usage: .venv/bin/python scripts/verify_voices.py [--out-dir public]
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

CONFIG = {
    "T": 1000,
    "DDIM_STEPS": 25,
    "latent_dim": 64,
    "embed_dim": 384,
    "max_tokens": 256,
    "cond_dim": 401,
}

TESTS = [
    ("rain", 0.55),
    ("the sea is calm tonight", 0.55),
    ("the fog is dense this morning and the ferry has been delayed for hours "
     "while the gulls keep circling the grey water", 0.55),
    ("I remember the summer kitchen, the wasps in the jam, my grandmother "
     "singing off-key to the radio, the sugar on the table", 0.55),
    ("the ferry takes the whole grey city across the sound in the morning, "
     "past islands that do not care about anyone", 0.55),
]


def structure_richness(tokens: int) -> float:
    return max(0.0, min(1.0, (tokens - 3) / 22.0))


def cosine_alpha_bar(t: float) -> float:
    x = ((t / CONFIG["T"] + 0.008) / 1.008) * (math.pi / 2)
    c = math.cos(x)
    norm = math.cos((0.008 / 1.008) * (math.pi / 2))
    return (c * c) / (norm * norm)


def ddim_timesteps() -> list[int]:
    return [
        round(((CONFIG["DDIM_STEPS"] - 1 - i) * (CONFIG["T"] - 1)) / (CONFIG["DDIM_STEPS"] - 1))
        for i in range(CONFIG["DDIM_STEPS"])
    ]


def ddim_sample(c: list[float], eta: float, rng: np.random.Generator, denoiser) -> np.ndarray:
    x = np.zeros(CONFIG["latent_dim"], dtype=np.float32)
    ts = ddim_timesteps()
    MAX_LATENT_NORM = 2.0  # manifold latch — mirror of src/core/generator.ts (Slice 2)
    for i, t in enumerate(ts):
        t_prev = ts[i + 1] if i + 1 < len(ts) else max(0, t - 1)
        eps = np.asarray(
            denoiser.run(
                ["eps"],
                {
                    "x": x[None, :],
                    "t": np.array([t / CONFIG["T"]], dtype=np.float32),
                    "c": np.array([c], dtype=np.float32),
                },
            )[0][0],
            dtype=np.float32,
        ).copy()
        ab = cosine_alpha_bar(t)
        ab_prev = cosine_alpha_bar(t_prev)
        pred_x0 = (x - math.sqrt(max(0, 1 - ab)) * eps) / math.sqrt(max(ab, 1e-8))
        norm = float(np.sqrt((pred_x0**2).sum()))
        if norm > MAX_LATENT_NORM:
            pred_x0 = pred_x0 * (MAX_LATENT_NORM / norm)
        if t_prev <= 0:
            x = pred_x0
            break
        sigma = eta * math.sqrt((1 - ab_prev) / max(1 - ab, 1e-8)) * math.sqrt(
            max(0, 1 - ab / max(ab_prev, 1e-8))
        )
        direction = math.sqrt(max(0, 1 - ab_prev - sigma * sigma))
        noise = rng.standard_normal(CONFIG["latent_dim"]).astype(np.float32) if sigma > 1e-12 else np.zeros(CONFIG["latent_dim"], dtype=np.float32)
        x = math.sqrt(max(ab_prev, 1e-8)) * pred_x0 + direction * eps + sigma * noise
    return x


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=Path("public"))
    args = parser.parse_args()

    models = args.out_dir / "models"
    tok = AutoTokenizer.from_pretrained(str(models / "tokenizer"))
    embedder = ort.InferenceSession(str(models / "embedder-all-minilm-l6-v2-int8.onnx"))
    sensory = ort.InferenceSession(str(models / "sensory-v0-int8.onnx"))
    denoiser = ort.InferenceSession(str(models / "denoiser-v2-int8.onnx"))
    decoder = ort.InferenceSession(str(models / "decoder-v2-int8.onnx"))

    rng = np.random.default_rng(7)
    for text, drift in TESTS:
        enc = tok(text, max_length=CONFIG["max_tokens"], truncation=True, padding=False, return_tensors="pt")
        ids = enc["input_ids"][0].tolist()
        seq = len(ids)
        out = embedder.run(
            ["last_hidden_state"],
            {
                "input_ids": np.array([ids], dtype=np.int64),
                "attention_mask": np.array([[1] * seq], dtype=np.int64),
                "token_type_ids": np.array([[0] * seq], dtype=np.int64),
            },
        )[0][0]
        e = (out.sum(axis=0) / seq).astype(np.float32)
        n = math.sqrt(float((e * e).sum()))
        if n > 0:
            e = e / n
        q = np.clip(sensory.run(["raw"], {"e": e[None, :]})[0][0], 0, 1)
        richness = structure_richness(seq)
        c = np.concatenate([e, q, [richness]]).tolist()

        z = ddim_sample(c, drift, rng, denoiser)
        raw = decoder.run(
            ["weights", "blend_radius", "parts", "material", "motion", "pose", "hardness"],
            {"z": z[None, :]},
        )
        w_logits = np.asarray(raw[0][0], dtype=np.float32)
        m = float(np.max(w_logits))
        w = np.exp(w_logits - m)
        w = w / w.sum()
        active = int((w > 0.08).sum())
        top = ", ".join(f"{v:.2f}" for v in sorted(w, reverse=True)[:4])
        blend = "cut" if float(raw[6][0][0]) >= 0.5 else "soft"
        print(
            f"drift={drift:.2f} rich={richness:.2f} tok={seq:>3} blend={blend:<4} "
            f"active={active}  {top}   | {text[:40]}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())