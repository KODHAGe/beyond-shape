# ADR-0005 — On-device embedder: all-MiniLM-L6-v2 (int8)

**Status:** Accepted · **Owner:** Tech Agent · **Date:** 2026-08-26
**Source:** Implementation Spec Slice 1, §3.2/§3.6 · Trace: FR-1, FR-2, FR-5

## Decision

Use **all-MiniLM-L6-v2** as the on-device text embedder, exported to int8 ONNX
(`embedder-all-minilm-l6-v2-int8.onnx`, ~23 MB), executed in-browser via ONNX
Runtime Web (WebGPU/WASM). Embedding = L2-normalised mean-pooled last hidden
state → `e ∈ R^384`. No text leaves the device (FR-5/CR-6).

## Rationale

- 384-d, ~22.7 M params, Apache-2.0, int8 ≈ 23 MB — fits the ≤ 120 MB budget
  and the QR-1 latency budget on a mid-range phone.
- Chosen over bge-small / gte-small / e5-small on size + latency for the
  primary device profile (TD §3.1).
- Continuous representation satisfies FR-1/FR-2 (no taxonomy, no logits).

## Named cost of the seam

- **New imported authority** — a pretrained model's priors become the machine's
  reading (REDESIGN §5, "imported authority, round two"). Mitigation: the
  community aligner (Slice 2) learns a corpus-derived text↔form metric that
  *corrects* this imported prior over time.
- English-centric support (REQUIREMENTS §9): multi-language depends on what
  MiniLM handles; documented.
- Swap path: the model is replaceable via `models.json` pointer change (DR-5).

## Consequences

- Tokenizer + config ship alongside; max 256 tokens with truncate-with-warning.
- The v0 sensory head (`sensory-v0-int8.onnx`) is a linear head on `e` and is
  deliberately **not** an ADR-worthy decision — it is temporary scaffolding,
  replaced by trained probes in Slice 2.