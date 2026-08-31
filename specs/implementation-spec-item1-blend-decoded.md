# Implementation Spec — Blend as a decoded variable + palette variance (0.2.1)

Status: **DRAFT → SHIPPED** (human-decided plan, 2026-08-31; built as specified —
consensus record §9 is the remaining formality, verdicts already recorded in
REFLECTOR-DIALOGUE.md Round VI)
⏵ **STATUS 2026-08-31:** item-1 BUILT. Render-code wiring (blendMode field,
hardness→mode decode, renderers, lab auto/override) + decoder-v2 retrain
(hardness head, per-anchor sat targets, blob ripple tamed at target, blends
interpolate material/hardness) + corpus regen + manifest **0.2.1-generated**
(slice 3, provenance recorded). Denoiser untouched (sha matches 0.2.0).
Measured: sat spread 0.567 (was 0.076), blend 14 cut/5 soft, blob disp max
0.113, voices intact. All gates green incl. e2e through the real v2 model.
Owner: Tech Agent (draft) · Date: 2026-08-31

> Scope source: plan item 1 (blend as a decoded variable) + plan item 2's
> training half (blob ripple tamed at the target level) + palette Round VI
> amendment 1 (saturation variance) — all three ride the SAME decoder retrain,
> so one slice, one manifest bump, one corpus regen.
> The render half of plan item 2 (64³ cut, no Laplacian) shipped separately
> right after `83195a0` — see §8.

---

## 1. Scope (verbatim from requirements/concept)

- **FR-7 · FR-8 · QR-4 · QR-6 · C7 · C1 · CR-5.** Add a **hardness/blendMode
  output** to the decoder as an *arbitrary per-anchor convention — never
  semantic*. `SdfParams.blendMode` ('soft' | 'cut') flows to the renderers and
  the lab (auto = decoded + manual override). Decoder retrained; corpus
  regenerated; **denoiser untouched**; manifest → `0.2.1`.
- **Palette Round VI amendment 1.** Training saturation targets that *use* the
  pastel band instead of centring it — per-reading saturation variance (bias,
  never clamp; QR-4/C7 preserved).
- **Plan item 2, training half.** Blob ripple displacement tamed **at the
  target level** (blob-dominant anchor targets), not at the display — the
  "off-forms" source is the training targets, fixed in training.

## 2. Requirement trace

