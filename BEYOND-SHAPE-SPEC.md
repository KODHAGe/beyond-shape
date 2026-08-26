# Beyond Shape — System Specification

**Status:** Draft (derived from repository source code, commit history, and configuration)
**Date:** 2026-08-24
**Scope:** Functional and architectural specification of the *Beyond Shape* microservice platform for the generative creation of 3D shapes driven by natural-language emotion analysis.

---

## 1. Overview

*Beyond Shape* is an experimental, modular platform that **learns to generate 3D shapes from text**. The core idea is a two-sided data loop:

1. **A human side** — people express *how* an emotion "should look" as a 3D shape by manipulating geometric parameters. These subjective mappings are collected as ground-truth training data.
2. **A machine side** — a neural network learns the mapping from **text-derived emotion vectors** to **3D shape parameters**, and can then generate a shape *totem* from any arbitrary text.

The system is decomposed into six loosely coupled repositories, each with a single responsibility:

| Repository | Role | Type |
|---|---|---|
| `shape-decoder` | Text → emotion/sentiment/entity analysis (aggregates multiple commercial NLP APIs) | Node.js microservice |
| `shape-mapper` | Data collection: humans map emotions → shape parameters | Vue 2 + p5.js web app |
| `shape-interpreter` | Train a TensorFlow.js model + serve predictions | Node.js microservice (TFJS) |
| `shape-constructor` | Generative front end: text in → 3D shape "totem" out | React + A-Frame web app |
| `shape-consumer` | Minimal text-analysis explorer (test client for `shape-decoder`) | Vue 2 web app |
| `shape-renders` | High-fidelity offline rendering of generated shapes | Blender project |

---

## 2. Goals

- **Generative creation of shapes** from unstructured natural language using a TensorFlow.js model.
- **Modular microservice architecture** where each capability (analysis, data collection, learning, rendering) is independently deployed and evolved.
- **Vendor-neutral emotion analysis** by aggregating multiple commercial NLP platforms behind a single API.
- **Human-in-the-loop data collection** to produce a ground-truth dataset of emotion→shape mappings.
- **Rapid prototyping** — all services are small, container-friendly, and deployable to serverless/paaS platforms (ZEIT Now, Heroku, IBM Cloud Functions).

---

## 3. High-Level Architecture

```
                        ┌────────────────────────────────────────────────────────────┐
                        │                      DATA COLLECTION                       │
                        │                                                            │
                        │   shape-mapper (Vue + p5.js web app)                       │
                        │   User maps 9 emotions → shape + 12 slider parameters      │
                        │                                                            │
                        └──────────────┬─────────────────────────────────────────────┘
                                       │ autosave (debounced), anonymous auth
                                       ▼
                        ┌───────────────────────────────┐
                        │  Firebase / Firestore         │
                        │  project: "shape-mapper"      │
                        │  collection: "results"        │
                        │  GCS bucket: "shape-mapper"   │
                        └──────────────┬────────────────┘
                                       │ read + write models (versioned)
                                       ▼
                        ┌───────────────────────────────┐
                        │   shape-interpreter (TFJS)    │
                        │  train NN: 9 emotions → 22    │
                        │  shape params (12 geometry +  │
                        │  10 shape-type logits)        │
                        │  version.tag = model version  │
                        └──────────────┬────────────────┘
                                       │  /makePrediction
                                       ▼
┌─────────────┐   text    ┌───────────────────────────────┐
│  User text  │ ────────▶ │   shape-constructor           │
└─────────────┘           │  (React + A-Frame web app)    │
                          │  1. split into sentences      │
                          │  2. per sentence → emotion    │
                          │     vector (9-dim)            │
                          │  3. per sentence → prediction │
                          │  4. compose A-Frame "totem"   │
                          └──────────────┬────────────────┘
                                         │
                    emotion vector (9)   │   prediction (22 params)
                                         ▼
                          ┌───────────────────────────────┐
                          │   shape-decoder               │
                          │  (NLP API aggregator)         │
                          │  ┌──────────┐ ┌────────────┐  │
                          │  │ IBM Watson│ │Google Cloud│  │
                          │  │ Tone/NLU  │ │ NL         │  │
                          │  ├──────────┤ ├────────────┤  │
                          │  │ Microsoft │ │ (future    │  │
                          │  │ Azure TA  │ │ providers) │  │
                          │  └──────────┘ └────────────┘  │
                          └───────────────────────────────┘

   shape-consumer (Vue): ad-hoc explorer for shape-decoder output (development aid)
   shape-renders  (Blender): offline high-fidelity renders of generated shapes
```

