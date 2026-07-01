# Runbook — Real P0.1 (one real dataset, mechanical & safe)

**Purpose:** make the first *real* flight a mechanical, safe procedure. Everything
it needs already exists; this runbook is the checklist. The engine is not changed —
the operator supplies two files and runs one command.

> Boundary: real P0.1 requires two things the system cannot self-provide (by
> design) — a **real measured TGA/DSC curve** and **real human sign-off**. This
> runbook is how a person supplies them.

---

## 1. Which file the human uploads

Two JSON files, validated by existing schemas:

| File | Schema | What it is |
|------|--------|------------|
| `docs/first-flight/dataset-XXX.json` | `first-flight/v1` (see `dataset-001-app-per-mel.json`) | the **measured curve**, transcribed to observations |
| `docs/first-flight/ingest-request-XXX.json` | `ingestion-request.schema.json` | the **provenance + sign-off** wrapper |

In the dataset file the operator fills, from the real instrument run:
- `system`, `domain`, `mbmEndpoints` (from/to MBM states)
- `assumptions[]` — the actual run conditions (atmosphere, heating rate); set
  `holds: true/false` honestly
- `observations[]` — each real TGA/DSC feature: `{technique, kind, tempC, magnitude}`;
  add `contextDependent` to any feature that only appears under a changed condition
- `expectedTransitions[]` — the literature/model expectation for accuracy scoring
- `flag`: `"sourced"` once the curve is real (not `"illustrative"`)

---

## 2. Which anchors the human fills (the anti-invented-chemistry gate, G4)

In the ingest-request, **every scientific claim needs a confirmed citation anchor**.
For each of `claimedMechanism`, `observedSymptoms`, `mappedMBM`, `antiConditions`
(when present), add to `citationAnchors[]`:

```json
{ "field": "claimedMechanism", "locator": "<page/section/figure>",
  "quote": "<verbatim span from the source>", "confirmed": true }
```

- `locator` + `quote` must come from the **real source** (paper DOI, standard
  edition, report). Paraphrase is not a verbatim span.
- `confirmed: true` is set **only after a human has checked** the span supports the
  claim. No anchor ⇒ the claim is treated as invented chemistry ⇒ flight blocked.

Also fill `rawSource` (`type`, `identifier`=DOI/designation, `title`, `year`,
`license`, `accessRights`) and `evidenceQuality` (a real tier, not `illustrative`).

---

## 3. Who signs

Dual control — **two distinct people**:

| Role | Gate | Confirms |
|------|------|----------|
| Provenance reviewer (`provenanceReview.reviewer`) | G2 | source identifier + exact edition/DOI |
| Domain reviewer (`mbmMapping.confirmedBy`) | G5 | the mapping into the MBM |
| Both, in `signoff` | G6 | `reviewer1` ≠ `reviewer2`, `status: "signed"` |

Set `provenanceReview.status: "confirmed"`, `identifierConfirmed`,
`editionOrDoiConfirmed`. The submitter (G1) is the human who uploads.

---

## 4. How `gatedFlight` runs

```bash
node scripts/p0-1-gated-flight.mjs \
  docs/first-flight/dataset-XXX.json \
  docs/first-flight/ingest-request-XXX.json
```

The runner: evaluates the request against **G1–G6**; **only if promotable** does it
run the first-flight harness; then prints the gate line, the post-flight summary,
and a **VERDICT** (exit 0 = PASS, exit 1 = STOP). It never promotes on its own and
never fetches.

(No-argument run = the built-in self-test / demo, wired as `test:p0-1-gated`.)

---

## 5. What counts as PASS / STOP

`passStop()` turns the run into one verdict (a gauge for a human, not an
auto-action):

| Verdict | When | Meaning |
|---------|------|---------|
| **PASS** | all gates ✓ · `accuracy ≥ 0.5` · no corpus-flagged surprise · not a new region | record the observations (still **no promotion** — Corroborated needs ≥3 independent datasets, ≥2 techniques) |
| **STOP** | any gate ✗ (blocked) · `newRegion` (no MBM route) · `accuracy < 0.5` · a surprise cross-flagged against the failure corpus | route to a human + Experiment Planner (C.4) before recording |

STOP is not failure — it is the system correctly asking for a human. (The demo APP
run returns **STOP**, because its 350 °C surprise is corpus-flagged to
`fail_app_char_oxidation` — exactly the safety escalation we want.)

---

## After a PASS

1. Observations are recorded (flag `sourced`); **nothing is promoted**.
2. Repeat with ≥3 independent datasets **and** ≥2 techniques → epistemic state may
   move `Hypothesized → Corroborated` (C.9).
3. Real observations replace C.10's illustrative outcomes → calibration/learning
   (C.5) become real; C.14 Evidence Aging activates on real dates.
4. Any contradiction is kept (C.13) and traceable via the provenance ledger.

## After a STOP

1. Read the reason. If a **gate** failed → fix provenance/anchors/sign-off and
   re-run (mechanical). If a **surprise/new region** → hand to the Experiment
   Planner (C.4); the surprise becomes a proposed new path / Failure Case, never a
   silent model edit.
2. No model change happens without human sign-off. The STOP is the guardrail.

---

**One-line summary:** upload two files → a person anchors every claim and two
people sign → `gatedFlight` flies only if G1–G6 clear → PASS records observations
(no promotion), STOP routes to a human. That is the whole of real P0.1.
