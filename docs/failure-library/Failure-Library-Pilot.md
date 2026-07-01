# External Failure Knowledge Base — Pilot

**Status: standard + fixtures + runnable pilot (docs + tests). No ingestion, no
external fetch, no decisions.** Everything is measurement / report; the corpus is
**illustrative** (standard, textbook failure modes, provenance-flagged) — no
invented chemistry. Specific provenance is attached at ingestion.

## Why this comes *before* ingestion

The MBM can already propose mechanisms, attribute uncertainty, plan experiments
and calibrate forecasts — but it barely knows the **failure space**. In industrial
R&D most innovation comes from understanding *why formulations failed, which
mechanisms collapsed, and which assumptions were wrong.* That is exactly the layer
that can enrich the MBM *before* the first real measurements — and the pilot's job
is to prove the external corpus is a **knowledge engine**, not just more documents,
so that investing in full ingestion is justified.

## What was built (a small pilot, per the mandate)

Not RAG, not search — a **uniform failure object**:

- `docs/failure-library/failure-case.schema.json` — the Failure Case standard
  (JSON Schema 2020-12). Fields: material system · failure mode · outcome
  (`failure` / `near_failure`) · conditions · observed symptoms · claimed
  mechanism · **cascade** (event sequence) · evidence quality · root cause
  (known/suspected/unknown) · **mappedMBM** (link into the model) · **brokenInvariant**
  · **antiConditions** (negative knowledge) · suggested experiment · confidence ·
  provenance (`illustrative` / `sourced`).
- `docs/failure-library/failure-fixtures.json` — **16 standard failure cases**
  across the four families the mandate named: intumescent, silicate, cementitious,
  polymer. Every case is a well-documented failure class (e.g. APP premature acid
  release → weak char → fire failure; carbonation → rebar corrosion; waterborne
  cure below MFFT → water ingress → adhesion loss), flagged illustrative.

Three engines over the corpus (`scripts/`, each with a self-consistency harness):

- `failure-schema-check.mjs` (`test:failure-schema`) — validates every case against
  the schema and checks **referential integrity to the MBM** (mapped states either
  exist or are legitimately new; competing-mechanism targets are real MBM
  transitions). Enforces provenance flags — no invented chemistry slips through.
- `failure-pattern-engine.mjs` (`test:failure-patterns`) — the **Failure Pattern
  Engine** mines recurring cascade motifs (n-grams in ≥2 cases), and **Negative
  Knowledge** extracts anti-condition boundaries, framed in FSCTM
  (Knowledge / Contradiction / Boundary / Law). Bite-tested: it does not invent
  motifs, and a "law" is emitted iff boundary conditions exist.
- `failure-mbm-pilot.mjs` (`test:failure-pilot`) — the capstone: runs the corpus
  against the live MBM and measures the three yields. Novelty is **derived**
  against the MBM, not declared by the cases.

## Pilot result (illustrative corpus, 16 cases)

| Yield | Count | Highlights |
|-------|------:|------------|
| **New competing mechanisms** | 8 | alternative explanations for `app_ppa1`, `app_xl2`, `app_direct`, `mech_1`, `photo_1`, `thermal_1`, `electro_1_coupled`, plus a new route `concrete:carbonated→steel:active` |
| **Better experiments surfaced** | 16 | **2 land on the MBM's *own* unvalidated links** (`app_xl2`, `app_direct`) — the corpus independently points at the model's weakest spots |
| **New ΔK** | 9 | new states (`app:char_oxidized`, `concrete:sulfate_expanded`, `epoxy:blushed`, `acrylic:delaminated`, silicate region), a **cross-subsystem coupling** concrete→steel, and a candidate broken law (`conservation_of_mass` on char oxidation) |
| Recurring failure motifs | 2 | `weak char → fire failure`, `water ingress → adhesion loss` |
| Negative-knowledge conditions | 25 | boundaries across all four families |

**Verdict: the external corpus GENERATES knowledge** — new competing mechanisms,
better experiments (some hitting the MBM's own weakest links), and genuine ΔK
(new states, a cross-subsystem coupling, a candidate broken law). The verdict is a
**recommendation, not a decision** — a human approves the next step.

The most telling result: without being told where the MBM is weak, the failure
corpus independently proposed a competing mechanism *and* a targeted experiment for
`app_xl2` — the exact hypothesized transition that Stage C's reliability engines
already flag as the APP route's weakest link. Two independent signals converging on
the same gap is what a scientific instrument should produce.

## The added ideas, folded in (no architecture sprawl)

- **Near-Failure Library** — `outcome: near_failure` + `margin`. Four "almost"
  cases (char cracking, low-humidity silicate cure, ASR, epoxy embrittlement) — the
  margin is where new mechanisms hide.
- **Failure Pattern Engine** — recurring cascades as reusable motifs.
- **Negative Knowledge** — anti-condition boundaries in FSCTM terms: not only
  *what works* but *under which conditions one must not operate*.

## Boundaries honoured

- ❌ no ingestion · ❌ no external fetch / engine run on external data · ❌ no
  decision (verdict is advisory) · ❌ no invented chemistry (standard failure
  classes, provenance-flagged illustrative) · ✅ new entity (Failure Case) passes
  the necessity test — it is the explicit deliverable, models genuinely new
  (failure) knowledge, and is bound into the MBM by mappedMBM/brokenInvariant.

## Recommended next step

Only *now* is full ingestion worth designing: attach real provenance
(source + dates) to failure cases, which activates C.14 Evidence Aging and turns
the C.10 observations from illustrative to real — and lets the deferred Stage-C
engines (C.6/C.7/C.11 + Surprise Analysis) run on sourced data.