---

## 4. Component Specifications

### 4.1 `shape-decoder` — Text Analysis Aggregator

**Purpose:** Provide a single, unified text-analysis API over several commercial natural-language-understanding platforms. Normalizes heterogeneous provider responses into one shape.

**Stack:** Node.js, `micro` (ZEIT) + `microrouter`, `dotenv`, `jwt-simple`. Deployed via ZEIT Now.

**NLP providers (currently wired):**

| Provider | Module | Capabilities used |
|---|---|---|
| IBM Watson Tone Analyzer v3 | `watson/toneAnalyzer.js` | Document tones → emotion scores (`tone_id`, `score`) |
| IBM Watson Natural Language Understanding v1 | `watson/naturalLanguageUnderstanding.js` | Entity/keyword emotion + sentiment (wired but disabled in the combined endpoint) |
| Google Cloud Natural Language | `google/naturalLanguage.js` | Sentiment, syntax, entity sentiment |
| Microsoft Azure Text Analytics | `azure/textAnalytics.js` | Sentiment score, key phrases |

**Authentication:** All endpoints (except CORS preflight) require a JWT in the JSON body: `{ "jwt": "<token>", "text": "..." }`. The token is decoded against `JWT_SECRET`; failures return `401`. CORS is wide open (`Access-Control-Allow-Origin: *`).

**Endpoints:**

| Method | Route | Behavior |
|---|---|---|
| GET | `/` | Version banner: `shape-decoder api v1` |
| POST | `/watson/toneAnalyzer` | Watson Tone Analyzer result for `body.text` |
| POST | `/watson/naturalLanguageUnderstanding` | Watson NLU (entities + keywords) result |
| POST | `/google/naturalLanguage` | Google NL (sentiment + syntax + entity sentiment) |
| POST | `/azure/textAnalytics` | Azure TA (sentiment + key phrases) |
| POST | `/analyse-text-raw` | Runs all providers; returns `{ text, wta, gnl, ata }` |
| POST | `/analyse-text` | Runs all providers and **parses** into the normalized schema (below) |
| OPTIONS | `*` | CORS preflight handler |

**Normalized response schema** (`/analyse-text`):

```json
{
  "text": "string (the analysed sentence)",
  "detectedEmotions": [
    { "score": 0.72, "tone_id": "joy", "tone_name": "Joy" }
  ],
  "sentiment": 0.5,
  "entities": [
    { "name": "…", "type": "PERSON", "salience": 0.37, "sentiment": {…}, "mentions": […] }
  ]
}
```

> Note: `parseResponses()` currently reads `wta.document_tone.tones`, `ata.sentiment.documents[0].score`, and `gnl.entitySentiment[0].entities`. `wnlu` is commented out in the combined endpoint.

---

### 4.2 `shape-mapper` — Data Collection Instrument

**Purpose:** The human annotation tool that produces the training dataset for the neural network. Participants are shown an emotion attribute (with dictionary definition and synonyms) and asked to build a shape that — in their opinion — represents that emotion.

**Stack:** Vue 2 + TypeScript, Vuex, p5.js (WebGL previews), `vue-slider-component`, Firebase (Auth + Firestore), lodash debounce. Can be built as a standard app **or a Web Component** (`npm run wc`).

**Interaction model:**

- One block per emotion attribute. Default attributes (configurable via the `blocks` prop, comma-separated):
  `Anger, Fear, Joy, Sadness, Analytical, Confident, Tentative, Negative, Positive` (9 emotions).