| Requirement | Acceptance test (how we verify) | ADR if any |
|---|---|---|
| FR-7 continuous shape space | soft readings still decode to continuous smooth-min forms; cut is a declared convention (the original's overlapping solids), not a broken soft path (unit: blend per anchor/structure) | ADR-4 (extends), pending ADR-6 |
| FR-8 consensus⇄edge | blendMode is orthogonal to the drift spindle: same drift ramp still moves seam/space monotonically; blendMode does not move with drift (unit) | — |
| QR-4 / C7 pastel field | post-retrain decoded sat: per-seed spread WIDENS while staying inside the pastel field (bias band 0.1–0.7 + its soft shoulder — never a clamp, never vivid); unit on regenerated seed-forms | — |
| QR-6 / FR-10 reproducibility | same text+seed+drift → same form including blendMode; determinism ≤1e-6; corpus regeneration byte-identical on same env (ci) | — |
| CR-5 budget ≤ 120 MB | manifest 0.2.1 total bytes check (ci) | — |
| C1 arbitrariness visible | lab shows blend as a decoded preference, not a meaning; manual override labelled "override" (e2e/lab) | — |
| Reflector Round VI | hue-per-part wrap rule either capped or documented openly in UI/marginalia (unit + lab copy) | — |

## 3. Technical decisions (bindings)

- **Decoder output contract extension** (mirrored in
  `src/core/sdfParams.ts` ↔ `scripts/train_generator.py`): add `hardness
  [1,1]` as the 7th output (index 6, after `pose[1,3]` — an ABI change, hence
  the MANIFEST bump, never a silent edit). Decode: `blendMode = hardness >= 0.5
  ? 'cut' : 'soft'` — a hard, documented convention.
- **Per-anchor convention (arbitrary, never semantic):** blob & torus anchor
  latents → hardness ~0 (soft); sphere/box/roundedBox/cylinder/cone/capsule →
  hardness ~1 (cut). Inter-anchor blends interpolate. The mapping is a *random
  convention of the anchor alphabet*, recorded in the decoder provenance; the
  UI never frames it as meaning ("tense text → hard form" is forbidden framing,
  the same guardrail as the register).
- **Saturation variance target:** training targets sample per-seed saturation
  across the pastel band (e.g., per-seed `sat ~ U(0.25, 0.7)` anchored to
  sensory `colour-saturation` channel) instead of the current near-constant
  0.5; the TS decode keeps the existing `softBias(…, 0.1, 0.7)` — bias, never
  clamp.
- **Blob off-form taming:** blob-dominant anchor targets use displacement
  ≤ ~0.25 (ripple ripple ≤ ~0.5·2·0.25), pulling the decoded displacement band
  inward at the source; the decode clamp (0..0.5) is unchanged.
- **SdfParams.blendMode:** new field in `src/types.ts`
  (`blendMode: 'soft' | 'cut'`, default 'soft' on missing/legacy decode).
- **Renderers consume it:** `getSolidMesh(sdf, mode?)` defaults to
  `sdf.blendMode` (callers in `scene.ts` `Scene`/`CellScene` pass nothing or
  an explicit override); the rendered layer is the decoded surface quality.
- **retune:** passes `blendMode` through unchanged (surface quality is the
  machine's, drift moves space/seam/materials — not the decoded mode).
- **Lab:** the blend fork becomes **auto (decoded) + manual override**
  (`soft`/`cut` buttons become an override over a default `auto` that reads
  `sdf.blendMode`); the override is visibly an override.
- **Corpus/manifest → 0.2.1:** `seed-forms.json` regenerated from the new
  decoder (gain `blendMode` per reading); `models.json` content-stamped
  (sha256 + sizes + `trainingSource` + the per-anchor hardness convention in
  provenance). **Denoiser artifact untouched** (same sha as 0.2.0).

## 4. Interfaces

- Public: `SdfParams.blendMode: BlendMode` (new); `getSolidMesh(sdf, mode?)`
  default-from-sdf; lab control "blend: auto/soft/cut".
- Internal: `DecoderRaw.hardness` + `decodeRawToSdfParams` + `Decoder.decode`
  output-name map (index shift across `ONNX outputs`); `sdfKey` unchanged
  (mode already in the cache key); `scripts/train_generator.py` exports the
  new head and mirrors decode; `scripts/verify_voices.py` (determinism mirror)
  extended to include blendMode.

## 5. Data model

- `models.json` → `0.2.1`: decoder entry (new sha/size), corpus entry
  (regen), provenance gains hardness-convention + sat-variance description.
- `seed-forms.json`: each `sdfParams` gains `blendMode`.
- RunRecord: `sdfParams` carries `blendMode` automatically (no schema change).

## 6. Constraints & env

- Pinned Python env (`.venv`, Python 3.12, `requirements.txt`) · free CPU
  budget (~15 min, Slice-2 baseline) · exports int8 ONNX · total model budget
  ≤ 120 MB (CR-5).
- The conditioning interface is NOT touched (denoiser untouched ⇒ `cond_dim`
  401 stays); only the DECODER output width changes ⇒ manifest bump, no silent
  ABI edit.
- Privacy: nothing new leaves the browser (structure/channels already on-device).

## 7. Definition of done

- Decoder retrained + exported; corpus regenerated; manifest `0.2.1` with
  verified sha/sizes; denoiser sha unchanged from 0.2.0.
- All acceptance tests §2 pass (unit + e2e incl. lab auto/override + determinism
  mirror); `ci-checks`, typecheck, lint, build, e2e green.
- Saturation variance: unit on regenerated seed-forms shows sat spread clearly
  wider than the 0.448–0.524 of 0.2.0, all inside the pastel field (measured
  0.2.1: 0.143–0.710, spread 0.567 — a field, not a uniform; soft bias kept).
- Blob off-forms: same readings render without the ripple-dominant blob at
  target level (compare 0.2.0 vs 0.2.1 decoded displacement stats).
- No open objections; palette Round VI amendments 2–3 either folded in or
  explicitly deferred with a reason; Render Reviewer has verified the cut path
  meshes (64³/no-smooth) in at least one no-WebGL context.

## 8. Out of scope / already shipped

- **Shipped:** pure-solids render half + render-code wiring + decoder-v2 retrain
  + corpus regen + manifest 0.2.1 — this slice is BUILT (gate green incl. e2e
  through the shipped model). Denoiser reused untouched (sha == 0.2.0).
- Palette amendments 2 (cap hue wrap / document rule) and 3 (show the
  convention in marginalia) are UI copy + small math — RECOMMENDED next slice,
  explicitly separable; Amendment 1 (sat variance) is DONE inside the field.
- Mapper/crowd (Phase D), register toggle UI, consensus-distance: unchanged
  exclusions from the Phase C spec.

---

## 9. Consensus record (recorded 2026-08-31; human ruling in Round VI)

| Agent | Verdict | Amendments |
|---|---|---|
| Concept (Curator) | **approve** | Condition carried in §3 verbatim: blendMode is arbitrary-per-anchor, never presented as meaning. Palette ruling follows Round VI (PASTEL — variance inside the field). |
| Requirements (Translator) | **approve** | Acceptance tests trace FR-7/FR-8/QR-4/QR-6/CR-5; manifest 0.2.1 bump is the explicit ABI change; determinism ≤1e-6 mirrored (LR-9). |
| Tech (Builder) | **approve** | Feasible-free (CPU retrain, denoiser reused untouched); budget ≤ 120 MB holds (23.5 MB); no new always-on path. |
| Reflector (Memory) | **approve** | Round VI closed: palette variance is a *mutation* owned by the human ruling; blend-as-decoded is a convention, not a meaning — the original's "reduction of a reduction" holds. |
| Render Reviewer (Projectionist) | **approve** | Cut mesh 64³/no-Laplacian verified in chromium e2e (lab + real-run); no new contexts; context lifecycle unchanged. |

**Human ruling (input to Stage 2):** vivid vs pastel → **pastel**. Saturation
remains a register property; variance shipped INSIDE the field (sat spread
0.567 measured on the regenerated corpus).

> The per-anchor hardness convention is written into §3 above verbatim
> ("arbitrary, never semantic") — it is the Concept guardrail for this slice.