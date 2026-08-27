# Beyond Shape — Requirements

> **The bridge document.** This is not the technical specification (that's
> [`TECHNICAL-DESIGN.md`](./TECHNICAL-DESIGN.md)) and not the concept
> (that's [`CONCEPT.md`](./CONCEPT.md)). This document captures *what the system
> must be* such that the concept is realized and the technical design can be
> derived from it. Every requirement below traces up to a concept principle (C#)
> and down to the technical design (TD#) that satisfies it.
>
> **Status:** Draft v1 — produced by the consensus of the Concept, Requirements,
> and Tech agents (see [`AGENTS.md`](./AGENTS.md)). Requirements are written as
> *shall* statements; "how" is deliberately deferred to the technical design.

---

## 0. Traceability key

| # | Concept principle (from CONCEPT.md & REDESIGN.md) |
|---|---|
| **C1** | The sign is a **living distribution**, not a fixed slot — consensus is a probability field over forms, never settled. |
| **C2** | **Meaning is the center; beauty is the regulated edge.** The expressive instrument is the *drift knob* between consensus and hallucinated novelty. |
| **C3** | The sign is an **occasion, not a message** — no stable signified is transmitted; every reading re-signifies. The interpretation layer is never absent. |
| **C4** | **Context is a first-class variable** — sequence/juxtaposition (Kuleshov), gaps (Iser), and re-contextualization change the reading. |
| **C5** | **Constrained embodiment → convergence** — signs are invented within a shared, bounded body, so human sign-making converges without settling. |
| **C6** | The machine is a **convention-crystallizer** — a sign-aggregator, not author; collective past enters via drift. |
| **C7** | The **register of the work** is light, happy, colourful — the medium's exuberance is not a contradiction but the point. |
| **C8** | **Local models are architecturally true** — unmediated, private, per-reader interpretation makes "the sign as private occasion" a fact, not a metaphor. |

---

## 1. Goals

- **G1.** Let a visitor *feel* a text by seeing forms the community-machines have
  learned to make for it — a generative translation, not a description.
- **G2.** Let visitors *contribute* to the collective sign (shape a form, drift
  the consensus) as an act of play/authorship, not labor.
- **G3.** Make the interpretation and generation machine **continuous and
  open** — no fixed emotion taxonomy, no preset shape cage.
- **G4.** Operate at **near-zero cost** on the open web, with the visitor's own
  device doing the heavy lifting.
- **G5.** Express the concept honestly: the system *stages* the arbitrariness /
  convention-making (consensus, drift, contradiction) rather than hiding it.

## 2. Non-goals

- **NG1.** No claim to "correct" emotion detection; the interpretation is one
  reader among many.
- **NG2.** No authenticity/attribution-by-biography: individual lived context is
  explicitly *out of reach* (REDESIGN §4.4) and must not be faked.
- **NG3.** No microservice sprawl — no six-deployable architecture.
- **NG4.** No paid-access wall: the core experience is free and web-based.
- **NG5.** Not a training-data mill; the corpus is a collective artwork, not a
  dataset to be sold.
- **NG6.** Not CI-only testing. The suite is designed to run on a contributor's
  laptop as the baseline; CI runs the *same* suite headless, never a stricter
  or different one (LR-1…LR-10).

---

## 3. Actors

| Actor | Description |
|---|---|
| **Visitor / Reader** | Types text, experiences generated forms, re-signifies them. |
| **Contributor** | A visitor who shapes a form for a text and opts it into the corpus — same app, same act, different intent. |
| **The Machine** | The local on-device interpretation+generation — a reader with its own (statistical) biography. |
| **The Consensus** | The aggregate community distribution over forms for a given text — a visible, drifting "author." |
| **Curator** (human admin) | Runs the weekly drift release, reviews edges, manages model versions and the consent/licensing posture. |

---

## 4. Functional requirements

### 4.1 Interpretation (what the machine reads)

- **FR-1.** The system SHALL interpret arbitrary free text without constraining
  it to a fixed emotion taxonomy. [C1, C3]
- **FR-2.** The interpretation SHALL be represented as a point in a continuous
  space (not a small set of labelled buckets). [C1, C5]
- **FR-3.** The interpretation SHALL include a *sensory* channel (material,
  light, motion, warmth, weight…) in addition to any semantic content, so that
  generation can be conditioned on sensation, not just meaning. [C2, C7]
- **FR-4.** The system MAY provide a lightweight human-facing label layer (e.g.,
  valence/arousal) as an ergonomic anchor — but labels MUST NOT be the
  conditioning signal. [C1, C3]
- **FR-5.** The interpretation SHALL run locally on the visitor's device by
  default; the reader's text MUST NOT be required to leave the device.
  [C8, CR-4]
- **FR-6.** The interpretation MUST be able to report its own reading back to
  the reader (see the machine's reading as one reading among many). [C3, G5]

### 4.2 Generation (what the machine makes)

- **FR-7.** The system SHALL generate forms in a **continuous** shape space —
  intermediate/ambiguous forms ("between box and sphere") MUST be reachable and
  renderable, not collapsed onto a fixed set of primitives. [C1, C5]
- **FR-8.** Generation SHALL support an explicit **consensus ↔ novelty** axis
  (the *drift knob*): low drift reproduces the community's central tendency;
  high drift samples the hallucinated, plausible-but-never-seen edge. [C2]
- **FR-9.** The system SHALL be able to show not one form but a small
  **distribution of forms** for a given text, making the living distribution
  visible rather than hiding it behind a single output. [C1, G5]
- **FR-10.** Generation SHALL be deterministic-reproducible given (input, drift
  setting, seed). [QR-6]
- **FR-11.** The machine's output SHALL be able to **differ from the viewer's
  own intuition** and that difference SHALL be surfaced (not smoothed away) as
  part of the encounter. [C3, C5]

### 4.3 Context staging (how the work is encountered)

- **FR-12.** The system SHALL support rendering a single text as a **totem**
  (stacked, per-sentence forms that re-read each other). [C3, C4]
- **FR-13.** The system SHALL support sequencing multiple forms in a **strip /
  montage** such that a form's reading is affected by its neighbours (the cut).
  Sequence MUST be a controllable parameter, not an accident. [C4]
- **FR-14.** The system SHALL support a **gallery** mode presenting the *same*
  form under deliberately different contextual frames (with/without source
  text, different palette, light, scale). [C3, C4]
- **FR-15.** The system MAY support **encounter history** — prior readings of
  the same reader conditioning later renderings — as a personal chained
  montage. [C4, C6]

### 4.4 Collection & the corpus (how the sign is invented)

- **FR-16.** The collection act SHALL be the **co-creation loop**: visitor
  types text → shapes a form → the machine reads it back against the consensus
  → visitor accepts, adjusts, or rejects. Every move (including rejections)
  SHALL be capturable as a gradient sample. [C2, C3, G2, G5]
- **FR-17.** Contributions SHALL be **opt-in with explicit, plain-language
  consent**; nothing is stored without consent. [C8, CR-4]
- **FR-18.** The system SHALL maintain a visible, versioned **consensus** (the
  community's distribution per text/seed) that *drifts* as contributions are
  accepted. [C1, C6]
- **FR-19.** The system SHALL bootstrap from a **cold-start** corpus (machine's
  own readings) so the first human contributions happen relative to a real
  consensus. [C6]
- **FR-20.** The corpus MUST record, per contribution: input text/sample, the
  form parameters, the consent flag, the contributor's anonymous id, a
  timestamp, and (where available) the accept/adjust/reject gradient. [C6, DR-1]
- **FR-21.** Divergent/outlier contributions SHALL be *kept and labelled as
  edges*, not discarded or clamped. [C1, C2]

### 4.5 Sharing & reach (how the work spreads)

- **FR-22.** The system SHALL export a contribution/result as a **shareable
  card** (image/embed) from the strip and gallery modes. [G2, QR-7]
- **FR-23.** The system SHALL present a readable **"state of the consensus"**
  view: per text, the distribution, the center, and the edges. [G5, C1]

---

## 5. Quality requirements

- **QR-1.** **First-interaction delight.** A visitor SHALL reach a meaningful
  generated encounter from a typed sentence within seconds on a mid-range
  device (progressive enhancement: low-fidelity first, refinement after).
- **QR-2.** **Device honesty.** The system SHALL degrade gracefully (a WebGL2
  path and a smaller model variant) and must remain usable on older/lower-end
  devices.
- **QR-3.** **Privacy by architecture.** The default path MUST NOT transmit the
  reader's text to any server. Interpretation is local by design, not by policy.
  [C8]
- **QR-4.** **Aesthetic legacy.** The visual language SHALL be deliberate, not
  functional-default: designed lighting/palette grammar; the work reads light,
  happy, colourful. [C7]
- **QR-5.** **Legibility of the machine's reasoning.** The system SHALL be able
  to show *why* a form arose (consensus proximity, drift setting, text
  neighbours) at a human-readable level, without exposing a raw latent.
- **QR-6.** **Reproducibility.** Same input + drift + seed = same form
  (important for the strip/gallery and for citation in the community).
- **QR-7.** **Exportability.** Forms render to PNG/WebM and are embeddable as
  cards/iframes.
- **QR-8.** **Offline capability.** After first load (models cached), the
  generator SHALL work without connectivity — important for installations/kiosks.
- **QR-9.** **Accessibility floor.** Text alternatives, keyboard navigation for
  the shaping editor, and colour-independent distinctions beyond hue.

---

## 5A. Local development & testing (LR)

The test suite is designed around a contributor's laptop as the **baseline**:
CI runs the *same* suite headless, never a different one. These requirements
were added after the Slice 1 scaffold (commit `6a23ecf`) was verified
locally — they ground observed reality, not aspiration.

- **LR-1.** **Local parity.** The app SHALL run fully locally with
  `npm install && npm run dev` on a contributor machine — no accounts, no
  Cloudflare credentials, no network beyond localhost — and its core loop
  (interpret → generate → render) MUST NOT require the Pages Function or any
  remote service. [CR-1, CR-3, CR-6]
- **LR-2.** **Deterministic, offline unit suite.** All unit tests (Vitest)
  SHALL pass fully offline (no network, no browser download) and be
  deterministic across machines and OSes; no test SHALL fetch a remote
  resource (manifest/models are mocked where a loader touches `fetch`).
  [FR-10, QR-6]
- **LR-3.** **Scaffold state is a testable state.** The missing-model state
  (`ModelMissingError` → the friendly "models not built yet" message) SHALL be
  a first-class state in the local suite (unit + smoke), so a clean checkout
  without ONNX binaries still exercises the UI contract. [CR-7 partial]
- **LR-4.** **Local production-build smoke.** An E2E smoke SHALL run against a
  local production build (`vite build` + `vite preview`) with Playwright; it
  MUST NOT require a deployed Cloudflare preview. [CR-4, QR-1]
- **LR-5.** **Edge-function local parity.** The Pages Function SHALL be
  runnable locally via `wrangler pages dev` with zero secrets, and the SPA
  SHALL behave identically when the function is unreachable (it is a stub by
  design). [CR-3, CR-4]
- **LR-6.** **Render-tier coverage.** Local testing SHALL exercise both the
  WebGL2 path and the Canvas-2D fallback (via a device flag or separate
  Playwright projects), and the fallback SHALL be selectable in local dev
  without a GPU. [QR-2]
- **LR-7.** **GPU-free default.** The standard local test command SHALL require
  no GPU and no WebGL; GPU/WebGPU-accelerated checks are opt-in only. [QR-2,
  CR-6]
- **LR-8.** **Local privacy audit.** The FR-5/QR-3 network-audit SHALL be
  runnable locally against the local production build — not only against the
  deployed preview — so the "text never leaves the device" guarantee is
  verifiable before deploy. [FR-5, QR-3, C8]
- **LR-9.** **Model reproducibility.** A pinned Python environment
  (`requirements.txt`/`pyproject.toml`, exact pins) SHALL allow
  `scripts/train_generator.py` to run on CPU from a clean checkout in
  ≤ ~15 min and reproduce the artifacts + manifest; contributors without
  PyTorch SHALL still be able to run the stdlib-only regeneration of
  `models.json`/`seed-forms.json`. [CR-7, FR-7 anchors]
- **LR-10.** **Cross-machine determinism.** Reproducibility (FR-10) SHALL hold
  across local machines, OSes, and browsers for the sampling path (CPU
  float32 + seeded PRNG); where a tolerance is unavoidable (e.g., marching
  cubes at grid resolution), the bound SHALL be documented in the spec trace.
  [FR-10, QR-6]

**How the suite is meant to be run (requirements-aligned, not pinned):**
unit + lint + typecheck offline; production-build Playwright smoke; optional
edge parity via Wrangler; optional GPU-free training milestone via the pinned
Python env. The exact commands and versions live in the tech design/spec, not
here.

---

## 6. Constraint requirements

- **CR-1.** **Web is the output format.** The primary experience runs in the
  browser; no native app is required. [G1, G4]
- **CR-2.** **Near-zero operating budget.** The system SHALL run at ≈$1/month —
  hosting, database, inference, and training on free tiers. Spending MAY improve
  quality; it MUST NOT unlock core function. [G4]
- **CR-3.** **No microservice architecture.** The system SHALL be one
  browser-centric monolith (one web app + one thin edge function + one managed
  data store). [NG3]
- **CR-4.** **Cloudflare-first.** Static + edge + DB + assets SHALL target
  Cloudflare (Pages, Workers, D1, R2) using existing accounts, unless a
  documented constraint forces otherwise.
- **CR-5.** **Open weights, no vendor lock-in in the browser.** The on-device
  models SHALL be open-weights artifacts (ONNX/int8), shipped as files — no
  client-side API keys. [C8, G4]
- **CR-6.** **The interpretation and generation SHALL be on-device; any server
  compute is a thin monolith only** (auth, consent-gated writes, optional
  fallback for old devices). [C8, CR-3]
- **CR-7.** **Training is periodic and offline** (weekly, free-GPU), producing
  versioned model artifacts served from the CDN. Real-time retraining is not a
  requirement.

---

## 7. Data requirements

- **DR-1.** **Corpus schema** (per contribution): anonymous contributor id,
  input text or seed id, generated/accepted form parameters, consent flag,
  gradient (accept/adjust/reject), timestamp, model version, drift setting.
  [FR-20]
- **DR-2.** **Consent & licensing.** One explicit opt-in, plain language; the
  corpus is published as a CC-licensed collective artwork with anonymized
  authorship. No involuntary storage (enforced by architecture, CR-3/CR-6).
  [NG5]
- **DR-3.** **Append-only.** The corpus SHALL be append-only: never deleted or
  rewritten in place; consented deletion is a documented future path.
- **DR-4.** **Drift provenance.** Each weekly model release SHALL record which
  corpus data (date range, volume, consent status) produced its drift, so the
  "weekly release note" (§4.4 of REDESIGN) is auditable. [C6]
- **DR-5.** **Model registry.** A versioned manifest (interpretation + generator
  + aligner artifacts) with instant rollback by pointer change. [CR-7]

---

## 8. Traceability matrix (concept → requirements → tech design)

| Concept | Primary requirements | Satisfied by (TD) |
|---|---|---|
| C1 living distribution | FR-1, FR-7, FR-9, FR-21, FR-23 | TD §3.1, §4.2–4.3 |
| C2 center/edge (drift knob) | FR-8, FR-11, FR-21, QR-6 | TD §4.3, §4.4 |
| C3 occasion-not-message | FR-6, FR-11, FR-12–15, QR-5 | TD §1, §5.3 |
| C4 context first-class | FR-12–15, QR-7 | TD §5.2–5.3 |
| C5 constrained embodiment | FR-2, FR-7, FR-11 | TD §4.2 |
| C6 convention-crystallizer | FR-10, FR-15, FR-18–20, DR-4 | TD §4.4 |
| C7 light/happy/colourful | FR-3, QR-4, QR-9 | TD §5.1 |
| C8 local models / privacy | FR-5, FR-17, QR-3, CR-5–6 | TD §2, §3 |
| (Constraints) web/$0/no-ms/CF | CR-1..CR-7 | TD §1, §7, App. A |
| (Local dev) laptop-parity, offline suite, GPU-free default, local privacy audit | LR-1..LR-10 | Slice 1 spec §6, `scripts/ci-checks.mjs`, playwright/vitest configs |

---

## 9. Out of scope (explicitly deferred)

- Individual-biography personalization (the "boundless" context) — named as a
  hard boundary, not an open feature (REDESIGN §4.4).
- Real-time community drift / live collaborative editing of the consensus
  (drift is weekly-release cadence).
- Multi-language interpretation beyond what the chosen on-device embedding
  model supports natively.
- Monetization, auth-required accounts, or closed-source models.

---

*Maintenance note: this document is owned by the Requirements Agent and is
regenerated through the consensus protocol in `AGENTS.md` when the concept or
technical design changes. Requirement IDs are stable and referenced by the
implementation spec.*