- Each block shows a **definition** and **synonyms** from `src/assets/dictionary.json`.
- The user picks one of **10 primitives** via an icon slider: Box, Cone, Cylinder, Dodecahedron, Ellipsoid, Plane, Icosahedron, Torus, Octahedron, Tetrahedron.
- The user adjusts **12 geometric/material sliders** with a live p5.js WebGL preview:

| Parameter key | Meaning | Typical slider range |
|---|---|---|
| `sliderValueRotX` | Rotation around X (degrees) | 0–360 |
| `sliderValueRotY` | Rotation around Y (degrees) | 0–360 |
| `sliderValueRotZ` | Rotation around Z (degrees) | 0–360 |
| `sliderValueWidth` | Width | 50–150 |
| `sliderValueLength` | Length | 50–150 |
| `sliderValueHeight` | Height | 0–200 |
| `sliderValueScale` | Scale (used by polyhedra rendered from OBJ models) | — |
| `sliderValueRadius` | Radius (cones/cylinders/torus) | — |
| `sliderValueHue` | Hue (HSB) | 0–255 |
| `sliderValueLightness` | Lightness (HSB) | 50–100 |
| `sliderValueOpacity` | Opacity | 0–100 |
| `sliderValueMatte` | Matte (0) vs Glossy (1) | 0–1 |

**Persistence:**

- Users sign in **anonymously** via Firebase Auth to obtain a `uid`.
- State is held in a Vuex store (`objectStorage`), one record per emotion title, updated as sliders move.
- Records are **autosaved** (debounced 500 ms) to Firestore:

```
collection: "results"          (or "results_dev" when running on localhost)
documentId:  <userId><emotionTitle lowercase, no spaces>
document: {
  title:      "Anger",
  shape:      "Box",
  data:       { sliderValueRotX, … , sliderValueMatte },   // 12 params
  userId:     "…",
  modified:   <Firestore timestamp>,
  completed:  true   // only set when the user confirms via the footer button
}
```

- The `completed` flag is significant: **the trainer only consumes `completed: true` documents** (see `shape-interpreter`).

---

### 4.3 `shape-interpreter` — TensorFlow.js Training & Prediction Service

**Purpose:** The ML core. Trains a neural network that maps a **9-dimensional emotion vector** to **22 shape parameters**, stores versioned models, serves predictions, and renders visual "snapshots" of its output during training.

**Stack:** Node.js, `micro` + `microrouter`, `@tensorflow/tfjs` + `@tensorflow/tfjs-node`, `@google-cloud/firestore`, `@google-cloud/storage`, `mathjs`, `ejs` + `puppeteer` (snapshots), `jwt-simple`. Deployable via Docker (`Dockerfile`, `heroku.yml`), pm2, or IBM Cloud Functions (`build.sh`).

**Configuration** (`lib/config.js`):

- **Source data:** Firestore project `shape-mapper`, collection `results`.
- **Feature/order vectors:** 22-dimensional `sort_order` — 12 geometry keys followed by 10 shape-type keys:

```
[sliderValueRotZ, sliderValueRotX, sliderValueRotY,
 sliderValueWidth, sliderValueLength, sliderValueHeight,
 sliderValueScale, sliderValueRadius,
 sliderValueHue, sliderValueLightness, sliderValueOpacity, sliderValueMatte,
 box, cone, cylinder, dodecahedron, ellipsoid, plane,
 icosahedron, torus, octahedron, tetrahedron]
```

- **TensorFlow settings:** `input_size: 9`, `output_size: 22` (12 geometry + 10 shape logits; 12 if `include_shapes` is false), `batch_size: 350`, `learning_rate: 0.01`, `totalEpochs: 3000`, `snapshot_interval: 1000`, `loss_history: 100`, `model_name: 'shaper'`.
- **Outlier handling:** `stats.bound_multiplier: 1` — per-emotion, per-parameter bounds are `median ± (1 × std)`; training samples are clamped to these bounds.

**Training pipeline** (`lib/modeler.js`):

1. Read all documents from Firestore `results`.
2. For each *completed* record, build a training pair:
   - **x** = one-hot emotion vector (the emotion `title` → `1` in a 9-dim vector).
   - **y** = 12 geometry values (clamped to statistical bounds) **concatenated with** a one-hot shape vector (the chosen `shape` → `1`).
