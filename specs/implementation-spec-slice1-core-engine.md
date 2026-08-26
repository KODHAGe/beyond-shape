# Implementation Spec — Slice 1 · Core Engine: on-device interpretation → generation → render (minimal vertical slice)

**Status:** consensus-approved (rev 1.2, after two cross-review rounds) · **Owner:** Tech Agent · **Date:** 2026-08-26

> **Provenance.** Drafted by the Tech Agent (Stage 0). Cross-reviewed by the
> Concept Agent and Requirements Agent (Stage 1). Rev 1.1 folded in A1–A7/R1–R10;
> rev 1.2 folds in AMEND-1…4 and residuals R-a…f. Each is logged in §9 with its
> resolution. Re-verified against *this file*, not a summary.

---

## 1. Scope

A visitor types free text; the device interprets it (continuous embedding + a
v0 sensory-feature stub), generates a form in a continuous SDF shape space via
a small on-device latent diffusion (drift knob included), and renders it with a
designed light/palette grammar — all locally, no server compute, no text leaving
the device. A cold-start consensus backdrop stages "whose crowd is this reading
nearest" so the encounter includes the machine's reading as **one reader among
many**, never as an answer.

Requirements satisfied **verbatim** — functional: FR-1, FR-2, FR-3, FR-5, FR-6,
FR-7, FR-8, FR-9, FR-10, FR-11; quality: QR-1, QR-3, QR-6, QR-4 minimal stand-in,
**QR-2 partial** (renderer fallback bound in this slice; the smaller-model
variant is deferred to Slice 4, §8); constraints: CR-1…CR-6, CR-7 partial.
Everything else is explicitly deferred (§8).

---

## 2. Requirement trace

