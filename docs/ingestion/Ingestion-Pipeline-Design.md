# Failure-KB Ingestion Pipeline — Design (design only)

**Status: DESIGN ONLY — a contract + gate check. No ingestion, no fetch, no broad
corpus.** This is the step between the simulator (illustrative + standards-grounded
pilots) and the field (real sourced ingestion). It specifies *how a human turns a
real source into a grounded Failure Case* — and encodes the gates as a checkable
function (`scripts/ingestion-design-check.mjs`, `test:ingestion-design`) whose
every gate is proven to bite.

## Design goals (from the mandate)

- how a human attaches a real source
- how an edition / DOI is confirmed
- how evidence quality is marked
- how invented chemistry is prevented
- how a piece of evidence becomes a grounded Failure Case

## Principle: human-in-the-loop, dual-control, attribution-first

The engine never fetches, never auto-accepts, and never generates chemistry. It
*proposes*; humans *verify*; two humans *sign off*. Every scientific claim must
trace to a verbatim span in the source — extraction is proposal-only.

## Stages & gates

```
[Submit] → [Provenance review] → [Evidence grade] → [Extract + anchor]
        → [MBM map] → [Dual sign-off] → [Promote] → [Post-ingestion calibration]
```

1. **Intake (G1 human submitter).** A person submits an Ingestion Request
   (`ingestion-request.schema.json`) referencing a real source. No auto-fetch,
   no anonymous/automated submission.
2. **Provenance review (G2).** A reviewer confirms the source *identifier* and the
   *exact edition/DOI*. Records `license`/`accessRights` before any text is stored.
   Unconfirmed provenance ⇒ blocked.
3. **Evidence grading (G3).** Assign an `evidenceQuality` tier by a documented
   rubric (`instruments > standard > scientific_paper > patent > field_report >
   anecdotal`); attach real dates → feeds **C.14 Evidence Aging**. Still
   `illustrative`/null ⇒ blocked.
4. **Extraction + citation anchoring (G4 — the anti-invented-chemistry gate).**
   Map the source into Failure Case fields. **Every scientific claim carries a
   confirmed citation anchor** — `{field, locator, verbatim quote, confirmed}`. A
   present claim with no confirmed anchor is treated as invented chemistry and is
   rejected. (This mirrors the repo's existing attribution discipline —
   `check:attribution-document-flow`, `check:pre-llm-gate`.)
5. **MBM mapping (G5).** Link to the model (`mappedMBM`); novelty (new state /
   transition / competing mechanism) is *derived* against the live MBM (the pilot
   logic), then a human confirms the mapping.
6. **Dual-control sign-off (G6).** Two **distinct** reviewers sign
   (provenance ✓, anchors ✓, mapping ✓). Single-reviewer ⇒ blocked. (Mirrors
   `verify:scope-signoff` / `verify:david-checklist`.)
7. **Promotion.** Only G1..G6 all-pass flips the case flag `illustrative → sourced`
   and admits it to the KB. Anything less stays **quarantined**.
8. **Post-ingestion calibration.** Real observations now exist: **C.10** replaces
   illustrative `simulateObserved` with the actual ΔMRI; **C.5** updates
   correction factors; **Surprise Analysis** (deferred) flags sourced results that
   refute an MBM prediction; **C.13 Contradiction Memory** keeps them.

## Reversibility & governance

- **Quarantine/rollback:** a retracted or superseded source demotes its cases
  (`sourced → quarantined`); `C.14 lastValidation` drives re-validation prompts.
- **Decision Boundary:** promotion feeds *evidence*, never a decision. **C.6
  Reliability-Gated Decision Hand-off** (deferred) enforces that a low-MRI /
  non-`Confirmed` case cannot be emitted as fact.
- **Licensing/PII:** `license`/`accessRights` are recorded at intake; unlicensed
  text is not stored.

## What the gate check proves (no ingestion run)

`evaluateIngestionRequest(req)` returns `{promotable, gates, reasons}`. The harness
runs one fully-valid **design fixture** (illustrative of a request — no real source
fetched) and seven **bite tests**, each disabling exactly one gate and asserting
promotion is blocked — including the crux: an unanchored mechanism (invented
chemistry) and unconfirmed anchors both fail G4.

## Boundaries honoured

❌ no ingestion · ❌ no fetch · ❌ no broad corpus · ❌ no auto-acceptance · ❌ no
invented chemistry (attribution-first, gate-enforced) · ✅ design contract +
checkable, biting gates only.