3. Shuffle the dataset and train in batches of 350 over up to 3000 epochs.
4. Every `snapshot_interval` iterations, render snapshot images of current predictions (see below).
5. On completion, save the model to `model/shaper-<version>/`, upload `model.json` + `weights.bin` to Google Cloud Storage, then increment `version.tag` and upload it. Version **N** is the current published model; the trainer writes version **N** and bumps to **N+1**, while inference downloads the latest *published* version (`version - 1`).

**Model architecture** (feed-forward, in `createModel()`):

```
Input (9)  → Dense(144, linear) → LeakyReLU → Dropout(0.25)
           → Dense(72,  linear) → LeakyReLU → Dropout(0.25)
           → Dense(36,  linear) → LeakyReLU → Dropout(0.25)
           → Dense(22,  relu)
Optimizer: Adamax(lr=0.01)   Loss: meanSquaredError   Metrics: accuracy
```

**Endpoints:**

| Method | Route | Behavior |
|---|---|---|
| GET | `/` | Banner + current model version from `version.tag` |
| POST | `/makePrediction` | Body `{ array: [9 numbers], jwt }` → returns predicted shape parameters + shape-type probabilities |
| POST | `/updateModel` | Triggers a full retrain from Firestore (long-running) |
| POST | `/getModel` | Loads and returns the latest model object |
| POST | `/manualUpload` | Manually uploads current `version.tag` + model files to GCS |
| GET | `*` | Serves static files from `snapshot/output/` (via `serve-handler`); `/index` rewrites to the snapshot index |
| OPTIONS | `*` | CORS preflight |

**Prediction response shape:**

```json
{
  "sliderValueRotZ": 0.31, "sliderValueRotX": … , "sliderValueRotY": …,
  "sliderValueWidth": … , "sliderValueLength": … , "sliderValueHeight": …,
  "sliderValueScale": … , "sliderValueRadius": …,
  "sliderValueHue": … , "sliderValueLightness": …,
  "sliderValueOpacity": … , "sliderValueMatte": …,
  "shapes": { "box": 0.02, "cone": 0.11, …, "tetrahedron": 0.05 },   // 10 probabilities
  "modelVersion": "shaper-6"
}
```

(The first 12 entries of the 22-dim output are mapped to geometry keys; the remaining 10 are exposed as `shapes`.)

**Snapshot rendering:** During training, predicted outputs are rendered to PNG images using a p5.js WebGL sketch (EJS template `snapshot/p5sketch.ejs`) captured by headless Puppeteer into `snapshot/output/<model>-<version>/`. These provide a visual log of how the model's aesthetic output evolves per emotion.

---

### 4.4 `shape-constructor` — Generative Visualization Frontend

**Purpose:** The end-user experience. The user types arbitrary text; the system produces a 3D *totem* — a vertical stack of one shape per sentence — where every shape encodes the emotional content of its sentence.

**Stack:** React (Create React App), A-Frame (WebXR/VR), `aframe-effects`, `axios`, `color-convert`, `sbd` (sentence tokenizer). Deployed on ZEIT Now.

**Pipeline (`src/components/TextInput.js` → `src/lib/emo.js` → `src/lib/totem.js` → `src/components/Shape.js`):**

1. **Tokenize** the input text into sentences with `sbd`.
2. For each sentence, POST to `shape-decoder` `/analyse-text` (URL from `REACT_APP_DECODER_URL`, JWT from `REACT_APP_JWT`).
3. **Normalize** each parsed response into a 9-dim emotion vector (`emo.js`):
   - Map `detectedEmotions[].tone_id` → score at its fixed index:
     `[anger, fear, joy, sadness, analytical, confident, tentative, negative, positive]`
   - Positive sentiment → index 8; negative sentiment → index 7 (absolute value).
