# Beyond Shape — Redesign Vision

> **Status:** Skeleton / outline. The conceptual spine is agreed; the technical
> deep-dives (§3) are deliberately left as placeholders and will be written up
> separately, layer by layer.
>
> **Companions:** [`CONCEPT.md`](./CONCEPT.md) (the current conceptual frame)
> and [`BEYOND-SHAPE-SPEC.md`](./BEYOND-SHAPE-SPEC.md) (the current system).
> This document is the *proposal for what comes next*.

---

## Opening — The critique, distilled

The current system is conceptually right and technically dated. Its idea has
cracks that deserve to be named before we rebuild on it:

- **Imported taxonomy, claimed arbitrariness.** The frame says the sign is
  arbitrary, but the emotion layer is a fixed 9-box scheme inherited from
  IBM Watson's 2015-era Tone Analyzer — a corporate-affect convention that the
  frame never acknowledges. The arbitrariness is staged *inside a preset cage*.
- **The compression contradiction.** "Lossy compression" presupposes a true
  original meaning being degraded — but the semiotic frame claims no stable
  original exists. Meaning is *transformed and occasioned*, never degraded. The
  mournful vocabulary ("residue," "ghost," "what is destroyed") contradicts
  both the logic and the medium.
- **The mean/mode slip.** "The sign is the consensus" is right, but consensus
  is a *distribution*, not a centroid — the mean of {box, cone, cylinder} is
  not a shape anyone can inhabit. Meaning lives at the center; beauty lives at
  the regulated edge.
- **The ideal-reader mirage.** Bertin's graphics and the visualization
  tradition posit a context-free reader. No such reader exists; the
  "interpretation layer" is not a flaw of the system, it *is* the system.
- **Mourning in technicolor.** The frame dresses the work in grief while the
  work is light, happy, and colourful. The rebuild embraces the register the
  medium always had.

---

## §1 Concept, Reframed

The load-bearing ideas of the redesign:

1. **The sign is a living distribution, not a fixed slot.** Any consensus on
   "what sadness looks like" is a probability field over forms — invented by
   constrained, embodied humans; aggregated by a machine; re-occasioned by
   each reader. It is *never* settled.
2. **Meaning is the center; beauty is the regulated edge.** Like an LLM at
   temperature > 0, the interesting output comes from sampling the
   distribution, not argmaxing its mode. The system's expressive instrument is
   the **drift knob** between pure consensus (the most legible, most
   *understood* sign) and hallucinated edge (forms nobody named).
3. **The sign is an occasion, not a message.** Barthes' anchoring, run
   backwards: text launches an unanchored form into the reader's context.
   Iser's gaps: the totem is built of indeterminacies, and reading is
   concretization. No point in the pipeline transmits meaning; all points
   *occasion* it.
4. **Constrained embodiment → convergence.** The sign is not "arbitrary" in
   Saussure's absolute sense; it is *arbitrary within a shared, bounded body* —
   two eyes, gravity, bilateral symmetry, hand geometry, trichromatic vision.
   Bodies channel sign-production toward convergence without ever settling it.
5. **Context is a first-class variable.** The seam between form and reader is
   the actual site of the work — and it can be *turned* (see §4).

---

## §2 The Lineage, Honestly

Not upgrades — ancestors and deliberate inversions:

| Figure | Their claim | What we inherit | What we invert |
|---|---|---|---|
| **Bertin** — *Semiology of Graphics* | A rational grammar of graphic variables for unambiguous data transmission | The variable space itself: hue, value, size, shape, position (+ we add material, rotation, time and 3D) | His telos: he optimizes for least-effort; we optimize for generative surplus. The ideal reader doesn't exist. |
| **Barthes** — *Rhetoric of the Image* | The linguistic message anchors the polysemous image | Images are floating chains of signifieds | We run the anchor backwards: text *launches* a floating form instead of pinning it. |
| **Iser** — reader-response theory | Gaps and indeterminacies are the engine of reading; meaning is concretized by the reader | The artwork as a field of gaps | (Alignment, not inversion:) the totem is a structured gap-field. |
| **Kuleshov** — Soviet montage | Meaning is created by the cut — the preceding shot re-reads the next | Juxtaposition as a meaning-maker; the totem stack already encodes inter-sentence emotional deltas | Sequence becomes a *controllable medium*, not an accident (§4). |

Where we land: a **contestable, living semiology of graphics for emotion** —
Bertin's variable space, Barthes' reversed anchoring, Iser's gaps, Kuleshov's
cut, all mounted on a machine that aggregates and re-occasions.

---

## §3 Technical Rebuild — *[skeleton; deep-dives to follow separately]*

### §3.1 The modern interpretation layer *(replaces the 2018 Watson layer)*

- The current layer: 9 fixed Watson tones + sentiment sign, coarse and
  corporate.
