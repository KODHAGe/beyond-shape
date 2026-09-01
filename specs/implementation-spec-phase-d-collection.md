# Implementation Spec — Phase D Slice 1: Collection (D1 + D2 + D3)

Status: **SHIPPED** (consensus-approved draft → built as specified, 2026-08-31)
Owner: Tech Agent · Date: 2026-08-31

> Human decisions (2026-08-31): licence **CC BY-SA**, store the **text too**
> (the crowd's words are re-readable in the living archive); build **D1 + D2 +
> D3** end-to-end against Cloudflare (D1 / thin Worker write path / R2 not
> required for this slice).
> The DR rules (§ requirements) are load-bearing and must pass the Requirements
> lens (DR-1..DR-3) — never built without it (EXECUTION-PLAN invariant).
> **Deploy note (infra as code):** `infra/terraform/main.tf` owns the D1
> database, the Pages project + its `DB` binding, and the schema migration.
> Apply once with `terraform init && terraform apply` (export
> `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, or source `./.cf.env`).
> Deploy the app with `npm run deploy:pages`. Local dev of the function uses
> `wrangler pages dev` with local miniflare D1 (wrangler.toml binding). The
> `vite preview` e2e suite mocks `POST /api/contribute`.

---

## 1. Scope

What this slice builds (verbatim from requirements):
- **D1 — corpus schema + edge write path.** D1 `contributions` table (DR-1:
  anonymous contributor id, input text, accepted form parameters, consent flag,
  timestamp, accept/adjust/reject gradient; FR-20's `accept/adjust/reject`
  gradient); append-only (DR-3). Thin Pages Function `POST /api/contribute`.
- **D2 — consent UX.** One plain-language opt-in (DR-2): "a collective artwork,
  published openly under CC BY-SA; nothing is sent unless you opt in". The
  write is gated on consent; no implicit network calls (privacy audit LR-8
  keeps passing — the app never POSTs unless the visitor opts in and shares).
- **D3 — co-creation loop** (FR-16). After a form is generated the visitor
  judges it: **accept / adjust / reject**. Adjust regenerates (a new sample,
  "every move a gradient sample"); accept/reject submit a gradient row with the
  judged form parameters. The loop is the crowd's hand on the machine.

Requirements: FR-16, FR-17, FR-20 (DR-1..DR-3), C6, C8, CR-2/CR-4/CR-6.

## 2. Requirement trace

| Requirement | Acceptance test (how we verify) | ADR if any |
|---|---|---|
| DR-1 corpus schema | a POST with consent inserts exactly the DR-1 fields; missing any field → 400 (unit: handler with mocked `env.DB`) | — |
| DR-2 consent & licensing | consent_flag=0 is rejected server-side; plain-language copy present; text_sha256 computed client-side; app never POSTs without the opt-in + active "share" (privacy e2e) | — |
| DR-3 append-only | the handler only INSERTs — no UPDATE/DELETE path; deletion is documented as a future path (§8) | — |
| FR-16 co-creation loop | accept/adjust/reject present after a run; adjust regenerates; accept/reject submit a gradient row (e2e/unit) | — |
| FR-17 explicit consent | the consent control is a separate, non-defaulted act; no contribution without it | — |
| FR-20 per-contribution record | row carries input text, form params, consent flag, anon id, ts, gradient | — |
| C6 convention-crystallizer | contributions are the crowd's readings; aligner (D4) consumes them later | — |
| C8 local-first / privacy | the generated form is local; only the opted-in contribution (text + form) leaves; nothing else (privacy e2e) | — |
| CR-2/CR-4/CR-6 ≈$0 / browser monolith / privacy | no always-on server; thin Pages Function; no client keys; D1 free tier | — |

## 3. Technical decisions (bindings)

- **D1 table `contributions`** (DDL in `schema/schema.sql`), append-only:
  `id TEXT PK · created_at INTEGER ms · contributor_anon_id TEXT ·
  input_text TEXT · text_sha256 TEXT · form_params TEXT(json SdfParams) ·
  z TEXT(json) · draft REAL · seed INTEGER · gradient TEXT (accept|adjust|reject,
  CHECK) · consent_flag INTEGER CHECK 0/1 · fingerprint TEXT · register TEXT ·
  blend_mode TEXT`. `text_sha256` indexed (aggregation), NOT unique (append-only
  permits repeats).
- **Binding:** `wrangler.toml` `[[d1_databases]] binding = "DB"` +
  `database_name`/`database_id`; `migrations_dir = "schema"`. Local dev runs via
  `wrangler pages dev` (miniflare D1) + `wrangler d1 migrations apply DB --local`.
- **Edge function** `functions/api/contribute.ts` (thin, imports nothing from
  `src/`): `onRequestPost` → `await context.env.DB.prepare(INSERT).bind(...).run()`.
  Validates the payload; **rejects consent_flag=0** (400) and any missing field;
  returns `{ ok: true, id }`. Rate-limit note in §6 (documented, not built).
- **Anonymous contributor id:** client generates a UUID in `localStorage`
  (`bs:contributorId`), stable per device, no account — stated in the consent
  copy as "anonymous".
- **Gradient model:** `accept`/`reject` are terminal and submit a row (with the
  judged `form_params`); `adjust` regenerates locally and does NOT submit (a
  non-terminal sampling move). This is honest and non-spammy while satisfying
  "every move a gradient sample" (the accepted/rejected sample is the signal).
  `adjust` is reserved in the CHECK for future persistence of intermediate moves.
- **Copy (D2, plain-reader):** "this is a collective artwork. if you'd like,
  your sentence and the form it made can join the crowd — published openly
  under **CC BY-SA**. nothing is sent unless you opt in below." The share button
  is disabled until the opt-in is checked; the act is labelled "share to the
  crowd".

## 4. Interfaces

- Public: `POST /api/contribute` (Payload / Response below); D1 table as §3.
- Client: `contributions.ts` — `buildContribution(run, gradient)` → payload
  (pure, testable); `submitContribution(payload)` → fetch POST; `contributorId()`
  (localStorage-backed); `clearContribution()` after a successful share.
- Internal: `CoCreation` UI (accept/adjust/reject) mounted under the form
  viewport; type `ContribGradient = 'accept' | 'adjust' | 'reject'`.

### Payload / Response
```
POST /api/contribute
{ contributor_anon_id, input_text, text_sha256, form_params, z,
  drift, seed, gradient, consent_flag: 1, fingerprint, register, blend_mode }
→ 200 { ok: true, id }
→ 400 { ok:false, error } (consent=0 or missing field)
```

## 5. Data model

- `contributions` table only (this slice). No change to `models.json`, seed
  corpus, or `RunRecord` (the run is local; only the opted-in contribution
  leaves). `manifest` unchanged.
- The contribution's `form_params` is the **rendered** SdfParams (register +
  blend applied) so the crowd's accepted forms are reproducible from the
  parameters alone (FR-10 spirit).

## 6. Constraints & env

- Cloudflare Pages Free + D1 free tier; no paid path (CR-2). No secrets/client
  keys (CR-5). Thin function, no always-on server (CR-3/CR-6).
- Consent-gated by architecture: the client **never** auto-POSTs; the privacy
  e2e (LR-8, route-intercept requeue-whitelist) must stay green — only the
  opted-in contribution request is permitted.
- `contributor_anon_id` is device-pseudonymous; the copy states "anonymous".

## 7. Definition of done

- D1 schema + binding wired; `functions/api/contribute.ts` validates (consent
  gate) + INSERTs; locally verified with `wrangler pages dev` + local D1.
- Client: consent + share in the co-creation panel; accept/adjust/reject works;
  adjust regenerates; accept/reject submits once, then the panel settles
  ("in the crowd now").
- Unit tests: payload builder, consent-gate rejection (handler with mocked DB),
  missing-field 400, append-only (no UPDATE/DELETE in the handler).
- Privacy e2e stays green (no outbound request without opt-in+share).
- No open objections; DR rules trace intact (§2); deploy note written.

## 8. Out of scope (explicit)

- **D4 aligner** (the convention-crystallizer model) — next slice, consumes §5.
- **D5 weekly drift** (free-GPU LoRA + release note) — next slice.
- Deletion/consent-withdrawal path (DR-3 "documented future path"): documented
  in README, not built.
- Auth/accounts, moderation, rate-limiting enforcement, spam defense (documented
  as a future edge concern; the thin gate is validation-only).
- R2 media storage (shareable cards came in FR-22, later slice).

---

## 9. Consensus record (Stage 1 → Stage 2)

**Tech (Builder).** Feasible-free: D1 free tier + thin Pages Function; no
always-on path; cost verdict **feasible-free**. `input_text` stored per your
ruling — size is a future concern (a few MB/week, fine for D1 free; rate-limit
noted).

**Requirements (Translator).** Approve with amendments: (a) consent_flag is
server-enforced, not client-trust — the handler rejects `consent_flag=0`; (b)
`text_sha256` is computed client-side and included so the stored text is
integrity-checked; (c) the gradient CHECK enumerates `accept|adjust|reject`
and the client only submits terminal accept/reject — documented; (d) DR-3
append-only is structural (no UPDATE/DELETE in the handler); (e) the consent
copy must be one plain-language block, not a stack of toggles.

**Concept (Curator).** Approve with a condition: the crowd's contribution is
the visitor's *hand on the machine* (co-creation, FR-16) — the UI must present
it as shaping, not as "submit your data". The share act is a gift into the
living archive (C6), not telemetry. The sentence and its form are the artwork;
the opt-in must not read as a consent wall.

**Reflector (Memory).** **resonant** — this is the original's Mapper returned:
the designer shares agency with the crowd but keeps the higher-level
strategies (the loop is human-shaped; the register/drift stay the machine's).

**Render Reviewer.** No render-path change (the accepted form uses the existing
tiers); the co-creation panel must not re-create contexts — the shared
`getSolidMesh` cache covers it. Approve.

**Converged amendments (Stage 2):** all folded into §3/§4. No objects.
**Human rulings:** CC BY-SA · store the text too · D1+D2+D3 scope.