4. For each emotion vector, POST to `shape-interpreter` `/makePrediction`.
5. **Translate** the prediction into an A-Frame entity (`totem.js`):
   - `primitive` = argmax over the 10 shape probabilities (`ellipsoid` → `sphere` for A-Frame).
   - `color` = HSV → hex from predicted hue/lightness (saturation fixed at 65).
   - Scale, radius, width, height, depth, rotations, opacity, gloss (`1 − matte`) mapped from predictions.
6. **Compose the totem** (`Shape.js`):
   - Shapes are stacked vertically; each shape's Y position derives from the accumulated height of shapes below it, modulated by the emotional *difference* between consecutive sentences (`1 − |avg emotion delta|`).
   - Shape size is modulated by the relative length of its sentence (word count vs. average).
   - The scene includes soft shadows (PCF), ambient + point lights, a light background, and a slow looping rotation animation per entity.

The result is an expressive, data-driven sculpture that reflects the emotional arc of the input text.

---

### 4.5 `shape-consumer` — Text-Analysis Explorer (Prototype)

**Purpose:** A minimal front end used to explore and debug `shape-decoder` output. Likely the earliest experiment in the project.

**Stack:** Vue 2 (CLI), `sbd`, lodash `debounce`.

**Behavior (`src/components/Input.vue`):**

- Debounced textarea input (500 ms).
- Splits text into sentences and POSTs each to `http://localhost:3000/analyse-text` (assumes a local `shape-decoder`).
- Renders, per sentence: the sentence text, sentiment score, dominant emotion (`tone_name` + score), dominant entity (`name` + salience), and raw response JSON.

**Status:** Development aid; not part of the production generation pipeline.

---

### 4.6 `shape-renders` — Offline Rendering (Blender)

**Purpose:** High-fidelity, offline 3D renders of the shapes/assemblies for presentation and research.

**Stack:** Blender (`.blend` scene files) with exported PNGs; Git LFS-tracked binaries.

**Contents:**

| File | Description |
|---|---|
| `allfeels, inbetweeners.blend` / `leavesofgrass.blend` / `review.blend` / `scened_defaults.blend` | Blender scenes |
| `exports/4k.png`, `exports/a2_song_of_myself.png`, `exports/allfeels*.png`, `exports/ebert.png`, `exports/untitled.png` | Rendered images |

