#!/usr/bin/env python3
"""
Slice 1 training (spec §3.3/§3.5/§3.6, CR-7 partial, LR-9).

Trains and exports the two generative models, using the SAME on-device
artifacts for inference so the corpus matches the browser contract 1:1:

  seed text → embedder-int8 (mean-pool + L2) → e[384]
            → sensory-v0-int8 → q[16]
            → c = concat(e, q) = [400]
  dataset   → Gaussian clouds around each seed zCenter + inter-centre blends
  decoder   → z[64] → raw SdfParams outputs (weights8, blend_radius1, parts64,
              material7, motion2, pose3, hardness1) — FR-7 anchors decode to
              primitives; hardness = the 0.2.1 arbitrary per-anchor blend-mode
              convention (≥ 0.5 → 'cut', else 'soft')
  denoiser  → DDPM (cosine β, T=1000, MSE on ε, ≤3M params) conditioned on c
              with the browser's 25-step DDIM in mind — canonical d=0 zeros.

Outputs (all overridable via --out-dir, default public/):
  seed-forms.json   real {id,text,e,zCenter,sdfParams}
  models/models.json  v0.2.1 with real sha256/sizes + trainingSource provenance
  models/decoder-v2-int8.onnx, denoiser-v2-int8.onnx

Reproducible: fixed torch/python seeds + content-derived build stamp ⇒
byte-identical regeneration on the same env (LR-9).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ── Optional heavy imports (guarded so CI / nltk-less use stays importable) ───
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    HAS_TORCH = True
except Exception:  # pragma: no cover - env probe
    torch = None  # type: ignore[assignment]
    nn = None  # type: ignore[assignment]
    F = None  # type: ignore[assignment]
    HAS_TORCH = False

try:
    import onnxruntime as ort

    HAS_ORT = True
except Exception:  # pragma: no cover
    ort = None  # type: ignore[assignment]
    HAS_ORT = False

from transformers import AutoTokenizer  # for tokenizing seeds

# ── Spec-bound constants (spec §3.3 / §3.5) ──────────────────────────────────

SEED_TEXTS = [
    # Short — "one clean voice" (richness ≈ 0)
    "rain",
    "glass",
    "the sea is calm tonight",
    "a small yellow bird",
    "cold rain on tin roofs",
    "a house with colored windows",
    "we are all made of light",
    "heavy gray afternoon",
    "sugar and spice and everything nice",
    "the silence after music",
    # Structure-varied — "richness follows structure" (Slice 2, multi-voice)
    "a bright morning",
    "the garden after the rain glistens",
    "we carry the weight of small quiet decisions",
    "two sparrows argue above the wet fence about the last seed",
    "the old clock in the hall counts the hours of people who used to live here",
    "light moves across the room as the afternoon leans into evening, and the dust performs its slow dance",
    "the ferry takes the whole grey city across the sound in the morning, past islands that do not care about anyone",
    "I remember the summer kitchen, the wasps in the jam, my grandmother singing off-key to the radio, the sugar on the table",
    "the fog is dense this morning and the ferry has been delayed for hours while the gulls keep circling the grey water",
]

# The structure convention, mirrored from src/aesthetics/register.ts:
# richness = clamp((tokens − 3) / 22, 0, 1) — a reading's richness by length,
# visible machine grammar (Implementation Spec Phase C §3).
def structure_richness(tokens: int) -> float:
    return max(0.0, min(1.0, (tokens - 3) / 22.0))

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
    "num_ddim_steps": 25,       # sampling steps (DDIM, browser)
    "latent_dim": 64,
    "cond_dim": 401,            # c = concat(e[384], q[16], richness[1]) — Slice 2
    "cond_emb": 128,            # c_emb after 2×256 Swish+LayerNorm
    "lr": 5e-4,                 # Slice 2: lower LR — richer dataset was unstable at 1e-3
    "batch": 64,
    "steps": 3000,
    "denoiser_param_budget": 3_000_000,   # ≤ 3M params (spec §3.3)
    "embed_dim": 384,
    "max_tokens": 256,
}

CANONICAL_D0_LATENT: List[float] = [0.0] * CONFIG["latent_dim"]  # AMEND-1

# FR-7 one-hot primitive anchor latents (sphere=0, box=1, …).
ANCHOR_LATENTS: List[List[float]] = [
    [1.0 if i == p else 0.0 for i in range(CONFIG["latent_dim"])]
    for p in range(len(PRIMITIVE_NAMES))
]

# ── 0.2.1 per-anchor conventions (item-1 spec §3) ─────────────────────────────
# Blend MODE per anchor is an ARBITRARY convention (never semantic): most of
# the alphabet cuts (sphere box cylinder cone capsule) but a meaningful share
# morphs (roundedBox torus blob), so BOTH surface grammars stay present in the
# automatic experience — a reading that cuts is noticed because some readings
# don't. Mid-latents interpolate hardness. Mirrored threshold in
# src/core/sdfParams.ts and decode_raw_to_sdfparams below.
BLEND_HARDNESS_THRESHOLD = 0.5
SOFT_BLEND_ANCHORS = {2, 5, 7}  # roundedBox, torus, blob → 'soft'; else 'cut'

# Palette variance (Round VI, human decision: PASTEL, not vivid): each anchor
# carries its OWN saturation INSIDE the pastel band — the field, not a uniform.
# Values are RAW decoder targets (pre soft_bias), chosen so the decoded
# saturations land ≈ 0.22..0.70 inside the [0.1, 0.7] bias band (never vivid).
ANCHOR_SAT_RAW: Tuple[float, ...] = (1.2, 0.10, 0.65, 1.0, 0.25, 0.50, 0.35, 0.15)

# Blob ripple tamed AT THE TARGET LEVEL (plan item 2): the blob anchor's
# displacement cap drops 0.4 → 0.22 so the "off-forms" come from the data,
# not from a display clamp (decode clamp 0..0.5 stays).
BLOB_DISP_TARGET = 0.22

LICENSES = [
    {"name": "all-MiniLM-L6-v2", "license": "Apache-2.0",
     "note": "attribute per public/models/LICENSES/README.md"},
    {"name": "onnxruntime-web", "license": "MIT", "note": "runtime dependency"},
    {"name": "three.js", "license": "MIT", "note": "render dependency"},
]

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"


# ── Deterministic helpers ──────────────────────────────────────────────────────

def _hash_seed(text: str) -> int:
    h = 0x9E3779B9
    for ch in text:
        h = (h ^ ord(ch)) & 0xFFFFFFFF
        h = ((h << 13) ^ h) >> 0 & 0xFFFFFFFF
        h = (h * 0x5BD1E995) & 0xFFFFFFFF
    return h


def content_stamp() -> str:
    digest = hashlib.sha256()
    digest.update(json.dumps({
        "seeds": SEED_TEXTS,
        "config": CONFIG,
        "channels": SENSORY_CHANNELS,
        "blendConvention": {
            "threshold": BLEND_HARDNESS_THRESHOLD,
            "softAnchors": sorted(SOFT_BLEND_ANCHORS),
        },
        "palette": {"anchorSatRaw": list(ANCHOR_SAT_RAW), "decision": "pastel field"},
        "blobDispTarget": BLOB_DISP_TARGET,
    }, sort_keys=True).encode("utf-8"))
    return "content-" + digest.hexdigest()[:16]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def cosine_alpha_bar(t: float, total: int = CONFIG["T"], s: float = 0.008) -> float:
    """Matches src/core/generator.ts cosineAlphaBar (FR-10 determinism)."""
    x = ((t / total + s) / (1 + s)) * (math.pi / 2)
    c = math.cos(x)
    f = c * c
    norm = math.cos((s / (1 + s)) * (math.pi / 2))
    return f / (norm * norm)


# ── Inference through the shipped artifacts (browser parity) ──────────────────

def tokenize_seed(text: str, tok, max_tokens: int) -> Tuple[List[int], List[int]]:
    enc = tok(
        text,
        max_length=max_tokens,
        truncation=True,
        padding=False,
        return_tensors="pt",
    )
    return enc["input_ids"][0].tolist(), enc["attention_mask"][0].tolist()


def embed_seed(text: str, tok, embedder_session) -> List[float]:
    import numpy as np

    ids, mask = tokenize_seed(text, tok, CONFIG["max_tokens"])
    seq = len(ids)
    tid = [0] * seq
    feeds = {
        "input_ids": np.array([ids], dtype=np.int64),
        "attention_mask": np.array([mask], dtype=np.int64),
        "token_type_ids": np.array([tid], dtype=np.int64),
    }
    out = embedder_session.run(["last_hidden_state"], feeds)[0]  # [1, L, 384]
    row = out[0]  # [L, 384]
    e = row.sum(axis=0) / seq
    n = math.sqrt(float((e * e).sum()))
    if n > 0:
        e = e / n
    return [float(v) for v in e]


def sensory_q(e: List[float], sensory_session) -> List[float]:
    import numpy as np

    out = sensory_session.run(["raw"], {"e": np.array([e], dtype=np.float32)})[0]
    return [float(min(1.0, max(0.0, v))) for v in out[0]]


# ── Decoder targets & MLP ──────────────────────────────────────────────────────

def _part(scale: float, offset: Tuple[float, float, float] = (0, 0, 0),
          twist: float = 0.0, disp: float = 0.0) -> List[float]:
    return [scale, scale, scale, offset[0], offset[1], offset[2], twist, disp]


def canonical_sdf_raw(p: int) -> List[float]:
    """Target raw decoder outputs for the one-hot primitive anchor `p`.

    weights are a PROBABILITY distribution (soft one-hot: 0.93 at p, 0.01
    elsewhere) — the decoder head outputs LOGITS and is trained with KL against
    these probs, so interpolated latents decode to genuine blends (FR-7).
    """
    weights = [0.01] * 8
    weights[p] = 0.93
    blend = 0.06 if p != 7 else 0.18          # blob likes a larger radius
    parts: List[float] = []
    for i in range(8):
        if i == p:
            if p == 0:   parts += _part(1.0)
            elif p == 1: parts += _part(1.05)
            elif p == 2: parts += _part(1.0, disp=0.04)
            elif p == 3: parts += _part(0.8, (0, 0.4, 0))
            elif p == 4: parts += _part(0.9)
            elif p == 5: parts += _part(1.0)
            elif p == 6: parts += _part(0.7)
            else:        parts += _part(1.0, disp=BLOB_DISP_TARGET)  # blob ripple, tamed
        else:
            parts += _part(1.0)                # neutral, gated by weight ~0
    hue = [0.05, 0.10, 0.16, 0.30, 0.42, 0.55, 0.70, 0.88][p]  # warm→cool wander
    material = [hue, ANCHOR_SAT_RAW[p], 0.75, 0.45, 0.0, 0.0, 0.0]
    hardness = 0.0 if p in SOFT_BLEND_ANCHORS else 1.0
    return weights + [blend] + parts + material + [0.05, 0.0] + [0.4, 0.1, 0.0] + [hardness]


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def blend_target(p: int, r: int, lam: float, rng: random.Random) -> List[float]:
    """Interpolated decoder target (FR-7 'between' reachability).

    weights are a two-dominant probability vector (0.55/0.45) so an equal
    midpoint decodes to a max weight inside the spec's [0.5, 0.75] blend
    window — a pure probability-average would sit at ≤ 0.5 and is unreachable
    by softmax with residual mass on the silent primitives.
    """
    a = canonical_sdf_raw(p)
    b = canonical_sdf_raw(r)
    w = [0.0] * 8
    w[p] = 0.55
    w[r] = 0.45
    base = [lerp(x, y, lam) for x, y in zip(a[9:73], b[9:73])]
    # 0.2.1: a blend is "between" in EVERYTHING, not just the parts — material
    # (incl. per-anchor saturation → the palette field propagates to blends),
    # motion, pose, and hardness all interpolate with the same λ.
    mat = [lerp(x, y, lam) for x, y in zip(a[73:80], b[73:80])]
    mot = [lerp(x, y, lam) for x, y in zip(a[80:82], b[80:82])]
    pos = [lerp(x, y, lam) for x, y in zip(a[82:85], b[82:85])]
    return w + [lerp(a[8], b[8], lam)] + base + mat + mot + pos + [lerp(a[85], b[85], lam)]


class DecoderMLP(nn.Module):
    def __init__(self, latent=64, hidden=256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent, hidden), nn.GELU(),
            nn.Linear(hidden, hidden), nn.GELU(),
        )
        self.w = nn.Linear(hidden, 8)
        self.b = nn.Linear(hidden, 1)
        self.p = nn.Linear(hidden, 64)
        self.m = nn.Linear(hidden, 7)
        self.mo = nn.Linear(hidden, 2)
        self.po = nn.Linear(hidden, 3)
        self.h = nn.Linear(hidden, 1)  # 0.2.1 hardness (arbitrary per-anchor convention)

    def forward(self, z):
        h = self.net(z)
        return (self.w(h), self.b(h), self.p(h), self.m(h), self.mo(h), self.po(h), self.h(h))


def build_decoder_dataset(rng: random.Random, samples_per_pair: int = 400) -> List[Tuple[List[float], List[float]]]:
    pairs = []
    for _ in range(samples_per_pair):
        p = rng.randrange(8)
        if rng.random() < 0.5:
            target = canonical_sdf_raw(p)
            z = list(ANCHOR_LATENTS[p])
        else:
            r = rng.randrange(8)
            lam = rng.random()
            target = blend_target(p, r, lam, rng)
            za = ANCHOR_LATENTS[p]
            zb = ANCHOR_LATENTS[r]
            z = [za[i] * lam + zb[i] * (1 - lam) for i in range(64)]
        pairs.append((z, target))
    return pairs


def split_target(t: List[float]):
    w8 = t[0:8]
    br = [t[8]]
    parts = t[9:73]
    mat = t[73:80]
    mot = t[80:82]
    pos = t[82:85]
    hard = [t[85]]
    return w8, br, parts, mat, mot, pos, hard


def train_decoder(out_dir: Path, steps: int, batch: int) -> Path:
    torch.manual_seed(93)
    model = DecoderMLP()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    rng = random.Random(93)
    data = build_decoder_dataset(rng, samples_per_pair=600)
    xs = torch.tensor([d[0] for d in data], dtype=torch.float32)
    y_w = torch.tensor([split_target(d[1])[0] for d in data], dtype=torch.float32)   # N, 8
    y_b = torch.tensor([split_target(d[1])[1] for d in data], dtype=torch.float32)   # N, 1
    y_p = torch.tensor([split_target(d[1])[2] for d in data], dtype=torch.float32)   # N, 64
    y_m = torch.tensor([split_target(d[1])[3] for d in data], dtype=torch.float32)   # N, 7
    y_mo = torch.tensor([split_target(d[1])[4] for d in data], dtype=torch.float32)  # N, 2
    y_po = torch.tensor([split_target(d[1])[5] for d in data], dtype=torch.float32)  # N, 3
    y_h = torch.tensor([split_target(d[1])[6] for d in data], dtype=torch.float32)   # N, 1

    for step in range(steps):
        idx = torch.randint(0, xs.shape[0], (batch,))
        z = xs[idx]
        w8, br, parts, mat, mot, pos, h = model(z)
        loss_w = F.kl_div(F.log_softmax(w8, dim=1), y_w[idx], reduction="batchmean")
        loss = (
            loss_w
            + F.mse_loss(br, y_b[idx])
            + F.mse_loss(parts, y_p[idx])
            + F.mse_loss(mat, y_m[idx])
            + F.mse_loss(mot, y_mo[idx])
            + F.mse_loss(pos, y_po[idx])
            + F.mse_loss(h, y_h[idx])
        )
        opt.zero_grad()
        loss.backward()
        opt.step()
        if step % 500 == 0:
            print(f"  [decoder] step {step} loss {loss.item():.4f}")

    fp32 = out_dir / "decoder-fp32.onnx"
    int8 = out_dir / "decoder-v2-int8.onnx"
    _export(
        model, (torch.zeros(1, 64, dtype=torch.float32),),
        fp32, int8,
        in_names=["z"],
        out_names=["weights", "blend_radius", "parts", "material", "motion", "pose", "hardness"],
        dyn={"z": {0: "batch"}},
    )
    fp32.unlink(missing_ok=True)
    return int8


# ── Denoiser (DDPM) ───────────────────────────────────────────────────────────

class ConditionMLP(nn.Module):
    """c(400) → c_emb(128): 2×256 Swish + LayerNorm (spec §3.3)."""

    def __init__(self, c_in=400, emb=128):
        super().__init__()
        self.fc1 = nn.Linear(c_in, 256)
        self.ln1 = nn.LayerNorm(256)
        self.fc2 = nn.Linear(256, emb)
        self.ln2 = nn.LayerNorm(emb)

    def forward(self, c):
        return self.ln2(self.fc2(F.silu(self.ln1(self.fc1(c)))))


class DenoiserMLP(nn.Module):
    """εθ(x[64], t[1], c_emb[128], richness[1]) → ε[64]. Sinusoidal time embed → 32-d.

    Richness gets a DIRECT channel into the body (not only through the 401-d
    conditioning MLP, where a single scalar can be washed out by the 384-d
    embedding). This is Slice 2's structural guarantee that "rich c → several
    voices" is learnable. Export keeps the same `c[401]` interface.
    """

    def __init__(self, latent=64, cond=128, hidden=512, time_emb=32, rich=1):
        super().__init__()
        self.time_emb = time_emb
        self.freqs = nn.Parameter(torch.arange(1, 17, dtype=torch.float32) * 3.0, requires_grad=False)
        self.net = nn.Sequential(
            nn.Linear(latent + time_emb + cond + rich, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
            nn.Linear(hidden, latent),
        )

    def t_embed(self, t_norm: torch.Tensor) -> torch.Tensor:
        # t_norm in [0,1]; scale to a wavelength-rich range for mixing with x
        ph = self.freqs[None, :] * (t_norm[:, None] * 1000.0)
        return torch.cat([torch.sin(ph), torch.cos(ph)], dim=1)  # [B, 12]

    def forward(self, x, t_norm, c_emb, richness):
        te = self.t_embed(t_norm)
        h = torch.cat([x, te, c_emb, richness], dim=1)
        return self.net(h)


def cosine_ab_tensor(t: torch.Tensor) -> torch.Tensor:
    """Vectorised cosine alpha_bar for tensor timesteps [B]."""
    x = ((t / CONFIG["T"] + 0.008) / 1.008) * (math.pi / 2)
    f = torch.cos(x) ** 2
    norm = math.cos((0.008 / 1.008) * (math.pi / 2)) ** 2
    return f / norm


def build_cond_dataset(corpus, rng: random.Random, n: int) -> List[Tuple[List[float], List[float]]]:
    """(c, z_target) pairs: per-seed clouds + inter-centre blends (FR-7).

    Richness coupling is STRUCTURAL, not left to the regression to find:
    seeds are sampled weighted by (1 + 5·richness), rich readings get tighter
    jitter and a moderate share of CLEAN multi-anchor targets, so the denoiser
    sees strong signal that "rich c → several voices at once" (Slice 2).
    """
    weights = [1.0 + 5.0 * (corpus[i].get("richness", 0.0)) for i in range(len(corpus))]

    def pick_seed() -> int:
        total = sum(weights)
        r = rng.random() * total
        acc = 0.0
        for i, w in enumerate(weights):
            acc += w
            if r <= acc:
                return i
        return len(corpus) - 1

    data = []
    for _ in range(n):
        if rng.random() < 0.7:
            entry = corpus[pick_seed()]
            c = entry["c"]
            z0 = entry["zCenter"]
            rich = entry.get("richness", 0.0)
            if rich > 0.4 and rng.random() < 0.25:
                z = list(z0)  # clean multi-anchor target
            else:
                jit = 0.20 * (1.0 - 0.55 * rich)  # tight rich, loose short
                z = [z0[d] + rng.gauss(0.0, jit) for d in range(64)]
        else:
            i = rng.randrange(len(corpus))
            j = rng.randrange(len(corpus))
            lam = rng.random()
            c = [corpus[i]["c"][d] * lam + corpus[j]["c"][d] * (1 - lam)
                 for d in range(CONFIG["cond_dim"])]
            za = corpus[i]["zCenter"]
            zb = corpus[j]["zCenter"]
            z = [za[d] * lam + zb[d] * (1 - lam) for d in range(64)]
        data.append((c, z))
    return data


def train_denoiser(out_dir: Path, corpus, steps: int, batch: int) -> Path:
    torch.manual_seed(7)
    # c_eq = e+q (400) → c_emb; richness bypasses the compression and enters the
    # denoiser body directly through its dedicated channel (Slice 2).
    cond_mlp = ConditionMLP(c_in=400, emb=CONFIG["cond_emb"])
    denoi = DenoiserMLP()
    params = sum(p.numel() for p in list(cond_mlp.parameters()) + list(denoi.parameters()))
    assert params <= CONFIG["denoiser_param_budget"], f"denoiser {params} > budget"
    opt = torch.optim.Adam(list(cond_mlp.parameters()) + list(denoi.parameters()), lr=CONFIG["lr"])
    rng = random.Random(7)
    data = build_cond_dataset(corpus, rng, n=4000)
    c_t = torch.tensor([d[0] for d in data], dtype=torch.float32)
    z_t = torch.tensor([d[1] for d in data], dtype=torch.float32)

    for step in range(steps):
        idx = torch.randint(0, c_t.shape[0], (batch,))
        c = c_t[idx]
        z0 = z_t[idx]
        t = torch.randint(0, CONFIG["T"], (batch,)).float()
        ab = cosine_ab_tensor(t)[:, None]                      # [B,1]
        noise = torch.randn_like(z0)
        x_t = torch.sqrt(ab) * z0 + torch.sqrt(1 - ab) * noise
        c_emb = cond_mlp(c[:, :400])
        rich = c[:, 400:401]
        eps_hat = denoi(x_t, t / CONFIG["T"], c_emb, rich)
        loss = F.mse_loss(eps_hat, noise)
        opt.zero_grad()
        loss.backward()
        opt.step()
        if step % 500 == 0:
            print(f"  [denoiser] step {step} loss {loss.item():.4f}")

    class FullDenoiser(nn.Module):
        def __init__(self, cm, dn):
            super().__init__()
            self.cm = cm
            self.dn = dn

        def forward(self, x, t, c):
            # c[401] = e(384) + q(16) + richness(1); richness enters the body
            # directly through the model's dedicated channel (Slice 2).
            c_eq = c[:, :400]
            richness = c[:, 400:401]
            return self.dn(x, t, self.cm(c_eq), richness)

    full = FullDenoiser(cond_mlp, denoi).eval()
    fp32 = out_dir / "denoiser-fp32.onnx"
    int8 = out_dir / "denoiser-v2-int8.onnx"
    _export(
        full,
        (torch.zeros(1, 64), torch.zeros(1), torch.zeros(1, CONFIG["cond_dim"])),
        fp32, int8,
        in_names=["x", "t", "c"],
        out_names=["eps"],
        dyn={"x": {0: "batch"}, "t": {0: "batch"}, "c": {0: "batch"}, "eps": {0: "batch"}},
    )
    fp32.unlink(missing_ok=True)
    return int8


# ── ONNX export helper (legacy exporter; int8 dynamic) ─────────────────────────

def _export(model, sample, fp32: Path, int8: Path,
            in_names: List[str], out_names: List[str], dyn: Dict[str, Any]) -> None:
    from onnxruntime.quantization import QuantType, quantize_dynamic

    torch.onnx.export(
        model, sample, str(fp32),
        input_names=in_names, output_names=out_names,
        dynamic_axes=dyn or None, opset_version=13, dynamo=False,
    )
    quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QInt8)


# ── Seed corpus with REAL embeddings ───────────────────────────────────────────

def build_seed_corpus(out_dir: Path) -> List[Dict[str, Any]]:
    models_dir = out_dir / "models"
    tok = AutoTokenizer.from_pretrained(str(models_dir / "tokenizer"))
    embedder = ort.InferenceSession(str(models_dir / "embedder-all-minilm-l6-v2-int8.onnx"))
    sensory = ort.InferenceSession(str(models_dir / "sensory-v0-int8.onnx"))

    def richness_of(text: str) -> Tuple[float, int]:
        ids, _ = tokenize_seed(text, tok, CONFIG["max_tokens"])
        return structure_richness(len(ids)), len(ids)

    def z_center_for(p: int, richness: float, rng: random.Random) -> List[float]:
        # Short readings keep ONE clean anchor (centre-legible — Concept
        # amendment). Rich readings get a MULTI-ANCHOR convex centre, so the
        # decoder (trained on anchor blends, FR-7) surfaces several voices:
        # "richness follows structure" lives in the data, taught to the denoiser.
        if richness <= 0.15:
            k = 1
        else:
            k = min(4, 1 + int(round(richness * 3)))
        anchors = [(p + j * 2) % 8 for j in range(k)]
        z = [0.0] * CONFIG["latent_dim"]
        for a in anchors:
            z[a] = 1.0 / k
        return [z[d] + rng.gauss(0, 0.02) for d in range(CONFIG["latent_dim"])]

    corpus = []
    rng = random.Random(1)
    for text in SEED_TEXTS:
        e = embed_seed(text, tok, embedder)
        q = sensory_q(e, sensory)
        richness, tokens = richness_of(text)
        c = e + q + [richness]
        p = _hash_seed(text) % 8
        z_center = z_center_for(p, richness, rng)
        corpus.append({
            "id": text.replace(" ", "-"),
            "text": text,
            "tokens": tokens,
            "richness": richness,
            "e": e, "zCenter": z_center, "sdfParams": None,  # sdfParams filled via decoder
            "c": c,
        })
    return corpus


def decode_all_sdf(corpus) -> None:
    _ = corpus  # decoding happens inline after training in main()


def wrap01(x: float) -> float:
    m = x % 1.0
    return m + 1.0 if m < 0 else m


def wrap_two_pi(x: float) -> float:
    m = x % (2.0 * math.pi)
    return m + 2.0 * math.pi if m < 0 else m


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def soft_bias(x: float, lo: float, hi: float) -> float:
    center = (lo + hi) / 2
    radius = (hi - lo) / 2 + 0.18
    z = (x - center) / radius
    squashed = z / (1 + abs(z))
    return center + radius * squashed


def softmax(vals: List[float]) -> List[float]:
    m = max(vals)
    exps = [math.exp(v - m) for v in vals]
    s = sum(exps)
    return [v / s for v in exps]


def decode_raw_to_sdfparams(raw: List[float]) -> Dict[str, Any]:
    """Mirror of src/core/sdfParams.ts decodeRawToSdfParams (structure + clamps)."""
    w = softmax(raw[0:8])
    parts = []
    for i in range(8):
        b = 9 + i * 8
        parts.append({
            "scale": [_clamp(raw[b + 0], 0.05, 3), _clamp(raw[b + 1], 0.05, 3),
                      _clamp(raw[b + 2], 0.05, 3)],
            "offset": [_clamp(raw[b + 3], -1.5, 1.5), _clamp(raw[b + 4], -1.5, 1.5),
                       _clamp(raw[b + 5], -1.5, 1.5)],
            "twist": _clamp(raw[b + 6], -math.pi, math.pi),
            "displacement": _clamp(raw[b + 7], 0, 0.5),
        })
    mat = raw[73:80]
    return {
        "weights": w,
        "blendRadius": _clamp(raw[8], 0.05, 0.5),
        "blendMode": "cut" if raw[85] >= BLEND_HARDNESS_THRESHOLD else "soft",
        "parts": parts,
        "material": {
            "hue": wrap01(mat[0]),
            "saturation": _clamp(soft_bias(mat[1], 0.1, 0.7), 0, 1),
            "lightness": _clamp(soft_bias(mat[2], 0.5, 0.95), 0, 1),
            "roughness": _clamp(mat[3], 0, 1),
            "metalness": _clamp(mat[4], 0, 1),
            "clearcoat": _clamp(mat[5], 0, 1),
            "emissive": _clamp(mat[6], 0, 1),
        },
        "motion": {"breathe": _clamp(raw[80], 0, 1), "sway": _clamp(raw[81], 0, 1)},
        "pose": {
            "yaw": wrap_two_pi(raw[82]),
            "pitch": _clamp(raw[83], -math.pi / 2, math.pi / 2),
            "roll": wrap_two_pi(raw[84]),
        },
    }


# ── Manifest ───────────────────────────────────────────────────────────────────

def artifact_entry(path: Optional[Path], root: Path, **extra) -> Dict[str, Any]:
    if path is None:
        return {"file": None, "sha256": "", "sizeBytes": 0, **extra}
    return {"file": str(path.relative_to(root)), "sha256": _sha256(path),
            "sizeBytes": path.stat().st_size, **extra}


def write_manifest(out_dir: Path, stamp: str, denoiser: Path, decoder: Path) -> Dict[str, Any]:
    models_dir = out_dir / "models"
    present = [denoiser, decoder, models_dir / "embedder-all-minilm-l6-v2-int8.onnx",
               models_dir / "sensory-v0-int8.onnx"]
    total = sum(int(p.stat().st_size) for p in present)
    manifest = {
        "version": "0.2.1-generated",
        "slice": 3,
        "generatedAt": stamp,
        "totalBytes": total,
        "artifacts": {
            "embedder": artifact_entry(models_dir / "embedder-all-minilm-l6-v2-int8.onnx",
                                       out_dir, dim=CONFIG["embed_dim"], max_tokens=CONFIG["max_tokens"]),
            "tokenizer": artifact_entry(models_dir / "tokenizer" / "vocab.txt",
                                        out_dir, max_tokens=CONFIG["max_tokens"]),
            "sensory": artifact_entry(models_dir / "sensory-v0-int8.onnx", out_dir, dim=16),
            "denoiser": artifact_entry(denoiser, out_dir, dim=CONFIG["latent_dim"],
                                       steps=CONFIG["num_ddim_steps"]),
            "decoder": artifact_entry(decoder, out_dir, dim=CONFIG["latent_dim"]),
            "aligner": None,
        },
        "sensoryChannels": [{"name": ch} for ch in SENSORY_CHANNELS],
        "trainingSource": {
            "seedForms": len(SEED_TEXTS),
            "generatedAt": stamp,
            "anchors": ANCHOR_LATENTS,
            "canonicalD0Latent": CANONICAL_D0_LATENT,
            "config": CONFIG,
            # 0.2.1 provenance: the blend-mode convention + palette decision are
            # part of the machine's grammar, recorded like any other bias.
            "blendModeConvention": {
                "threshold": BLEND_HARDNESS_THRESHOLD,
                "softAnchors": [PRIMITIVE_NAMES[i] for i in sorted(SOFT_BLEND_ANCHORS)],
                "cutAnchors": [PRIMITIVE_NAMES[i] for i in range(8) if i not in SOFT_BLEND_ANCHORS],
                "note": "arbitrary per-anchor convention, never semantics",
            },
            "palette": {
                "decision": "pastel field (Round VI human ruling)",
                "anchorSatRaw": list(ANCHOR_SAT_RAW),
            },
            "blobDispTarget": BLOB_DISP_TARGET,
        },
        "licenses": LICENSES,
    }
    (models_dir / "models.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


# ── CLI ────────────────────────────────────────────────────────────────────────

def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Beyond Shape Slice 1 model training")
    parser.add_argument("--out-dir", type=Path, default=Path("public"))
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--steps", type=int, default=CONFIG["steps"])
    parser.add_argument("--batch", type=int, default=CONFIG["batch"])
    parser.add_argument("--stamp", type=str, default=None)
    args = parser.parse_args(argv)

    if not HAS_TORCH or not HAS_ORT:
        print("[train] torch/onnxruntime not available — install requirements.txt")
        return 1

    out_dir = args.out_dir.resolve()
    models_dir = out_dir / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    stamp = args.stamp or content_stamp()

    print("[1/4] seed embeddings via shipped int8 artifacts …")
    corpus = build_seed_corpus(out_dir)

    print("[2/4] training decoder …")
    if os.environ.get("BS_SKIP_DECODER") and (models_dir / "decoder-v2-int8.onnx").exists():
        # Decoder is corpus-independent + deterministic; skip on iteration reruns.
        decoder = models_dir / "decoder-v2-int8.onnx"
        print("       (BS_SKIP_DECODER set — reusing decoder-v2-int8.onnx)")
    else:
        decoder = train_decoder(models_dir, steps=args.steps, batch=args.batch)

    print("[3/4] training denoiser (DDPM) …")
    if os.environ.get("BS_SKIP_DENOISER") and (models_dir / "denoiser-v2-int8.onnx").exists():
        # 0.2.1: "denoiser untouched" (item-1 spec §3) — the conditioning did not
        # change, so the artifact is reused and the manifest sha matches 0.2.0.
        denoiser = models_dir / "denoiser-v2-int8.onnx"
        print("       (BS_SKIP_DENOISER set — reusing denoiser-v2-int8.onnx)")
    else:
        denoiser = train_denoiser(models_dir, corpus, steps=args.steps, batch=args.batch)

    print("[4/4] decoding seed sdfParams + writing corpus & manifest …")
    import numpy as np

    dec = ort.InferenceSession(str(decoder))
    for seed in corpus:
        z = np.array([seed["zCenter"]], dtype=np.float32)
        out = dec.run(["weights", "blend_radius", "parts", "material", "motion", "pose", "hardness"],
                      {"z": z})
        raw = (
            [float(v) for v in out[0][0]]
            + [float(out[1][0][0])]
            + [float(v) for v in out[2][0]]
            + [float(v) for v in out[3][0]]
            + [float(v) for v in out[4][0]]
            + [float(v) for v in out[5][0]]
            + [float(v) for v in out[6][0]]
        )
        seed["sdfParams"] = decode_raw_to_sdfparams(raw)
        seed.pop("c", None)

    seed_file = out_dir / "seed-forms.json"
    seed_file.write_text(
        json.dumps({"note": "generated by scripts/train_generator.py", "seeds": corpus},
                   indent=2), encoding="utf-8")
    _ = write_manifest(out_dir, stamp, denoiser, decoder)
    print(f"[done] seeds={len(corpus)} decoder={decoder.stat().st_size}B "
          f"denoiser={denoiser.stat().st_size}B → {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())