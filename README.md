# Beyond Shape

An art system that makes the **arbitrariness of the sign visible by replacing
convention with computation** — and by letting a population's acts of naming a
feeling condense into a single generating form. Text in, generative sculpture
out; the machine as one reader among many.

> **Status (2026):** design phase. The conceptual corpus and requirements are
> settled; the first implementation spec is consensus-approved and awaiting
> delegation to dev subagents.

## Repository layout

```
BEYOND-SHAPE-SPEC.md          ← what the 2018 system was (six microservices)
CONCEPT.md                    ← the conceptual frame (why)
REDESIGN.md                   ← the critique + vision for the rebuild
REQUIREMENTS.md               ← the bridge: concept → testable shall-statements
TECHNICAL-DESIGN.md           ← the tech design + deployment/hosting appendix
AGENTS.md                     ← the role-based consensus pipeline (Concept/Requirements/Tech → dev agents)
architecture.svg              ← architecture diagram (2026)
architecture-preview.png      ← PNG export of the above (regenerable)
specs/                        ← consensus-approved Implementation Specs (Slice 1 = core engine)
adr/                          ← Architectural Decision Records (ADR-0004, ADR-0005)
shape-*  (ignored)            ← 2018 reference clones, kept on disk only;
                                versioned at github.com/KODHAGe/…
```

## The four-document chain

```
CONCEPT → REQUIREMENTS → TECHNICAL-DESIGN → AGENTS (→ specs/ → adr/ → dev agents)
```

Every decision is traced: each requirement in `REQUIREMENTS.md` carries a
concept principle (C#) and a design section (TD#); each spec binds requirements
to acceptance tests; each consequential technical choice is an ADR. The agent
pipeline in `AGENTS.md` is how new design work is produced and reviewed.

## The build (Slice 1 — Core Engine)

Approved spec: `specs/implementation-spec-slice1-core-engine.md`

- **Stack:** Vite + TypeScript SPA → Cloudflare Pages; one thin Pages Function;
  all inference on-device (ONNX Runtime Web, WebGL2 with Canvas-2D fallback).
- **Pipeline:** text → continuous embedding (all-MiniLM-L6-v2 int8, 384-d) →
  sensory conditioning vector (v0, names in data) → 64-d latent diffusion →
  SDF-blended continuous form (8-primitive library) → Three.js PBR render.
- **The drift knob:** 0 = the community's centre, 1 = the hallucinated edge; the
  default encounter shows a *distribution* of forms plus the machine's reading
  as marginalia ("whose crowd is this nearest").
- **Privacy by architecture:** interpretation and generation run locally; the
  reader's text never reaches a server unless they opt into the corpus (Slice 2).
- **Cost:** ≈ $0 recurring — free tiers only (Pages, Workers, free GPU training).

## Running the pipeline

When new design work needs to happen, instantiate the agents in `AGENTS.md`
(Concept, Requirements, Tech) and run the consensus protocol; the output is an
Implementation Spec that dev subagents build to. Dev agents must follow the
spec binding and file spec-defects back on contradiction — never deviate
silently.

## 2018 reference (archived)

The historical six-microservice system lives in the `KODHAGe` org:
[shape-constructor](https://github.com/KODHAGe/shape-constructor) ·
[shape-interpreter](https://github.com/KODHAGe/shape-interpreter) ·
[shape-renders](https://github.com/KODHAGe/shape-renders) ·
[shape-decoder](https://github.com/KODHAGe/shape-decoder) ·
[shape-mapper](https://github.com/KODHAGe/shape-mapper) ·
[shape-consumer](https://github.com/KODHAGe/shape-consumer)