| Requirement | Acceptance test | ADR |
|---|---|---|
| **FR-1** (no fixed taxonomy) | Unit+E2E: ≥6 diverse prompts (poetic line, ordinary sentence, fragment, punctuation-free run-on, nonsense string, one non-English sentence the embedder handles) all produce a run; lint/grep assert **no categorical label table exists** in `src/core/`; UI has **no emotion selector**. | ADR-5 |
| **FR-2** (continuous point, not buckets) | Unit: `e` float32 exactly 384-d; cos-sim "a quiet morning" vs "a quiet morning in the garden" > 0.85; vs "a deafening metal concert" < 0.5. No classifier/logits layer anywhere in the pipeline. | ADR-5 |
| **FR-3** (sensory channel conditions generation) | (a) Unit: `q ∈ R^16`, finite, in [0,1]; ≥ 6 of 16 channels vary > 0.1 across the FR-1 prompt set (stub not constant). (b) **Conditionality test:** hold `e` fixed, force one sensory channel to its max vs min (tool-only hook), assert generated `z` differs by ≥ 1e-3 — generation is *measurably* conditioned on the sensory vector, not decorative. | — |
| **FR-5** (text never leaves device) | Playwright network-audit during a full run: intercept every request; (a) no request body/URL contains **any whole word from the prompt** (whole-word matching only — see §3.2 R-f; never substring, to avoid asset-path false positives); (b) the only outbound calls are same-origin static/model assets and `GET /api/status`. Re-run on the deployed preview. | — |
| **FR-6** (report the machine's reading) | After any run, the **marginalia panel** shows: the constellation of cold-start seed centres, the current reading's position within it ("whose crowd is this nearest"), the nearest seed's text + centre form, and `cos-e`/`cos-z` distances — populated with zero network beyond same-origin assets. | — |
| **FR-7** (continuous shape space) | Unit: decode canonical sphere-anchored `zA` and box-anchored `zB` (anchor latents defined in `scripts/train_generator.py` as one-hot primitive anchors); midpoint `(zA+zB)/2` decodes to weights with **max single weight in [0.5, 0.75]** (true blend, not near-one-hot); mid mesh differs from both endpoints (bounded-volume occupancy > 0). Manual smoke: a real run can produce visibly "between" forms. | ADR-4 |
| **FR-8** (drift knob = consensus↔edge) | Unit: drift 0.0 → `η=0`, seeds 1 and 99 → **identical** z (deterministic centre); drift 1.0, seeds 1 vs 2 → different z; drift 0.4, seeds 1 vs 2 → different z (drift is seed-respecting at all levels). UI: 0..1 drift slider present (default **0.4**), re-samples on change. NB: at d=0 the initial latent is the fixed canonical point (seed-independent — see §3.3 "Canonical d=0"). | ADR-4 |
| **FR-9** (show a distribution) | E2E at **drift = 0.4 (the UI default)**: a run renders a primary form + ≥ 3 alternates (seeds s…s+3); ≥ 2 of the 4 z's differ (|zi−zj| > 1e-4); re-running identical params reproduces the identical full distribution. (At d=0 alternates coincide by construction, so the test is run at ≥ 0.4.) | ADR-4 |
| **FR-10** (deterministic-reproducible) | Unit+reload: run (text, drift=0.5, seed=42) twice → z max-abs-diff ≤ 1e-6, same SdfParams, same fingerprint; repeat after full page reload. Lint: no `Math.random()`/unseeded entropy in `src/core/{generator,sdfParams,seededRng}.ts`. | ADR-4 |
| **FR-11** (difference surfaced, not smoothed) | E2E with a deliberately original prompt: marginalia panel simultaneously renders the nearest centre form and the generated form, plus a **marginal note** ("a stranger reads this closer to X; your form leans Y") when `cos-e` > 0.35. The note must not be suppressible. | — |
| **QR-1** (seconds to a meaningful encounter) | Playwright 4× CPU-throttle, mid-range profile: placeholder ≤ 1 s before models warm; tokenize+embed ≤ 500 ms; 1 sample ≤ 900 ms; first form ≤ 2 s post-type. | — |
| **QR-2** (graceful degradation) | E2E with WebGL2 absent: app detects, uses Canvas-2D preview renderer, run completes showing a form preview; peak heap < 1.5 GB in headless run. | — |
| **QR-3** (privacy by architecture) | Same audit as FR-5; plus code review: **no `fetch` in `src/core/` inference modules**. | — |
| **QR-6** (same input+drift+seed = same form) | Same determinism test as FR-10 executed after reload; SHA-256 fingerprint shown in UI and equal across reloads (state derives only from inputs + seeded hash, never session). | ADR-4 |
| **QR-4 minimal** (designed lighting, not defaults) | Visual+code: scene uses the bound lighting grammar (key/fill/rim) **plus a non-vacuous edge policy** — at least one per composition of {a genuine shadow-casting key (soft ≠ absent), a saturated accent outside the pastel bias range, or withheld bloom}; palette is a *bias, not a clamp*; ACES + sRGB. No scene may fall back to lone ambient+point. | — |
| **CR-1** (web output) | Build produces pure static `dist/`; `vite preview` + Playwright completes a run; no native/server-required path. | — |
| **CR-2** (near-zero budget) | CI cost audit: Pages free + GitHub Actions free + on-device inference = $0 recurring; no paid service in deploy config. | — |
| **CR-3** (no microservices) | Repo has exactly one SPA + one thin `functions/api/status.ts`; lint/grep forbids other server scaffolding (no express/http-server deps); SPA never requires the function. | — |
| **CR-4** (Cloudflare-first) | CI runs `wrangler` Pages deploy on every merged PR; `wrangler.toml` present; preview deploys green. | — |
| **CR-5** (open weights, no client keys) | All artifacts ONNX int8 under `/public/models/`, referenced via `models.json`; grep: no `api[_-]?key` constant in `src/`; `public/models/LICENSES/` ships Apache-2.0 + provenance. | ADR-5 |
| **CR-6** (on-device; thin monolith only) | Inference runs via ONNX Runtime Web in the browser; the stub function body is fixed JSON and imports no model code (CI assertion). | — |
| **CR-7 partial** (local training script) | `scripts/train_generator.py` runs on CPU from clean checkout in ≤ ~15 min and reproduces generator artifacts + manifest so that the FR-8/FR-10 tests pass against its output. Scheduled weekly automation: out of scope (§8). | ADR-4 |

---

## 3. Technical decisions (bindings)

### 3.1 Framework & deployment
- **Vite + TypeScript (strict) SPA**; Node 20 LTS; single `index.html → src/main.ts`; no framework dependency in this slice. Deploy: **Cloudflare Pages** (`wrangler pages deploy dist`), free tier.
- One thin edge function: Pages Function `functions/api/status.ts` → `200 { ok: true, slice: 1, status: "stub" }`. No DB, no inference, fixed body (CR-3/CR-6).
- Load order (QR-1): app shell → low-fi placeholder → renderer → embedder → generator; non-blocking warm-up with a visible progress surface; user can type while models load.
- CI (GitHub Actions): lint → vitest → Playwright smoke + privacy audit + perf budget → build → CF Pages preview deploy.

### 3.2 Interpretation (on-device) — sensory-feature vector, not a taxonomy
- Runtime: **ONNX Runtime Web**; `executionProviders: ['webgpu','wasm']`; int8 graph optimization; lazy sessions.
- Embedder: **all-MiniLM-L6-v2** int8 (`embedder-all-minilm-l6-v2-int8.onnx`, ~23 MB) → 384-d; WordPiece tokenizer, max 256 tokens (truncate w/ warning); embedding = L2-normalised mean-pooled last hidden state → `e ∈ R^384`.
- **Sensory feature head (v0 stub):** `sensory-v0-int8.onnx` linear 384 → 16 → clamped [0,1]. **Naming is data, not code:** the 16 channel *names* live in `models.json` (mutable per manifest version, re-composed by the community in later slices), **not** hard-coded. v0 provisional names (per TD §3.3 path 2's seed channels): light, warmth, motion, weight, texture, soft, hard, metal, fluid, time-of-day, scale, moisture, rhythm, colour-temperature, colour-saturation, air. The UI labels them visibly provisional — *"our words for this, for now."* The stub **performs its stubness**: it is explicitly a stand-in for trained probes (Slice 2), with the community reinvention path tied to the FR-16 gradient loop. **Terminology note:** this vector is a *sensory conditioning vector*, not "qualia"; the machine has features, not felt experience. (Cross-doc rename of "qualia" in REDESIGN/TECHNICAL-DESIGN recorded as pending doc-pass, owned by Requirements Agent.) **Provenance (AMEND-4):** the v0 stub is a linear head derived offline on the 8 seed forms with provisional channel scores; `sensory-v0-int8.onnx` is regenerated by `scripts/train_generator.py` alongside the generator, asserted by FR-3(a) + reproducibility. **R-a note:** v0 `q` is informationally contained in `e` — true "addition" over semantics is owned by Slice 2 trained probes; record this in the trace so the FR-3(b) test reads as a wiring/sensitivity check, not a novelty proof.
- **No `fetch` in `src/core/` inference modules** (FR-5/QR-3/CR-6). Sole exception: `src/core/models.ts` (same-origin manifest fetch — named here so the lint rule is enforceable). Privacy audits match **whole words only, never substrings** (avoids false positives on asset paths; see FR-5 test). Text lives in memory / sessionStorage only.

### 3.3 Generation (SDF latent diffusion)
- Latent `z ∈ R^64`; conditioning `c = concat(e, q) ∈ R^400` → 2×256 Swish+LayerNorm → `c_emb ∈ R^128`; MLP denoiser `εθ(z_t, t, c_emb)` (sinusoidal time embed 32-d; hidden 256,256; out 64; **≤ 3 M params** → `denoiser-v1-int8.onnx` ~2–4 MB).
- Training in `scripts/train_generator.py`: DDPM, cosine β, T=1000, MSE on ε, Adam lr 1e-3, batch 64, ~3000 steps, CPU-capable. Dataset = cold-start seed corpus (§3.5): per-seed Gaussian clouds around each `zCenter` + linear interpolations between centres (engineers FR-7's "between" reachability).
- Sampling: 25 DDIM steps. **Drift binding (FR-8):** drift `d∈[0,1]` maps linearly to DDIM stochasticity `η = d` — d=0 → deterministic near-argmax (**community centre**, seed-independent); d=1 → full ancestral (**hallucinated edge**, seed-sensitive).
- **Seed discipline (FR-9/FR-10):** user-visible integer seed; PRNG = `xoshiro256**` seeded by `SHA-256(text::drift::seed)`; *all* noise draws from this PRNG; sampling+decode run CPU float32 for cross-browser reproducibility ≤ 1e-6. Alternates = seeds s, s+1, s+2, s+3. No `Math.random()` in sampling/decode. **Canonical d=0 (AMEND-1):** at η=0 the initial latent is a fixed **canonical point** (seed-independent — the community centre); the seeded PRNG enters only through step-noise (zero at η=0) and through multi-seed alternates at d>0. **UI default drift = 0.4** (AMEND-3: the FR-9 living distribution is the default encounter; the centre is reached by pulling the knob to 0, not by default).
- **Decode:** `decoder-v1-int8.onnx` (64 → SdfParams) → smooth-min blend weights `w∈R^8` over the **8-primitive SDF library** (sphere, box, roundedBox, cylinder, cone, torus, capsule, blob) + per-part params. Continuous shape space (FR-7): primitives are vertices, not the space.

### 3.4 Rendering (WebGL2 load-bearing; WebGPU later)
- **Three.js, WebGL2** path; `ACESFilmicToneMapping`, `SRGBColorSpace`, `PCFSoftShadowMap`. WebGPU backend = later enhancement.
- Mesh: blended SDF sampled on a **48³ grid** over `[-1.5,1.5]³`, **in-repo marching cubes** (`src/render/marchingCubes.ts`, ≤ ~40 k tris), 1 Laplacian smoothing pass, `computeVertexNormals`, vertex merge. Raymarching deferred.
- Material: MeshPhysicalMaterial; palette from SdfParams biased to pastel (sat 0.1–0.7, light 0.5–0.95) per C7.
- **Lighting grammar + edge policy (QR-4 minimal):** warm key (~2.5, `#FFF3E0`), cool soft fill — HemisphereLight pastel sky `#FFE8F0`/warm ground `#FFF4E0` (~0.5), cool rim (~1.5, `#CFE8FF`); procedural PMREM env; **edge policy — non-vacuous, at least one per composition of {a genuine shadow-casting key (soft ≠ absent), a saturated accent outside the pastel bias range, or withheld bloom}** (pastel is a field, not a filter). Gradient pastel background. The pastel palette is a **bias, never a clamp** — the sat/light bounds are targets, not hard limits.
- Determinism: default view seed-derived camera/fixed orbit; idle animation opt-in, default off (FR-10). UI drift slider default **0.4** (AMEND-3).
- **QR-2 fallback:** if WebGL2 absent → Canvas-2D preview renderer (2D shaded/pastel projection of decoded SdfParams); parameter pipeline untouched. Budget: ≥ 30 fps @ 1080p mid-range phone (WebGL2).

### 3.5 Cold-start consensus backdrop (FR-6/FR-11)
- Bundled static asset **`public/seed-forms.json`** — 8 **machine-generated** seed forms for 8 arbitrary, unlabelled seed texts (***not*** eight named emotions — this is a consensus seed, not a cage; labels if any read "first arbitrary names offered to the language"): `"the sea is calm tonight"`, `"a small yellow bird"`, `"cold rain on tin roofs"`, `"a house with colored windows"`, `"we are all made of light"`, `"heavy gray afternoon"`, `"sugar and spice and everything nice"`, `"the silence after music"`. Each: `{id, text, e[384], zCenter[64], sdfParams}`.
- **Marginalia panel (replaces "consensus panel"):** shows the **constellation** of all 8 centres + the current reading's position — *"whose crowd is this reading nearest"* — never "the answer." Nearest seed = relative positioning only; the centre is the most *understood* sign, not the true one; distribution is the default view, the centre is reached via the drift control (C1/C2/NG1). When `cos-e > 0.35`, emit the FR-11 marginal note. Also serves as the training dataset for §3.3.

### 3.6 Model artifacts & budget
- Under `/public/models/`, referenced via **`models.json`** (boot fetch, revalidated per load). Manifest carries `version`, `slice`, `generatedAt`, `totalBytes`, `artifacts{embedder, tokenizer, sensory, denoiser, decoder, aligner}` — **aligner: null placeholder** (Slice 2) so DR-5's registry shape is stable now; sha256 + sizeBytes per artifact; **rollback-by-pointer = swap the manifest JSON** (full release history: Slice 2). Manifest also carries **`trainingSource`** (seed-forms count + generatedAt) so DR-4 drift-provenance is traceable now, not only in Slice 2 (R-c).
- Budget: Σ `/public/models/*.onnx` ≤ 120 MB int8 (actual ≈ 35 MB); CI enforces. Latency budget as in QR-1 (embed ≤ 500 ms; q ≤ 10 ms; 1 sample ≤ 900 ms; 3 alternates ≤ 2.5 s; warm ≤ 4 s CDN-cached).
- `LICENSES/` ships Apache-2.0 (all-MiniLM-L6-v2) + provenance.

### ADRs
- **ADR-4 — Generation = SDF-blended latent diffusion, not mesh-native diffusion.** Accepted. Rationale: mesh-native text-to-3D diffusion (Shap-E-class) is outside the on-device size/µs budget; SDF blending makes "between box and sphere" reachable and renders the mean/mode critique moot. Named cost: shape vocabulary bounded by 8-primitive library + blend topology (a convention, extensible); raw-latent inspectability lost (mitigated by SdfParams view; affordance-vector UI later, TD §4.5).
- **ADR-5 — On-device embedder: all-MiniLM-L6-v2 int8.** Accepted. 384-d, Apache-2.0, ~23 MB int8, ONNX Runtime Web. Named cost: new imported authority from a pretrained model (REDESIGN §5) — mitigated by the community aligner (Slice 2) and by model swap via manifest pointer. English-centric support acknowledged (REQUIREMENTS §9).

---

## 4. Interfaces

Public: route `GET /` (SPA); route `GET /api/status` (stub function).

Types (`src/types.ts`):

```ts
type RunId = string;                              // uuid v4
interface RunRecord {
  id: RunId; inputText: string;
  e: Float32Array;                                // 384
  q: Float32Array;                                // 16, [0,1]  (sensory conditioning vector)
  z: Float32Array;                                // 64 primary
  zAlternates: Float32Array[];                    // 3 more (FR-9)
  sdfParams: SdfParams; renderState: RenderStateWire;
  drift: number;                                  // 0..1
  seed: number;                                   // integer
  fingerprint: string;                            // sha256(text|drift|seed)
  createdAt: number; webgl: boolean;              // true = Three.js path, false = Canvas-2D fallback
}
interface SdfParams {
  weights: number[];                              // 8 softmax smooth-min weights
  blendRadius: number;                            // 0.05..0.5
  parts: { scale:[n,n,n]; offset:[n,n,n]; twist:number; displacement:number }[]; // len 8
  material: { hue:number; saturation:number; lightness:number;
              roughness:number; metalness:number; clearcoat:number; emissive:number };
  motion: { breathe:number; sway:number };        // 0..1, only when animation toggled on
  pose: { yaw:number; pitch:number; roll:number };
}
interface RenderStateWire { camera:{pos:[n,n,n]; target:[n,n,n]}; palette:{background:string; key:string; fill:string; rim:string}; }
interface ModelManifest { version:string; slice:number; generatedAt:string; totalBytes:number;
  artifacts: { embedder:ManifestEntry; tokenizer:ManifestEntry; sensory:ManifestEntry;
               denoiser:ManifestEntry; decoder:ManifestEntry; aligner:ManifestEntry|null };
  sensoryChannels: { name:string }[];             // NAMES IN DATA, not code (FR-3/C1)
  trainingSource?: { seedForms: number; generatedAt: string };  // DR-4 provenance (R-c)
  licenses: string[]; }
interface ManifestEntry { file:string; sha256:string; sizeBytes:number; dim?:number; steps?:number; maxTokens?:number; }
interface SeedForm { id:string; text:string; e:number[]; zCenter:number[]; sdfParams:SdfParams; }
interface MarginalityNote { seed:SeedForm; cosE:number; cosZ:number; differs:boolean; note:string; }
```

Internal modules:

```
src/main.ts                    bootstrap + load order
src/core/seededRng.ts          xoshiro256** + sha256 seed derivation
src/core/models.ts             manifest fetch/parse, lazy sessions, budget check
src/core/embedding.ts          tokenize@256 → embed → mean-pool → L2-norm → e
src/core/sensory.ts            sensory-v0 head → q ∈ [0,1]^16
src/core/generator.ts          conditioning MLP + 25-step DDIM sampler, η = drift (seeded)
src/core/sdfParams.ts          decoder → SdfParams; validation/clamping
src/core/sdfField.ts           blended SDF field on 48³ grid
src/render/marchingCubes.ts    48³ field → BufferGeometry (≤ 40k tris)
src/render/scene.ts            Three.js scene, ACES/sRGB, seed-derived camera
src/render/lighting.ts         key/fill/rim grammar + edge policy + pastel presets
src/render/renderer.ts         WebGL2 vs Canvas-2D fallback selection
src/state/runStore.ts          in-memory runs + sessionStorage `bs:lastRun`
src/ui/app.ts                  input, drift slider (0..1), seed control, Run
src/ui/alternatesStrip.ts      FR-9 distribution row
src/ui/marginaliaPanel.ts      FR-6/FR-11 "whose crowd is this nearest" + marginal note
src/ui/progress.ts             QR-1 warm-up surface
functions/api/status.ts        stub (fixed JSON; no imports from src/core)
scripts/train_generator.py     CR-7 partial: seeds → DDPM → export int8 ONNX + models.json
public/models/                 artifacts + LICENSES/
public/seed-forms.json         cold-start corpus
```

**Plain-reader rule (Concept A7):** every visitor-facing UI string must survive "can this be said more plainly?" Engineering terms stay in trace/ADR only. Examples bound now: the knob is called *"how close to the crowd?"* (drift), the panel is titled *"a stranger's reading"* (marginalia), seed is *"same sentence, same seed — same form."*

---

## 5. Data model

**Live data = in-browser `RunRecord` only** (local-first, CR-6); latest run mirrored to `sessionStorage["bs:lastRun"]`. No server persistence this slice.

**Placeholder Cloudflare/D1 schema — NOTE ONLY, NOT PROVISIONED (Slice 2 owns creation):**
```sql
-- corpus (DR-1, DR-3: append-only — no UPDATE/DELETE allowed by table design; writes consent-gated, DR-2)
-- id TEXT PK, seed_id TEXT, text_sha256 TEXT, sdf_params_json TEXT, consent_flag INT,
-- gradient TEXT (accept/adjust/reject), contributor_anon_id TEXT, model_version TEXT,
-- drift REAL, created_at TEXT
```

**Static data:** `models.json` (ModelManifest incl. `sensoryChannels` names + `aligner:null` + `trainingSource`); `seed-forms.json` (8 arbitrary seed forms). Both regenerable by the training script; version-controlled. Note (R-d): corpus rows store `text_sha256` only, never raw text — privacy-positive, but raw-text re-readability for the FR-23 consensus view is owned by Slice 2 and flagged there.

---

## 6. Constraints & env

| Item | Binding |
|---|---|
| Static host | Cloudflare Pages project `beyond-shape`, `dist/`, Vite preset, free tier |
| Edge | Pages Function `functions/api/status.ts`; zero inference/auth/DB |
| Managed store | Not provisioned in this slice (schema note only, §5) |
| Secrets | None — no client-side API keys (CR-5) |
| Env | Node 20 LTS, npm, CI = GitHub Actions (free) |
| Manifest | `models.json` fetched at boot, revalidated per load; assets immutable + content-hashed |
| Budget (CI) | Σ onnx ≤ 120 MB int8; **$0 recurring**; no always-on/GPU/paid path |

---

## 7. Definition of done

- All §2 acceptance tests pass in CI on every PR.
- End-to-end determinism verified across reloads (same text/drift/seed → same z ≤ 1e-6, same form, same fingerprint).
- Runs on WebGL2 (Three.js/PBR) AND completes on the Canvas-2D fallback.
- Zero outbound requests carry prompt text (audited on deployed preview).
- `scripts/train_generator.py` reproduces artifacts + manifest (incl. `sensory-v0-int8.onnx` and `seed-forms.json` provenance) from clean checkout in ≤ ~15 min CPU, passing FR-8/FR-10 tests (AMEND-4).
- ADR-4, ADR-5 recorded in-spec **and mirrored to `adr/ADR-0004-sdf-blended-latent.md` / `adr/ADR-0005-embedder-minilm.md`** (R-e); trace table complete; cost = $0 recurring; ≤ 120 MB payload.
- No open objections (see §9).

---

## 8. Out of scope (explicit)

| Deferred | Owner |
|---|---|
| FR-4 (VAD labels — interface/steering only) | Slice 3 |
| FR-12 totem, FR-13 strip/montage, FR-14 gallery, FR-15 encounter history | Slice 3 |
| FR-16…FR-21 collection/corpus loop (co-creation, consent UX, live consensus, edge-keeping) + real D1 tables + edge write path + DR-1…DR-5 full registry (incl. aligner, release history) | Slice 2 |
| FR-22/FR-23 sharing (cards, "state of the consensus") | Slice 3 |
| QR-4 **full** aesthetic grammar (only minimal key/fill/rim + edge policy in scope) | Slice 4 |
| QR-2 **smaller-model variant** (device probe → tiny embedder/generator selected in `src/core/models.ts`) — the Canvas-2D renderer fallback IS in scope | Slice 4 |
| QR-5 legibility-of-reasoning views | Slice 3 |
| QR-7 exportability; QR-8 offline/PWA; QR-9 accessibility floor | Slice 4 |
| WebGPU backend, SDF raymarching | Slice 4 |
| CR-7 remainder — weekly automated training, drift release notes, scheduled pipeline | Slice 2 |
| Trained sensory-feature probes (replacing v0 stub) | Slice 2 |
| Cross-doc "qualia"→"sensory conditioning vector" rename (REDESIGN §3.1, TD §3.3) | Requirements Agent, next doc pass |

---

## 9. Consensus amendments — resolved

| # | Source | Amendment | Resolution |
|---|---|---|---|
| A1 | Concept | Stub must perform its stubness: channel names in data, community-owned, provisional labels | §3.2/§4: names in `models.json`, "our words for this, for now", reinvention via FR-16 loop |
| A2 | Concept | Rename "qualia" — machine has features, not felt experience | Spec uses "sensory conditioning vector"; cross-doc rename deferred to doc pass (§8) |
| A3 | Concept | Drift & difference must be one gesture; machine's reading as marginalia, not score widget | §3.5 marginalia panel; knob & note are two views of one control; FR-11 note non-suppressible |
| A4 | Concept | Seeds must NOT be 8 named emotions (escalation: would be OBJECT) | §3.5: seeds are arbitrary unlabelled text samples; "first arbitrary names offered to the language" |
| A5 | Concept | Nearest seed = relative positioning, distribution default, edges visible | §3.5: constellation view, "whose crowd is this nearest"; centre reachable only via drift |
| A6 | Concept | Edge policy — pastel is a field, not a filter | §3.4 lighting: ≥1 of {hard shadow, saturated accent, withheld bloom}; QR-4 test |
| A7 | Concept | Plain-reader test for UI strings | §4 plain-reader rule + bound example labels |
| R1 | Requirements | FR-3 conditionality: sensory channel must measurably condition generation | §2 FR-3 (b) conditionality test; q wired into conditioning c |
| R2 | Requirements | FR-2 continuity vs FR-4 label guard distinct | §2: FR-2 no-logits test; FR-4 explicitly deferred (never conditioning) |
| R3 | Requirements | Local-by-default wired (network-blocked path still completes) | FR-5/QR-3 audits on preview; no-fetch rule in src/core |
| R4 | Requirements | FR-8/9/10 seed discipline explicit | §3.3 seed discipline; FR-8 includes drift 0.4 seed-dependence; FR-9 alternates s..s+3; FR-10 reload determinism |
| R5 | Requirements | FR-7 must be rendered, not declared | §2 FR-7 midpoint-decode + mesh-differs tests |
| R6 | Requirements | QR-1 needs numbers | §2 QR-1 budgets (≤1s placeholder, ≤500 ms embed, ≤900 ms sample, ≤2 s first form) |
| R7 | Requirements | QR-2 fallback first-class | §3.4 Canvas-2D fallback bound + §2 QR-2 test |
| R8 | Requirements | FR-6 bound explicitly (vertical-slice promise intact) | §2 FR-6 marginalia test; §8 lists what's deferred |
| R9 | Requirements | Placeholder schema must not contradict DR-1…DR-5 | §5 append-only + consent-gated D1 note; manifest incl. `aligner:null`; rollback-by-pointer |
| R10 | Requirements | CR-7: manifest + rollback mechanism must be in scope | §3.6 manifest + pointer swap binding; weekly automation deferred |
| AMEND-1 | Requirements | d=0 seed-independence vs "all noise draws from this PRNG" collide | §3.3 "Canonical d=0": fixed canonical initial latent (seed-independent); PRNG enters only via step-noise + d>0 alternates; FR-8 test |
| AMEND-2 | Requirements | QR-2 "smaller model variant" neither bound nor deferred | QR-2 declared **partial** in §1; renderer fallback in scope; smaller-model variant deferred to Slice 4 (§8) |
| AMEND-3 | Requirements | FR-9 under-parameterized on drift; UI default drift unbound | §2 FR-9 test at drift ≥ 0.4 (UI default); default drift bound to 0.4 in §3.3/§3.4 |
| AMEND-4 | Requirements | provenance of `sensory-v0` + `seed-forms.json` unbound (dev can't satisfy without inventing) | §3.2 provenance: linear head derived on the 8 seed forms, regenerated by `scripts/train_generator.py`; asserted by FR-3(a) + reproducibility |
| R-a | Requirements (note) | v0 q informationally contained in e | §3.2 R-a note; "addition" owned by Slice 2 trained probes |
| R-b | Requirements (note) | FR-7 anchors & blend bound | §2 FR-7: canonical anchor latents; max weight in [0.5, 0.75] |
| R-c | Requirements (note) | DR-4 provenance field | §3.6 + §4 `trainingSource` in ModelManifest |
| R-d | Requirements (note) | text_sha256 vs raw-text re-read | §5 note; FR-23 re-read owned by Slice 2 |
| R-e | Requirements (note) | ADRs file-backed | §7 DoD: mirror to `adr/` files |
| R-f | Requirements (note) | models.ts fetch exemption + word granularity | §3.2 exception named; whole-word-only audits |
| C-note | Concept (note) | "the machine dreams in color" brushes no-faked-experience | §3.5 seed swapped to "a house with colored windows" |
| S2-a | Requirements (note → Slice 2) | `fingerprint = sha256(text\|drift\|seed)` becomes model-release-dependent once weekly drift lands | Add `modelVersion` to `RunRecord` (DR-1 already requires it) and scope the "same sentence, same seed" tagline per model release — carry to Slice 2 |
| S2-b | Requirements (note → Slice 2+) | FR-2 cosine thresholds (>0.85 / <0.5) were validated against all-MiniLM-L6-v2 | Record validating model version in the trace; re-validate thresholds on any embedder swap via manifest pointer — carry to Slice 2+ |

---

*Dev-agent reminder (AGENTS.md §5): implement only what is bound above; on any contradiction with reality (an API that doesn't exist, a model overrunning budget), file a spec defect — never deviate silently.*