# Implementation Spec — Phase C: The Encounter

Status: consensus-approved · Owner: Tech Agent · Date: 2026-08-30

> Consensus group: Concept (Curator), Requirements (Translator), Tech (Builder),
> Reflector (Memory — §2.6, principal context `ORIGINAL-2019.md`),
> Render Reviewer (Projectionist — §2.5). Stage-1 verdicts and converged
> amendments in §9. This spec is the output of the full protocol; dev
> subagents build to it.

---

## 1. Scope

The vertical slice that makes the encounter *evocative, not just functional*
(Gate C). Two build slices:

- **Slice 1 — the encounter carries the register (code, no retraining).**
  The app adopts the **collision** register (D-B verdict) through the retune
  layer behind the existing drift knob; the reading's *structure* (richness,
  from on-device token count) feeds spacing; alternates inherit the register;
  marginalia verified against the real seed corpus; E2E user-flow asserted.
  Requirements: FR-7, FR-8, FR-9, FR-11, QR-4, QR-6, FR-10 bindings.
- **Slice 2 — structure-aware generation (training, Python).**
  Make "richness follows structure" true at the source (Reflector addendum):
  a structure channel enters the generator conditioning; the seed corpus is
  expanded with structure-varied texts (3–25 tokens); denoiser + decoder
  retrained; manifest `0.2.0`. Requirements: FR-7, C1, C2, CR-5, QR-6.

## 2. Requirement trace

| Requirement | Acceptance test (how we verify) | ADR if any |
|---|---|---|
| FR-7 continuous shape space | retune output is a valid SdfParams; no discrete primitive pop | — |
| FR-8 consensus⇄edge | drift knob moves register from clean to colliding; monotonic seam/space change (unit) | — |
| FR-9 ≥3 visible alternates | alternates cells render register-tuned forms (e2e) | — |
| FR-11 non-suppressible marginal note | note present when cosE > 0.35; never omit once shown (e2e) | — |
| QR-4 deliberate aesthetic, C7 light/happy | collision register stays pastel-biased; pastel is a field, not a clamp (unit) | — |
| QR-6 / FR-10 reproducibility | same input+drift+seed → same form incl. register/structure (e2e, unit) | — |
| CR-5 model budget ≤ 120 MB | manifest slice-2 total bytes check (ci) | — |
| C1/C2 living distribution, regulated edge | alternates+drift spectrum visible; edge is structural, not gloss | — |

## 3. Technical decisions (bindings)

- **Register:** `collision` (REGISTERS in `src/aesthetics/register.ts`); clay
  remains defined for the future register toggle. No user-facing toggle in
  this slice.
- **The spindle:** the app's single drift knob drives BOTH the generator's
  consensus sampling AND the retune layer's register drift (one concept, one
  knob — C2). Default drift 0.55 (D-B lean "more drift").
- **Structure:** `structureRichness(tokens)` (3→0 … 25+→1), tokens from
  `Embedder.tokenCount()` (on-device, deterministic, never transmitted).
  Spacing `×lerp(1,1.6,richness)`; weight-exponent flattened by richness.
  One-hot collapse is NOT faked: single-voice readings stay single-voice;
  voice-surfacing is Slice 2's job (recorded in `REFLECTOR-DIALOGUE.md`).
- **Alternates:** each decoded alternate is retuned with the same register/
  drift/richness before rendering.
- **Marginalia:** unchanged computation (cosE/cosZ over seeds); corpus grows
  in Slice 2 making "whose crowd is nearest" meaningful.
- **Rendering:** retuned SdfParams flow through the existing WebGL/software
  tiers unchanged (bounding-sphere framing already present).

## 4. Interfaces

- Public: `Embedder.tokenCount(text) → number` (new, on-device);
  `retune(form, kind, drift, richness)` (exists).
- Internal: `runOnce` retunes primary + alternates after decode; `RunRecord
  .sdfParams` = the rendered (register-tuned) params — code comment marks the
  register adoption; raw decode remains in `z`.

## 5. Data model

- `models.json` → **0.2.0** (Slice 2): denoiser/decoder artifact entries
  content-stamped; corpus expanded (`seed-forms.json` gains structure-varied
  texts 3–25 tokens); `trainingSource` provenance updated.
- No schema change in Slice 1.

## 6. Constraints & env

- Cloudflare-free local dev continues to be the baseline (LR-1…LR-10).
- Slice 2 uses the pinned Python env (`.venv`, `requirements.txt` —
  Python 3.12) and the free-CPU budget (~15 min); exports int8 ONNX; assets
  stay ≤ 120 MB; interface change (conditioning dim) is a MANIFEST bump, not a
  silent ABI change.
- Privacy: the structure signal is derived on-device; nothing new leaves the
  browser (FR-5/QR-3, re-audit in privacy e2e).

## 7. Definition of done

- All acceptance tests pass (unit + e2e incl. marginalia + alternates).
- Long reading (25+ tokens) surfaces ≥ 2 live voices at high drift (Slice 2);
  short readings stay 1–2 voices.
- `ci-checks`, typecheck, lint, build, e2e green.
- No open objections; Reflector verdicts recorded (§9).

## 8. Out of scope (explicit)

- The Mapper/crowd (Phase D) — the drift knob remains "designer's edge, owned
  divergence" until then.
- Register toggle UI in the app (later slice).
- Context staging (totem/strip/gallery — Phase E).
- Consensus-distance semantics between readings (Phase E/D).

---

## 9. Consensus record (Stage 1 → Stage 2)

**Tech (proposal owner).** Feasible — both slices. Slice 1 is cheap and
independent; Slice 2 must bump the manifest and is the honest home of the
voice-surfacing fix. Cost verdict: feasible-free (CPU training; no paid path).

**Reflector (Memory) — reflections against ORIGINAL-2019.md:**
1. Register adoption + drift spindle: **resonant** with the original's
   "post-optimal object" and "designed ambiguity" — *"eliminating
   readability… importance on conveying understanding rather than data."*
   Keeps the owned divergence (designer's-edge until the Mapper).
2. Richness-follows-structure: **mutates** the original's *"size modulated by
   the relative length of its sentence"* and its *"separate shapes…
   combination into a whole."* Amendment accepted: distance is
   **reading-structure distance now**, never consensus-closeness (the
   original's *"placing emotionally similar objects closer"*) until data can
   justify it — the two must stay labeled apart.
3. One more original warning carried in: **don't fake voices** — a one-hot
   reading stays one-voiced (Slice 2 fixes the source, never the display).

**Concept (Curator).** Approve with amendments: (a) the register must be
*structure, not style* — seams stay derived from decoded values, never curated;
(b) centre-legibility holds for low-richness readings; (c) the pastel
field stays a bias; (d) the app must not present the register as meaning
("tense text → tense form" is forbidden framing).

**Requirements (Translator).** Approve with amendments: determinism must hold
across the register/structure layers (they are pure and deterministic — added
unit guards); `tokenCount` is a new interface — document it as structure
provenance; Slice-2 acceptance needs the explicit "long→≥2 voices" test.

**Render Reviewer (Projectionist).** Approve — no new contexts (alternates
stay 3), sizing/DPR/orbit/framing already verified; note: smaller collision
blend radius may raise mesh spikiness — 48³ sampling and the winding guard
cover it; keep the software tier three-free.

**Converged amendments (Stage 2):** all folded into §3/§4 above. No objects.

**Stage 4 delegation:** Slice 1 → dev subagent, this spec's §1–§4; Slice 2 →
Python dev subagent with §3/§6 bindings after Slice 1 lands.