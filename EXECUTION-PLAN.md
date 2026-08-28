# Beyond Shape — Execution Plan (proposed sequence)

> **Status:** IN FLIGHT — Phase A complete (Gate A closed, commit `6900b4e`); Phase B (real models) in progress (Python toolchain installing). Gates are reported as they close; human decisions (D-A…D-F) are flagged inline.
>
> Once approved, the orchestrator (me) executes phases in dependency order,
> using the agent pipeline in `AGENTS.md` — dev subagents build to the approved
> specs; the Concept / Requirements / Tech lenses review at gates.
>
> **Constraints carried into every phase:** Cloudflare-first (CR-4) · ≈$0
> operating cost (CR-2) · browser monolith, no microservices (CR-3) ·
> local-first testing as the baseline (LR-1…LR-10) · open weights, no client
> keys (CR-5) · consensus output of `REQUIREMENTS.md` is binding.

---

## The sequence at a glance

| # | Phase | What ships | Gate (definition-of-done) | Est. effort* | Depends on |
|---|---|---|---|---|---|
| **A** | **Harden the foundation (LR closure)** | Render override + tier projects (LR-6) · missing-model E2E (LR-3) · local privacy audit (LR-8) · pinned Python env (LR-9) | full local suite + CI green incl. new audits; deploy preview green | 3–4 d | — |
| **B** | **Real models (training milestone)** | all-MiniLM int8 embedder + tokenizer · sensory-v0 head · DDPM denoiser + decoder (ONNX int8) · real `seed-forms.json` + `models.json` v0.1.0 | text → real embedding → latent → form renders on WebGL2; determinism ≤1e-6; budget ≤120 MB | 4–6 d | A |
| **C** | **Real encounter (vertical slice live)** | form-quality pass on real outputs · marginalia with real consensus · full Playwright user-flow (type → form + alternates + marginal note) | a first run that is *evocative*, not just functional; screenshot-able demo | 2–3 d | B |
| **D** | **Collection — Slice 2** | D1 schema (`corpus`, `runs`) · consent UX + edge write path · co-creation loop (shape → accept/adjust/reject) · aligner (text↔form metric) · weekly drift pipeline | first consented community contributions; a weekly release note runs end-to-end | 5–8 d | B, C |
| **E** | **Context staging — Slice 3** | totem (per-sentence stack) · strip/montage (the cut) · gallery (re-contextualise) · VAD labels (interface only) · share cards + "state of the consensus" | sequence & context are first-class, controllable variables; shareable output | 4–6 d | C, D |
| **F** | **Polish & beauty — Slice 4** | full aesthetic grammar (light/colour/motion) · WebGPU backend + raymarching · PWA/offline (QR-8) · accessibility (QR-9) · smaller-model variant (QR-2 remainder) | beauty-by-design at every tier; accessible; offline-capable | 5–8 d | C, D, E |

*Effort = solo-dev-with-agents working days, approximate; parallel subagents
can compress. Total ≈ **4–6 weeks** to a beautiful, live, cheap, growing system.

---

## Phase A — Harden the foundation (LR closure) — *start here*

Closes the scheduled LR implementation steps and fixes the npm audit before
anything real ships.

1. **A1 — LR-6 render override + tier projects.** Bind a render-path override
   (env/flag: `BS_RENDER_MODE=canvas|webgl`) at `createRenderer`; add a
   Playwright project for the Canvas-2D tier (default smoke) and an
   opt-in `webgl2` reference-tier project. Primary WebGL2 tier = the visual
   reference (Concept verdict on LR-6).
2. **A2 — LR-3 smoke half.** E2E: type a sentence → run → assert the plain-reader
   missing-model state is shown on a clean checkout (no binaries).
3. **A3 — LR-8 local privacy audit.** Playwright route-intercept against the
   local production build: request whitelist + whole-word prompt-token check.
