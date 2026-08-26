# ADR-0004 — Generation = SDF-blended latent diffusion

**Status:** Accepted · **Owner:** Tech Agent · **Date:** 2026-08-26
**Source:** Implementation Spec Slice 1, §3.3/§3.6 · Trace: FR-7, FR-8, FR-9, FR-10

## Decision

Generate forms via a small latent diffusion over a 64-d latent, conditioned on
`[e, q]` (embedding + sensory conditioning vector), decoded through a light MLP
to **smooth-min blend weights + per-part parameters over a parametric 8-primitive
SDF library** (sphere, box, roundedBox, cylinder, cone, torus, capsule, blob).
Rendered by in-browser marching cubes on a 48³ grid (WebGL2).

## Rationale

- Mesh-native text-to-3D diffusion (Shap-E-class) is far outside the on-device
  size/µs budget (CR-2, CR-5, QR-1).
- SDF blending makes "between box and sphere" a *reachable, renderable* point,
  dissolving the mean/mode critique at the representation level (C1/C2 via FR-7).
- The drift knob (FR-8) maps naturally to DDIM stochasticity (η = drift),
  giving the consensus ↔ edge axis a real mechanism.

## Named cost of the seam

- Shape vocabulary is bounded by the 8-primitive library + blend topology — a
  *convention*, extensible as data later (ADR-4 does not freeze the library).
- Raw-latent inspectability is lost; mitigated by the SdfParams view and a
  future affordance-vector UI (TD §4.5).
- Determinism (FR-10) requires CPU-float32 sampling + a seeded PRNG; GPU
  sampling is possible later only under a documented determinism trade-off.

## Consequences

- `scripts/train_generator.py` owns latent-space definition, DDPM training
  (cosine β, T=1000, MSE on ε, ≤ 3 M params denoiser), the canonical d=0
  initial latent, and the anchor latents for the FR-7 blend test.
- Later slices may extend the SDF library via the same manifest-driven model
  release path (DR-5).