- The aim: a **continuous, contextual, sensory** representation of text that
  does not pre-cage meaning into a taxonomy.

> **[TECHNICAL DEEP-DIVE — PLACEHOLDER]**
> 1. Continuous text embeddings (BGE-M3 / GTE / E5 / text-embedding-3) —
>    representation & dimensioning, no fixed taxonomies.
> 2. Joint vision–language space (CLIP / SigLIP / OpenCLIP) — words and forms
>    mutually addressable in one learned metric space.
> 3. LLM extraction of aesthetic qualia (imagery, material, color, temperature,
>    motion, time-of-day) → a *sensory* conditioning channel, not semantic only.
> 4. Optional dimensional overlays (valence–arousal–dominance) for steering.
> 5. Prompts vs. embeddings-only; hybrid; what we want to preserve of "emotion"
>    as a concept at all.

### §3.2 Generation — *from argmax to sampled distribution*

- The current layer: a tiny MLP producing 22 numbers; primitive chosen by
  argmax over 10 one-hots; outputs averaged to a point.
- The aim: a **generative sampler** that can sit anywhere on the
  consensus → hallucination spectrum, and that *drifts* with its community.

> **[TECHNICAL DEEP-DIVE — PLACEHOLDER]**
> 1. Diffusion-based generation conditioned on text/CLIP embeddings; text-to-3D
>    via triplane / SDF / 3D-native diffusion (Shap-E, Point-E, Latent-Mesh
>    Diffusion, BSP-Net), or Gaussian splatting for near-view.
> 2. The drift/temperature knob: sampling strategy, top-p / temperature
>    analogues in 3D, and how "regulated edge" becomes a parameter.
> 3. Community drift: incremental fine-tuning (LoRA) of the generator on each
>    community's collected mappings — the *convention keeps moving*.
> 4. What we lose by leaving the 22-dim vector (inspectability, determinism,
>    parsimony) and how we keep it as an artistic *constraint*, not a relic.

### §3.3 Rendering & experience — *WebGPU, real-time beauty*

- The current layer: 2018-era A-Frame / p5.js; hardcoded lights, fixed
  saturation, arithmetic stacking, one ambient + one point light.
- The aim: **real-time, deliberate, felt** rendering; beauty as designed
  policy, not functional default.

> **[TECHNICAL DEEP-DIVE — PLACEHOLDER]**
> 1. WebGPU + Three.js / Babylon / React Three Fiber; the 2020s-real-time
>    stack that 2018 couldn't do.
> 2. PBR materials, ACES tone mapping, bloom, depth-of-field, soft shadows,
>    volumetrics — an aesthetic *grammar* for lighting and palette.
> 3. Time as a variable: growth, decay, reassembly — animation not as
>   ornament but as montage-in-time (§4 ties in here).
> 4. Scale: totem, room, landscape, VR — the frame as an environment.

---

## §4 The Staging of Context

Making the seam between form and reader a *controllable medium*:

1. **Sequence as montage.** The same forms re-ordered, re-timed, placed
   against different neighbours and cumulative histories — the Kuleshov cut as
   an artist's parameter. The totem becomes one still in a compressible strip.
2. **Encounter history.** The artwork that remembers: a reader's previous
   readings feed context into the next rendering — a personal chained montage.
3. **Collective past.** The community's accumulated significations encoded as
   the drifting generator (§3.2.3). This *is* "the past" of a group, made
   operational.
4. **The honest boundary.** The embodied, boundless, individual biography is
   not reachable yet — and should not be faked. The redesign names this line
   and does not cross it.

---

## §5 Tensions & Trade-offs

Named rather than resolved:

- **Legibility vs. expressiveness.** A CLIP latent is not inspectable the way a
  22-dim vector was. Determinism and parsimony are traded for beauty — this
  should be a *decision*, not an accident.
- **Imported authority, round two.** An LLM/embedding layer replaces IBM with
  OpenAI (or whoever) — a *new* imported prior. The participant-invented
  vocabulary (§1.4 / §3.1) is the mitigation, or we've just changed vendors.
- **Community drift vs. stability.** Honestly: the contestedness is the
  content — but drift too hard and the work loses graspability.
- **Context as feature vs. context as ornament.** Staging context is only
  meaningful if it changes the *reading*, not just the lighting.

---

## Status / Next steps

- [x] Conceptual spine agreed (this document, §1–§2, §4–§5)
- [ ] **§3 technical deep-dives** — to be written separately, one layer at a
      time (interpretation → generation → rendering)
- [ ] Migrations or fresh scaffolding decision for each of the six repos
- [ ] A minimal vertical slice to validate the loop before full rebuild

---

*Companion note: the critique opening of this document assumes the reader has
the current `CONCEPT.md` and `BEYOND-SHAPE-SPEC.md` in view.*