4. **A4 — LR-9 pinned Python env.** `requirements.txt`/`pyproject.toml` with
   exact pins (torch CPU, optimum, onnx, numpy) + verified clean-checkout run
   of `train_generator.py` (stdlib regen byte-identical; torch path code-complete).
5. **A5 — hygiene.** Resolve `npm audit` advisories (or document accepted risk).

**Gate A:** `npm run typecheck && lint && test && build`, `node scripts/ci-checks.mjs`,
Playwright (smoke + canvas tier + audit) all green locally; CF preview deploy
green; Python env reproducible from scratch.

---

## Phase B — Real models (the moment the machine reads)

Unlocks the actual experience. Sequential inside B.

1. **B1 — Embedder artifact.** Export all-MiniLM-L6-v2 → int8 ONNX
   (`embedder-all-minilm-l6-v2-int8.onnx` ~23 MB) + the WordPiece tokenizer
   assets; replace the placeholder tokenizer in `src/core/embedding.ts`.
2. **B2 — Sensory-v0 head.** Train/derive the linear 384→16 head on the seed
   corpus with provisional channel scores (spec §3.2 provenance); export int8.
3. **B3 — Denoiser + decoder (DDPM).** Implement the actual training loop:
   cosine β, T=1000, MSE on ε, ≤3 M params, CPU ≤ ~15 min; dataset = per-seed
   Gaussian clouds + inter-centre interpolations; canonical d=0 zeros latent;
   one-hot primitive anchor latents for FR-7. Export `denoiser-v1-int8.onnx`
   + `decoder-v1-int8.onnx`; wire the in-browser contract exactly as
   `src/core/generator.ts` expects (x, t, c → eps).
4. **B4 — Corpus + manifest.** Generate real `seed-forms.json` (zCenter from
   the decoder) + `models.json` v0.1.0 (content-stamped, real sha256/sizes,
   provenance; scoring: budget ≤120 MB).
5. **B5 — On-device integration.** Lazy-load sessions (WebGPU→WASM), run the
   pipeline end-to-end in-browser; determinism ≤1e-6 across reloads; privacy
   audit re-run with real assets.

**Gate B:** a typed sentence produces a real form in the SPA (WebGL2), with
alternates and marginalia populated from real seed data; determinism check
pixels-excluded per LR-10; budget + privacy audits green.

**🛑 Human decision (B gate): form-aesthetic direction.** The first real forms
will not be beautiful — they will be *honest sketches*. Before Phase C, the
Concept Agent + you decide the aesthetic register (shape library tuning,
blend behaviour, palette) based on actual renders — not on hope.

---

## Phase C — Real encounter

Make the vertical slice feel like the concept, not a demo.

1. **C1 — Form-quality pass.** Tune SDF library parameters, blend radius, pose
   priors against real renders; expand seed texts if the 8-cold-start is too
   thin (cheap: more arbitrary seed lines).
2. **C2 — Marginalia with a real consensus.** "whose crowd is this nearest"
   computed over real seed forms; the machine's reading as a stranger's note
   (plain-reader).
3. **C3 — E2E user flow.** Playwright flow: type → form + ≥3 alternates +
   marginal note + fingerprint line; screenshot snapshot for the record.

**Gate C:** the vertical slice is demo-able and evocative — first forms that
carry the light/happy/colourful register without apology.

---

## Phase D — Collection (Slice 2)

The living distribution becomes real.

1. **D1 — D1 schema + edge path.** `corpus` (append-only, consent-gated,
   DR-1…DR-3) + `runs`; thin edge function write path; `text_sha256` only.
2. **D2 — Consent UX.** Single plain-language opt-in; CC-licensed collective
   artwork framing.
3. **D3 — Co-creation loop.** Visitor shapes/accepts/adjusts/rejects the
   machine's form for a sentence; every move a gradient sample (FR-16).
4. **D4 — Aligner.** Contrastive text↔form metric trained on the fresh corpus
   (the convention-crystallizer made real); replaces the imported prior toward
   community taste.
