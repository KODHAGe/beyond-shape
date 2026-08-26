# Beyond Shape — Conceptual Framework: Sign, Machine, and Form

> **The conceptual companion to [`BEYOND-SHAPE-SPEC.md`](./BEYOND-SHAPE-SPEC.md).**
> Where the specification documents *what the system does* — its services,
> data flows, vectors, and training — this document distills *what the system
> is*: an art system exploring **sign–signifier relationships** through the
> lens of neural networks. The technical apparatus described in the spec is,
> read through this lens, the *operational proof* of the ideas below.

---

Between a signifier and a signified — between a shape and a feeling — there is
no natural bond, only an agreement. Beyond Shape is built on that gap. It is,
in its essence, a machine that makes the arbitrariness of the sign visible by
replacing convention with computation, and by letting a population's acts of
naming a feeling condense into a single generating form.

---

## 1. The semiotic premise

Following Saussure, the bond between a **signifier** (the form — a word, a
mark, a shape) and a **signified** (the concept — an emotion, a meaning) is
**arbitrary**. Nothing in the geometry of a cylinder says *sadness*; the
connection exists only because a community agrees it does. This arbitrariness
is usually treated as an inconvenience to be smoothed over or hidden. Beyond
Shape treats it as the **raw material of the work**.

Every act in the system is an act of signification:

- The mapper participant, confronted with the word *Sadness*, **invents** a
  form for it — an arbitrary act, like naming, like the first mark on a canvas.
- The neural network does not *discover* these links; it **aggregates** them.

The system refuses to pretend there is a real, discoverable shape for a
feeling. Instead, it stages the act of making that shape up — and watches what
happens when many acts of invention are pooled.

## 2. The chain of transcoding

The system is a signifying machine whose stages translate between
incommensurable sign systems:

```
language  ──▶  emotion taxonomy  ──▶  vector  ──▶  geometry  ──▶  totem
(text)        (9 named feelings)    (numbers)   (shape params)   (sculpture)
```

Each stage is a **lossy compression** of the one before it. A poem becomes nine
numbers becomes a stack of colored solids. The work stages the question of
**what survives, what is invented, and what is destroyed** in these crossings.
The totem is not the text's meaning — it is meaning's residue after being
forced through a series of arbitrary grammars.

Three of these compressions are particularly consequential and deserve their
own attention: the vector (§3), the convention-crystallizer network (§4), and
the constraint space that surrounds them (§5).

## 3. The vector as the central signifier

The 9-dimensional emotion vector is the pivot of the whole system: the point
where meaning becomes **computable, addressable, and mixable**. It is the
"immutable mobile" (Latour) — a trace of a sentence that can travel intact
between services, be stored, averaged, and fed to a network.

The vector is the **sign in numerical form**: a meaning stripped of language
but not yet given a shape. It is the empty slot where the arbitrary link gets
fixed — neither the word nor the form, but the *interval* between them,
rendered as numbers. Everything upstream of the vector is language; everything
downstream is geometry. The vector is the threshold where the sign crosses
from one medium of inscription to another.

## 4. The neural network as convention-crystallizer

The model does **not** learn "what sadness looks like". It learns *what a
population of sign-makers, constrained by an interface, agreed sadness could
look like*. Its weights are the **distilled memory of collective arbitrary
choices** — statistical convention.

This is precisely how linguistic convention arises: through repeated,
aggregated social usage. The network compresses a dataset of individual acts of
signification into a single averaged sign. In this sense the AI is a
**sign-aggregator, not a sign-author**:

- the **authority** of the sign remains human (it was humans who invented the
  links);
- the **fluency** is machine (it is the network that can now produce an
  infinite run of new forms from the residue).

The trained weights are, then, a living sign: the memory of a community's
significatory choices, condensed into a form that can generate. What the system
shows is that an AI does not produce meaning *ex nihilo* — it reproduces and
averages the meanings a community has already, arbitrarily, produced.

## 5. The constraint space as hidden author

The sign is never invented in a vacuum: the mapper can choose among 10
primitives and 12 slider parameters. This interface **is a grammar** — it
delimits everything that can be said. The model inherits the bias of the tool:
an emotion can only ever become one of ten shapes, within fixed ranges, in a
limited palette of hue and light.

The system therefore makes visible a truth usually hidden: *every sign system
is a constraint system*, and every act of meaning is made within — and shaped
by — the limits of its medium. Freedom of signification is always freedom
*within* a grammar. The artwork is bounded even as it is generative, and that
bounding is not a bug of the system but a condition of all signification.

## 6. The totem as spatialized writing

The output reads text as **rhythm rather than semantics**. Each sentence
becomes one shape; the stack reproduces the emotional *movement* of the text —
size encodes emphasis, vertical position encodes emotional drift between
sentences, color and opacity encode affective tone.

The totem is **prosody made plastic**: an automatic, three-dimensional writing.
It cannot be read back into the original words, only into a new experience of
their cadence. A joyful sentence is not *described* by the totem; it is *felt*
as a form — the sentence's emotional pulse given bulk, surface, and light.

## 7. Reading as re-signification

The generated form carries no fixed meaning. The viewer re-signifies it —
bringing their own history to a colored tetrahedron that the machine aggregated
from strangers' choices. Meaning is not located in the text, nor in the vector,
nor in the shape, nor in the model that made it: it is re-enacted in each act
of looking.

Where deterministic systems claim to reproduce meaning, Beyond Shape produces
**ambiguity by design**: it aggregates the arbitrary and thereby generates
forms that exceed any single intention. The sculpture is not a statement but an
invitation — an object that functions as a screen onto which the viewer's own
signification is projected.

## 8. The feedback loop of signification

The system is a loop, not a line:

```
human act of signification   (mapper: emotion → form)
        │
        ▼
dataset of arbitrary links   (Firestore)
        │
        ▼
statistical aggregation      (the network: weights = distilled convention)
        │
        ▼
automatic generation         (constructor: text → totem)
        │
        ▼
human reading                (viewer re-signifies the form)
        │
        └─────────── (potentially) new data / new significations ──────────┘
```

It stages the *social* production of the sign in accelerated, statistical form
— an **exquisite corpse executed at the scale of a dataset**. Each turn of the
loop compounds the arbitrary: human invention seeds the network, the network
averages and generates, and the generation invites new human readings that
could, in turn, become new data.

## 9. What "Beyond Shape" means

The name names the operation. The system produces **neither the word nor the
thing, but a third thing** — the statistical ghost of the sign: a form
generated from the residue of collective signification, exceeding any single
intention.

*Beyond shape* reads three ways at once:

- **beyond the given form** — the network can generate forms no participant
  individually specified;
- **beyond the shape of the word** — meaning passes out of language into
  geometry;
- **beyond the fixed sign** — the arbitrary, once imported into statistics,
  becomes capable of producing the unforeseen.

The sign is exceeded: what emerges is an emergent, averaged, generative form
that no one specified but everyone (statistically) implied.

---

## 10. Distilled

> **Beyond Shape is a machine that makes the arbitrariness of the sign visible
> by replacing convention with computation — and by letting a population's acts
> of naming a feeling condense into a single generating form.**
