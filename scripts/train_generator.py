#!/usr/bin/env python3
"""
Slice 1 training script (spec §3.3 / §3.5 / §3.6, CR-7 partial).

STRUCTURAL SCAFFOLD: the script runs from a clean checkout WITHOUT torch
installed (it only needs the stdlib to regenerate `public/models/models.json`
and `public/seed-forms.json`). Training / ONNX-export steps are guarded by an
optional torch import and flagged with TODO markers — they are the contract
that produces the real artifacts:

  - seed-forms.json   → per-seed e[384] (via the embedder) + zCenter[64] +
                        sdfParams (via the decoder), so the cold-start
                        consensus backdrop is machine-generated, not invented.
  - models.json       → manifest with real sha256/sizeBytes, trainingSource
                        provenance (DR-4), sensory-v0 channels, licenses incl.
                        Apache-2.0 attribution for all-MiniLM-L6-v2 (CR-5).
  - ONNX artifacts    → embedder (int8), sensory-v0 (linear 384→16), denoiser
                        (≤ 3M params, c_emb 2×256 Swish+LN → 128), decoder
                        (64 → SdfParams). Denoiser inputs/outputs mirror the
                        in-browser contract (src/core/generator.ts):
                        x (64), t (1, normalised 0..1), c (400) → eps (64).
  - anchors           → one-hot primitive anchor latents for the FR-7 blend
                        test, exported in the manifest's trainingSource block.

Sampling side-notes owned HERE (spec §3.3):
  - DDPM training: cosine β, T=1000, MSE on ε, Adam lr 1e-3, batch 64,
    ~3000 steps, CPU-capable (≤ ~15 min).
  - Dataset = per-seed Gaussian clouds around each zCenter + linear
    interpolations between centres (engineering FR-7 'between' reachability).
  - Canonical d=0 initial latent = zeros(64) — the fixed, seed-independent
    community-centre point the browser sampler starts from (AMEND-1).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# ── Optional imports ───────────────────────────────────────────────────────────
try:
    import numpy as np  # noqa: F401  (used only when training)
    HAS_NUMPY = True
except ImportError:
    np = None  # type: ignore[assignment]
    HAS_NUMPY = False

try:
    import torch  # noqa: F401
    import torch.nn as nn  # noqa: F401
    HAS_TORCH = True
except ImportError:
    torch = None  # type: ignore[assignment]
    HAS_TORCH = False

# ── Spec-bound constants (spec §3.3 / §3.5) ──────────────────────────────────

SEED_TEXTS = [
    "the sea is calm tonight",
    "a small yellow bird",
    "cold rain on tin roofs",
    "a house with colored windows",
    "we are all made of light",
    "heavy gray afternoon",
    "sugar and spice and everything nice",
    "the silence after music",
]

SENSORY_CHANNELS = [
    "light", "warmth", "motion", "weight", "texture",
    "soft", "hard", "metal", "fluid", "time-of-day",
    "scale", "moisture", "rhythm", "colour-temperature",
    "colour-saturation", "air",
]

PRIMITIVE_NAMES = [
    "sphere", "box", "roundedBox", "cylinder", "cone",
    "torus", "capsule", "blob",
]

CONFIG = {
    "T": 1000,                  # cosine diffusion timesteps
    "num_ddim_steps": 25,       # sampling steps
    "latent_dim": 64,
    "cond_dim": 400,            # c = concat(e[384], q[16])
    "cond_emb": 128,            # c_emb after 2×256 Swish+LayerNorm
    "lr": 1e-3,
    "batch": 64,
    "steps": 3000,
    "denoiser_param_budget": 3_000_000,   # ≤ 3M params (spec §3.3)
    "embed_dim": 384,
    "max_tokens": 256,
}

CANONICAL_D0_LATENT = [0.0] * CONFIG["latent_dim"]  # AMEND-1: fixed centre point

# FR-7: one-hot primitive anchor latents — the canonical zCenter anchors
# (sphere=0, box=1, …) the blend test decodes and looks for max-weight ∈ [0.5,0.75].
ANCHOR_LATENTS: List[List[float]] = [
    [1.0 if i == p else 0.0 for i in range(CONFIG["latent_dim"])]
    for p in range(len(PRIMITIVE_NAMES))
]

LICENSES = [
    {
        "name": "all-MiniLM-L6-v2",
        "license": "Apache-2.0",
        "note": "attribute per public/models/LICENSES/README.md",
    },
    {
        "name": "onnxruntime-web",
        "license": "MIT",
        "note": "runtime dependency",
    },
    {
        "name": "three.js",
        "license": "MIT",
        "note": "render dependency",
    },
]


# ── Deterministic helpers ──────────────────────────────────────────────────────

def _hash_seed(text: str) -> int:
    """Stable integer seed per seed-text (corpus is version-stable)."""
    h = 0x9E3779B9
    for ch in text:
        h = (h ^ ord(ch)) & 0xFFFFFFFF
        h = ((h << 13) ^ h) >> 0 & 0xFFFFFFFF
        h = (h * 0x5BD1E995) & 0xFFFFFFFF
    return h


def content_stamp() -> str:
    """Content-derived, wall-clock-free build stamp (LR-9b).

    Derived from the seed corpus + config + channel names so that repeated
    stdlib regeneration is byte-identical — `generatedAt` is a build identity,
    not a timestamp of the run.
    """
    digest = hashlib.sha256()
    digest.update(json.dumps({
        "seeds": SEED_TEXTS,
        "config": CONFIG,
        "channels": SENSORY_CHANNELS,
    }, sort_keys=True).encode("utf-8"))
    return "content-" + digest.hexdigest()[:16]


def placeholder_sdf_params(text: str, rng: random.Random) -> Dict[str, Any]:
    """
    Deterministic placeholder SdfParams for the scaffold corpus (valid ranges
    per spec §4). TODO(training): regenerate with the real decoder once it is
    trained — this only keeps seed-forms.json schema-valid before training.
    """
    hue = rng.random()
    weights = [0.35, 0.15, 0.1, 0.08, 0.07, 0.12, 0.08, 0.05]
    wsum = sum(weights)
    weights = [w / wsum for w in weights]
    parts = []
    for _ in PRIMITIVE_NAMES:
        parts.append({
            "scale": [1.0, 1.0, 1.0],
            "offset": [0.0, 0.0, 0.0],
            "twist": rng.uniform(-0.4, 0.4),
            "displacement": rng.uniform(0.0, 0.3),
        })
    return {
        "weights": weights,
        "blendRadius": round(rng.uniform(0.08, 0.4), 3),
        "parts": parts,
        "material": {
            "hue": hue,
            "saturation": round(rng.uniform(0.3, 0.6), 3),
            "lightness": round(rng.uniform(0.6, 0.85), 3),
            "roughness": 0.45,
            "metalness": 0.05,
            "clearcoat": 0.5,
            "emissive": 0.05,
        },
        "motion": {"breathe": rng.random(), "sway": rng.random()},
        "pose": {"yaw": rng.uniform(-1.4, 1.4), "pitch": 0.0, "roll": 0.0},
    }


def build_seed_corpus() -> List[Dict[str, Any]]:
    """The 8 arbitrary, unlabelled seed texts (spec §3.5) → SeedForm dicts."""
    corpus: List[Dict[str, Any]] = []
    for idx, text in enumerate(SEED_TEXTS):
        rng = random.Random(_hash_seed(text))
        # Placeholder latent: deterministic draw near the anchor space.
        z_center = [round(rng.gauss(0.0, 0.35), 4) for _ in range(CONFIG["latent_dim"])]
        corpus.append({
            "id": f"seed-{idx:02d}",
            "text": text,
            "e": [0.0] * CONFIG["embed_dim"],           # TODO(embedder): real e
            "zCenter": z_center,                         # TODO(training): trained centre
            "sdfParams": placeholder_sdf_params(text, rng),
        })
    return corpus


def build_dataset(corpus: List[Dict[str, Any]], noise_scale: float = 0.2, n_per_seed: int = 128) -> Optional[Any]:
    """
    Dataset for DDPM training: per-seed Gaussian clouds around each zCenter +
    linear interpolations between centres (engineers FR-7 'between'
    reachability). Returns torch tensors (latent, conditioning) or None when
    torch is not installed.
    TODO(training): conditioning pairs zCenter ↔ (e, q) come from the real
    embedder/sensory heads; this stub returns (z_center, zero_condition).
    """
    if not HAS_TORCH:
        return None
    z_centers = [torch.tensor(c["zCenter"], dtype=torch.float32) for c in corpus]
    samples: List[torch.Tensor] = []
    for zc in z_centers:
        for _ in range(n_per_seed):
            noise = torch.randn(CONFIG["latent_dim"]) * noise_scale
            samples.append(zc + noise)
    for i in range(len(z_centers)):
        for j in range(i + 1, len(z_centers)):
            for k in range(8):
                t = (k + 1) / 9.0
                midpoint = z_centers[i] * (1 - t) + z_centers[j] * t
                samples.append(midpoint + torch.randn(CONFIG["latent_dim"]) * noise_scale * 0.5)
    return torch.stack(samples)


def cosine_betas(T: int, s: float = 0.008) -> List[float]:
    """Cosine noise schedule (Nichol & Dhariwal) — beta over T training steps."""
    betas: List[float] = []
    for t in range(T):
        alpha_cum = cosine_alpha_bar(t, T, s) / max(cosine_alpha_bar(t + 1, T, s), 1e-8)
        betas.append(min(0.999, max(1e-5, 1.0 - alpha_cum)))
    return betas


def cosine_alpha_bar(t: float, T: int, s: float) -> float:
    x = ((t / T + s) / (1 + s)) * (math.pi / 2)
    return math.cos(x) ** 2


# ── ONNX export stubs (guarded, TODO markers) ─────────────────────────────────

def export_onnx_stubs(out_dir: Path) -> None:
    """
    TODO(model): the real exports once training exists.
      - embedder: all-MiniLM-L6-v2 → int8 (input_ids [1,L], attention_mask)
      - sensory-v0: linear 384 → 16, clamped [0,1] (AMEND-4: derived on the 8
        seed forms; regenerated here alongside the generator)
      - denoiser-v1: c = concat(e,q) → 2×256 Swish+LN → c_emb(128); εθ(x,t,c)
      - decoder-v1: z(64) → {weights[8], blend_radius, parts[64], material[7],
        motion[2], pose[3]} — match src/core/sdfParams.ts ONNX contract.
    This stub writes nothing but prints the contract so the export step cannot
    silently drift from the browser wrappers.
    """
    print("[export] contract: denoiser inputs x(64), t(1 norm 0..1), c(400) → eps(64)")
    print("[export] contract: decoder outputs weights[8], blend_radius, parts[64], "
          "material[7], motion[2], pose[3]")
    print("[export] contract: sensory-v0 linear 384→16 clamp [0,1]; channels are data")


def sha256_of_file(path: Path) -> str:
    import hashlib
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def artifact_entry(path: Optional[Path], dim: Optional[int] = None,
                   steps: Optional[int] = None, max_tokens: Optional[int] = None) -> Dict[str, Any]:
    if path is not None and path.exists() and path.stat().st_size > 0:
        return {
            "file": str(path),
            "sha256": sha256_of_file(path),
            "sizeBytes": path.stat().st_size,
            **({"dim": dim} if dim is not None else {}),
            **({"steps": steps} if steps is not None else {}),
            **({"maxTokens": max_tokens} if max_tokens is not None else {}),
        }
    return {"file": None, "sha256": "", "sizeBytes": 0,
            **({"dim": dim} if dim is not None else {}),
            **({"steps": steps} if steps is not None else {}),
            **({"maxTokens": max_tokens} if max_tokens is not None else {})}


def write_seed_forms(out_dir: Path, corpus: List[Dict[str, Any]]) -> None:
    payload = {"note": "generated by scripts/train_generator.py", "seeds": corpus}
    (out_dir / "seed-forms.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[corpus] wrote seed-forms.json ({len(corpus)} seeds)")


def write_manifest(out_dir: Path, stamp: str) -> Dict[str, Any]:
    models_dir = out_dir / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    artifacts = {
        "embedder": artifact_entry(models_dir / "embedder-all-minilm-l6-v2-int8.onnx",
                                   dim=CONFIG["embed_dim"], max_tokens=CONFIG["max_tokens"]),
        "tokenizer": artifact_entry(None, max_tokens=CONFIG["max_tokens"]),
        "sensory": artifact_entry(models_dir / "sensory-v0-int8.onnx", dim=16),
        "denoiser": artifact_entry(models_dir / "denoiser-v1-int8.onnx",
                                   dim=CONFIG["latent_dim"], steps=CONFIG["num_ddim_steps"]),
        "decoder": artifact_entry(models_dir / "decoder-v1-int8.onnx", dim=CONFIG["latent_dim"]),
        "aligner": None,  # Slice 2 (DR-5 registry shape stable now)
    }
    present = [e for e in artifacts.values() if e and e.get("file")]
    total = sum(int(e["sizeBytes"]) for e in present)
    manifest: Dict[str, Any] = {
        "version": "0.1.0-generated",
        "slice": 1,
        "generatedAt": stamp,
        "totalBytes": total,
        "artifacts": artifacts,
        "sensoryChannels": [{"name": ch} for ch in SENSORY_CHANNELS],
        "trainingSource": {
            "seedForms": len(SEED_TEXTS),
            "generatedAt": stamp,
            "anchors": ANCHOR_LATENTS,          # FR-7 one-hot primitive anchors
            "canonicalD0Latent": CANONICAL_D0_LATENT,
            "config": CONFIG,
        },
        "licenses": LICENSES,
    }
    (models_dir / "models.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[manifest] wrote models.json (totalBytes={total})")
    return manifest


# ── Training (guarded) ─────────────────────────────────────────────────────────

def run_training(args: argparse.Namespace, corpus: List[Dict[str, Any]]) -> None:
    if not HAS_TORCH:
        print("[train] torch not installed — skipping training (structural scaffold)")
        return
    torch.manual_seed(args.seed)
    rng = random.Random(args.seed)
    dataset = build_dataset(corpus)
    if dataset is None:
        return
    # TODO(training): 2×256 Swish+LN conditioning MLP + MLP denoiser (≤3M).
    # DDPM loop: cosine betas, MSE on ε, Adam lr, batch 64, ~3000 steps.
    print(f"[train] placeholder training path: {dataset.shape[0]} samples, "
          f"betas length {len(cosine_betas(CONFIG['T']))}")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Beyond Shape Slice 1 training scaffold")
    parser.add_argument("--out-dir", type=Path, default=Path("public"),
                        help="output directory (default: public/)")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--steps", type=int, default=CONFIG["steps"])
    parser.add_argument("--batch", type=int, default=CONFIG["batch"])
    parser.add_argument("--lr", type=float, default=CONFIG["lr"])
    parser.add_argument("--no-export", action="store_true",
                        help="skip the ONNX-export contract printout")
    parser.add_argument("--stamp", type=str, default=None,
                        help="override the content-stable build stamp (default: "
                             "derived from seeds+config so regeneration is byte-identical)")
    args = parser.parse_args(argv)

    corpus = build_seed_corpus()
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    write_seed_forms(out_dir, corpus)
    stamp = args.stamp or content_stamp()
    manifest = write_manifest(out_dir, stamp)

    run_training(args, corpus)
    if not args.no_export:
        export_onnx_stubs(out_dir)

    if not HAS_TORCH:
        print("\n[done] torch not installed → manifest+corpus regenerated only.")
        print("       install torch to run DDPM training + ONNX export (CR-7).")
    else:
        print("\n[done] scaffold training path complete — artifacts regenerated.")

    _ = manifest
    return 0


if __name__ == "__main__":
    sys.exit(main())