File names reference literary source texts (Walt Whitman's *Song of Myself*, *Leaves of Grass*), consistent with the constructor's text→shape generation use case. This repo is the "render farm" counterpart to the browser-based A-Frame rendering.

---

## 5. Cross-Service Contracts

### 5.1 Authentication

- **Service-to-service:** `shape-decoder` and `shape-interpreter` require a JWT signed with a shared `JWT_SECRET`, passed in the JSON body as `jwt`.
- **Frontend → services:** `shape-constructor` carries the JWT in env vars (`REACT_APP_JWT`) and forwards it with each request.
- **Client → Firestore:** `shape-mapper` uses Firebase **anonymous authentication** for Firestore writes.
- CORS: both microservices respond to preflight and set `Access-Control-Allow-Origin: *`.

### 5.2 The 9-Dimension Emotion Vector (shared vocabulary)

Fixed order shared by `shape-mapper` (block order), `shape-constructor` (`emo.js`), and `shape-interpreter` (`emotion_defaults`):

```
0 anger | 1 fear | 2 joy | 3 sadness | 4 analytical | 5 confident | 6 tentative | 7 negative | 8 positive
```

### 5.3 The 22-Dimension Shape Vector

Fixed order shared by `shape-mapper` (slider keys + shape names), `shape-constructor` (`totem.js` consumption), and `shape-interpreter` (`firestore.sort_order`):

```
12 geometry: rotZ, rotX, rotY, width, length, height, scale, radius, hue, lightness, opacity, matte
10 shape types: box, cone, cylinder, dodecahedron, ellipsoid, plane, icosahedron, torus, octahedron, tetrahedron
```

### 5.4 The 10 Primitives

`Box, Cone, Cylinder, Dodecahedron, Ellipsoid, Plane, Icosahedron, Torus, Octahedron, Tetrahedron`

Polyhedra (Dodecahedron, Icosahedron, Octahedron, Tetrahedron) are represented by OBJ models stored in `shape-mapper/public/models/` and embedded as vertex data in the interpreter's p5 snapshot template.

---

## 6. Data Model

### Firestore (Google Cloud, project `shape-mapper`)

**`results` collection** (production) / `results_dev` (localhost):

```jsonc
{
  "title": "Sadness",              // emotion attribute (block title)
  "shape": "Cylinder",             // chosen primitive
  "data": {                        // 12 slider parameters (see §4.2)
    "sliderValueRotX": 210, "sliderValueRotY": 33, "sliderValueRotZ": 180,
    "sliderValueWidth": 87, "sliderValueLength": 64, "sliderValueHeight": 52,
    "sliderValueScale": null, "sliderValueRadius": null,
    "sliderValueHue": 232, "sliderValueLightness": 71,
    "sliderValueOpacity": 42, "sliderValueMatte": 1
  },
  "userId": "<anonymous uid>",
  "modified": "<timestamp>",
  "completed": true
}
```

Document ID: `<userId><title lowercase, no whitespace>`.

### Google Cloud Storage (bucket `shape-mapper`)

```
version.tag                     # integer, current published model version
model/shaper-<v>/model.json     # TFJS model topology
model/shaper-<v>/weights.bin    # TFJS weights
```

### Local filesystem (`shape-interpreter`)

```
model/shaper-<v>/model.json, weights.bin   # working copy during training
snapshot/output/shaper-<v>/<timestamp>-<title>.png   # rendered training snapshots
version.tag
```

---

## 7. Data / Control Flow Summary

| Phase | From | To | Payload |
|---|---|---|---|
| Collect | `shape-mapper` | Firestore `results` | `{title, shape, data[12], completed}` |
| Decode | `shape-constructor` | `shape-decoder` `/analyse-text` | `{jwt, text}` |
| Decode response | `shape-decoder` | `shape-constructor` | `{text, detectedEmotions[], sentiment, entities[]}` |
| Normalize | `shape-constructor` | *(internal)* | 9-dim emotion vector |
| Predict | `shape-constructor` | `shape-interpreter` `/makePrediction` | `{jwt, array[9]}` |
| Predict response | `shape-interpreter` | `shape-constructor` | 12 geometry values + `shapes{}` + `modelVersion` |
| Render | `shape-constructor` | *(A-Frame scene)* | 3D totem entities |
| Learn | `shape-interpreter` | Firestore `results` (read) → GCS (write) | versioned `shaper-<v>` model |
| Snapshot | `shape-interpreter` | `snapshot/output/` (static) | p5.js → Puppeteer PNGs |

---

## 8. Technology Stack Summary

| Layer | Technology |
|---|---|
| Microservice framework | ZEIT `micro`, `microrouter` |
| ML | TensorFlow.js (`tfjs` + `tfjs-node`), Adamax optimizer |
| NLP providers | IBM Watson (Tone Analyzer, NLU), Google Cloud Natural Language, Microsoft Azure Text Analytics |
| Data stores | Google Cloud Firestore, Google Cloud Storage |
| Front end (generator) | React 16 + A-Frame 0.9 + `sbd` + `color-convert` |
| Front end (collector) | Vue 2 + TypeScript + Vuex + p5.js + vue-slider-component |
| Front end (explorer) | Vue 2 + `sbd` + lodash |
| Rendering | Browser A-Frame WebGL; offline Blender (Git LFS) |
| Auth | JWT (service-to-service), Firebase anonymous auth (client) |
| Deployment | ZEIT Now, Heroku (Docker), IBM Cloud Functions (OpenWhisk), pm2 |

---

## 9. Deployment & Operations

- **`shape-decoder`**: ZEIT Now (`now.json` with secret-backed env vars). Local: `micro-dev`.
- **`shape-interpreter`**: 
  - Docker (`openwhisk/action-nodejs-v10` base) for Heroku (`heroku.yml`) or any container host.
  - `Procfile`: `web: npm start` (`micro -l tcp://0.0.0.0:$PORT`).
  - IBM Cloud Functions via `build.sh` (zips code excluding `@tensorflow/**` and `puppeteer/**`, uploads to `kodhage/action-nodejs-v8:tfjs` action image).
  - `pm2` for process management (`npm run serve`).
- **`shape-mapper`**: ZEIT Now; also compiles to a **Web Component** for embedding (`npm run wc`).
- **`shape-constructor`**: ZEIT Now (`now ./build` + alias).
- **`shape-consumer`**: local dev only (expects `shape-decoder` on `localhost:3000`).
- **`shape-renders`**: local Blender workflow; large binaries via Git LFS.

**Environment variables:**
- `shape-decoder`: `WATSON_NLU_API_KEY`, `WATSON_NLU_URL`, `WATSON_TONE_API_KEY`, `WATSON_TONE_URL`, `GOOGLE_APPLICATION_CREDENTIALS` (base64 JSON), `AZURE_TEXT_ANALYTICS_KEY_1/2`, `AZURE_URL`, `JWT_SECRET`.
- `shape-interpreter`: `JWT_SECRET`, `G_PRIVATE_KEY`, `G_CLIENT_EMAIL` (Firebase service-account key material; project `shape-mapper`).
- `shape-mapper`: `VUE_APP_FIREBASE_*` (API key, auth domain, DB URL, project ID, storage bucket, sender ID), `VUE_APP_URL` (asset host), `VUE_APP_ENV`.
- `shape-constructor`: `REACT_APP_DECODER_URL`, `REACT_APP_INTERPRETER_URL`, `REACT_APP_JWT`.

---

## 10. Current State, Limitations & Future Work

**Observations from the code (as committed):**

- **Prototype maturity.** All services are functional but early-stage: comments note TODOs ("To be refactored to separate training / predicting"), hard-coded localhost URLs, and WIP feature flags (`include_shapes`, commented-out provider calls).
- **Model versioning quirk.** Inference downloads the model for `version - 1` while training writes the current version and bumps the tag afterwards, with a fixed 5.5 s delay to keep versions aligned — a fragile synchronisation pattern.
- **Training data dependency.** Model quality depends entirely on the volume and completion rate of `shape-mapper` submissions (only `completed: true` records are used).
- **Outlier clamping.** With `bound_multiplier: 1`, roughly a third of any normal distribution falls outside `median ± 1σ` and gets clamped — intentional but worth revisiting.
- **Single-sample one-hot inputs.** The model input is a one-hot emotion vector (no intensity), so the emotion *intensity* from the decoder is currently binarized for training.
- **`shape-consumer`** is a prototype/explorer and is not wired into the production flow.
- **`shape-renders`** is a manual, offline render step (not automated from model output).

**Suggested future work (per the repo notes):**
1. Split `shape-interpreter` into separate *training* and *serving* services.
2. Make the emotion→shape mapping support multimodal inputs (the decoder README already anticipates this).
3. Automate the Blender rendering pipeline from live model output.
4. Replace the version-tag/bump handshake with a proper model registry.
5. Add continuous evaluation (e.g., compare snapshots across model versions).

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Totem** | The stacked 3D sculpture of shapes generated by `shape-constructor`, one shape per input sentence. |
| **Emotion vector** | Fixed 9-dim vector: anger, fear, joy, sadness, analytical, confident, tentative, negative, positive. |
| **Shape vector** | Fixed 22-dim output: 12 geometry/material params + 10 primitive logits. |
| **Primitive** | One of the 10 basic 3D geometries used across all services. |
| **Snapshot** | PNG render of a predicted shape produced by the interpreter during training (p5.js + Puppeteer). |
| **`version.tag`** | File holding the current model version integer, synced to GCS. |

---

*This specification was produced by analysing the six repositories (`shape-constructor`, `shape-interpreter`, `shape-renders`, `shape-decoder`, `shape-mapper`, `shape-consumer`) under the `KODHAGe` GitHub organization. All technical details reflect the committed source code.*

---

## Cross-Reference

- **Conceptual framing** — for the *why* of this system — see
  **[`CONCEPT.md`](./CONCEPT.md)**, *Beyond Shape — Conceptual Framework: Sign,
  Machine, and Form*. This document is the *how*; that document is the *what it
  is*.