5. **D5 — Weekly drift.** Scheduled free-GPU job (Kaggle/Colab) → LoRA
   fine-tune + model manifest bump + a human-readable release note.

**Gate D:** first consented community contributions land; a weekly drift run
produces a new manifest with provenance and the app picks it up via pointer.

---

## Phase E — Context staging (Slice 3)

Sequence and context become first-class (Kuleshov, in code).

1. **E1 — Totem** (per-sentence stacked sculpture; shapes re-read neighbours).
2. **E2 — Strip/montage** (order/timing as controls; the cut).
3. **E3 — Gallery** (the same form under different contextual frames — text
   on/off, palette, light, scale).
4. **E4 — VAD labels** (interface/steering only, never conditioning — FR-4).
5. **E5 — Sharing** (PNG/WebM cards; "state of the consensus" view).

**Gate E:** the encounter can be sequenced and re-contextualised; outputs are
exportable and shareable.

---

## Phase F — Polish & beauty (Slice 4)

The register, finished.

1. **F1 — Full aesthetic grammar** (designer lighting/colour/motion system;
   the edge policy extended from "at least one" to a real grammar).
2. **F2 — WebGPU backend** + SDF raymarching (the primary tier gains depth,
   bloom, DOF).
3. **F3 — PWA/offline** (QR-8) — models cached; works from a gallery kiosk.
4. **F4 — Accessibility floor** (QR-9): text alternatives, keyboard shaping,
   non-hue distinctions.
5. **F5 — Smaller-model variant** (QR-2 remainder): device probe → tiny
   embedder/generator for low-end devices.

**Gate F:** beauty at every tier, degraded honestly, accessible, offline-capable.

---

## Parallelism & sequence invariants

- **Strictly sequential:** B → C (real forms before the encounter); C → D
  (a live encounter before harvesting contributions); D → E (context needs a
  real corpus of readings).
- **Parallelisable:** within A (A1/A3 could be two agents), B1/B2 (independent
  exports) then B3; D4 (aligner) can overlap D1–D3 conceptually; E5 and F1 can
  start on real outputs as soon as they exist.
- **Never parallelised:** anything touching the corpus schema or consent
  (D1/D2) without the Requirements lens — the DR rules are load-bearing.

---

## Human decision points (you'll be asked at these)

| # | When | Decision |
|---|---|---|
| D-A | Gate A | approve the local-test foundation + audit posture (ship with accepted risks noted) |
| D-B | Gate B | **form-aesthetic direction** — the register the machine's first forms should speak, based on real renders |
| D-C | Gate C | whether the vertical slice is "evocative enough" to open the collector |
| D-D | Gate D | consent/licence wording for the corpus (CC) + how public the collector opens |
| D-E | Gate E | share/export formats + whether the strip/gallery become embeddable (`<iframe>`) |
| D-F | Gate F | the final aesthetic grammar review |

---

## Risks & stoppers (named, with mitigation)

1. **Cold-start model quality (staged).** 8 seed forms yield rough sketches;
   mitigation = expand seed set early + the B-gate aesthetic decision sets
   expectations honestly (sketches are register, not defect).
2. **On-device perf on mid-range phones.** int8 + lazy loading + Canvas-2D
   fallback already constrain it; B5 measures and F5 adds the tiny variant.
3. **Corpus cold-start in D.** No contributions yet → warnings, not blocks;
   the seed corpus + workshops/installations act as the bootstrap (FR-19).
4. **npm audit / supply-chain.** A5 before any public deploy.
5. **Scope drift into "just one more slice."** The gates are the brakes; the
   Concept Agent's verdicts at D-B/D-F are the aesthetics firewall.

---

## First move after approval

Execute **Phase A, A1 → A5 in order**, verification-gated at Gate A, then
immediately continue into **Phase B1** (embedder export) so the machine starts
reading. I'll report at each gate and pause at the marked human decisions.

---

*Sequence proposed 2026-08-28. Adjust anything (order, effort, gates,
decision points) and approve — I'll track it against this file.*