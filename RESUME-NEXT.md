# Resume point — decided plan, 2026-08-31

> Status: **decided by the user** · resume trigger: "access back"
> ⏵ **PROGRESS 2026-08-31:** item 2 render half SHIPPED; palette evaluation
> (item 3) recorded → **human ruling: PASTEL**; item-1 FULLY SHIPPED incl. the
> decoder retrain (decoder-v2, manifest **0.2.1-generated**, denoiser untouched)
> — sat spread 0.567, blend 14 cut/5 soft, blob ripple tamed, voices intact.
> Origin pushed to `2f50001` + pending commit. Remaining: consensus record §9
> on the item-1 spec (formality — decision + result recorded in Round VI).
> This is a *decision/resume record*, not an implementation spec. Per
> AGENTS.md §4/§5, the slices below must pass the consensus loop and be
> converted into an Implementation Spec at resume before dev agents build.

## Where we stopped (verified 2026-08-31, all green)

| Check | Result |
|---|---|
| HEAD | `83195a0` — Aesthetic fork: per-part colours + soft-morph ⇄ hard-cut blend modes |
| Gates | `tsc --noEmit` clean · 86/86 vitest passing · lint/build pending at resume |
| Working tree | clean |
| Origin | reachable; `main` is **7 commits behind** local (not pushed) |
| Manifest | `public/models/models.json` = `0.2.0-generated` (Slice 2, `c431760`) |
| Python env | `.venv` intact — Py 3.12.14, torch 2.13.0, onnx 1.22.0, numpy 2.5.2 |

What shipped today (before the interruption): blend is a **render option**
(`soft` ⇄ `cut`) and a **lab toggle**; per-part colours live. It is *not yet a
decoded variable* — that is exactly plan item 1.

---

## The decided plan (verbatim intent + technical binding)

### 1. Blend as a decoded variable

- Decoder gains a **hardness/blendMode output**. The latent→mode mapping is an
  **arbitrary per-anchor convention, never semantic** (Concept guardrail: the
  machine must never present blend as meaning). `SdfParams.blendMode`
  (`'soft' | 'cut'` — the type already lives in `src/core/sdfField.ts`).
- Renderers consume it per reading; lab gets **auto (decoded) + manual
  override** (current `src/lab/lab.ts` `let blend: BlendMode = 'soft'` plus the
  `#lab-blend` buttons become the override).
- **Decoder retrain + corpus regen; denoiser untouched.** Manifest →
  `0.2.1` (content-stamped sha256, provenance, `trainingSource` updated
  exactly as Slice 2 did for 0.2.0).

**Code ground (resume with these):**
- Decoder ONNX output contract: `src/core/sdfParams.ts` header + `DecoderRaw`
  (currently `weights[1,8] · blend_radius[1,1] · parts[1,64] · material[1,7]
  · motion[1,2] · pose[1,3]`) — add the hardness output and mirror it in
  `decodeRawToSdfParams` and `Decoder.decode` (index shift!).
- Training side: `scripts/train_generator.py` exports the decoder; the output
  list must match `sdfParams.ts` 1:1 (the corpus is generated from the SAME
  artifacts — "mirrored by scripts/train_generator.py export").
- Renderer consumers: `src/render/projection.ts getSolidMesh(sdf, mode='soft')`,
  `src/render/scene.ts` `Scene`/`CellScene` `opts.blend`, `src/core/sdfField.ts`
  `evaluateParts`/`evaluateSdf` `mode` param.
- App/lab: `src/lab/lab.ts`, plus `src/render/alternatesStrip` path for
  alternates inheriting the decoded mode.

### 2. Pure solids

- **Cut sampling → 64³, no Laplacian smoothing** → real creases where solids
  cut. Ground: cut currently marches at the shared 48³ grid
  (`src/core/sdfField.ts` `GRID_N = 48`) and always runs
  `laplacianSmooth(…, 1)` in `src/render/projection.ts` (line ~87) — the
  smoothing pass rounds the creases away. Keep the smoothing for `soft` (the
  smooth-morph spec, FR-7); drop it for `cut`. Mind the winding guard/one-hot
  ownership in `evaluateParts` cut mode and the marching-cube cost at 64³ on
  mid-range phones (Render Reviewer lens).
- **Off-forms:** the **blob primitive's ripple displacement** is the main
  source (`src/core/sdfField.ts` `sdBlob(p, ripple)`, driven by the decoded
  `displacement` 0..0.5). Likely tamed **at the target level** (training
  targets / anchor conventions), *not* by clamping the display — resample
  target displacements for blob-dominant anchors and retrain the decoder
  (bundled with item 1's retrain).

### 3. The palette — full agent evaluation (centerpiece of the next step)

Your call: palette is the most affecting choice. Next step opens with the
complete agent evaluation **against the concept**:

- **vivid vs pastel-bias** (the register's pastel field, C7/QR-4 —
  `PASTEL_SAT_RANGE`/`PASTEL_LIGHT_RANGE` in `src/core/sdfParams.ts`,
  `satAmount` in `src/aesthetics/register.ts`);
- **arbitrariness of hue** (Concept lens: is a hue presented as meaning, or
  shown as arbitrary convention? the `partColor` scheme derives per-part
  hue/sat/light deterministically from the reading);
- **per-part spread** (variation budget — does the palette give parts
  *variance, edges, play*, or average to safety?).

Participants: Concept (verdicts), Reflector (against ORIGINAL-2019), with
Requirements/Tech on traceability and cost. Output: a written verdict pair +
recommendation, then the consensus loop folds its result either into item 1's
scale or a separate palette slice.

---

## Resume order (access-independent parts first)

1. **Palette evaluation (item 3)** — pure agent work on existing renders, no
   training, no render changes. **Centerpiece — STARTED 2026-08-31:** Round VI
   recorded in REFLECTOR-DIALOGUE.md (empirical 19-seed data; sat spread 0.076
   = "a uniform, not a field"). **One human decision pending:** does "vivid vs
   pastel" become a recorded decoded variable, or stay a register property?
2. **Pure solids cut path (item 2 render half)** — **SHIPPED 2026-08-31:**
   cut now marches 64³ with no Laplacian (real creases). `gridForMode`/
   `smoothingForMode` + structural & crease tests in `tests/projection.test.ts`:
   cut fold 1.074 rad vs soft weld 0.880 rad. typecheck · 89/89 unit · lint ·
   build · e2e chromium all green.
3. **Blend-as-decoded (item 1) + blob target taming + sat-variance (same
   retrain)** — spec DRAFTED `specs/implementation-spec-item1-blend-decoded.md`
   (manifest 0.2.1). **Render-code wiring SHIPPED 2026-08-31:** `SdfParams.blendMode`,
   hardness→mode decode (legacy→'soft'), renderers default from the decoded
   mode, lab **auto · decoded / manual override + readout** (e2e `lab.spec.ts`).
   Remaining: the **decoder retrain + corpus regen + manifest 0.2.1** (needs
   the training env — available in `.venv`, CPU ~15 min baseline from Slice 2)
   and the consensus loop (§9 pending).

## At resume, before building

- Consensus loop (AGENTS §4) on the item-1 spec → approve/amend before the
  decoder retrain (§9 table to be filled).
- Decision needed (still open): **vivid vs pastel as a decoded variable** —
  asked of the human at the Round VI review.
- Item 1's "arbitrary-per-anchor convention" is written into the spec §3 so
  blend mode is never presented as semantics.
- Palette amendments 2 (cap hue wrap / document) and 3 (show the convention in
  marginalia) fold into the item-1 slice unless the Concept lens objects.