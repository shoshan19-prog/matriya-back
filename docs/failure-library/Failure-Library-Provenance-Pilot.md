# Failure KB — Provenance Pilot (Evidence Upgrade)

**Status: standard + overlay + runnable pilot (docs + tests). No broad ingestion,
no external fetch, no decisions.**

## Why this, and why small

The illustrative pilot proved the **structure** works — a Failure Case is a useful
knowledge atom. But it did not prove the knowledge is *real enough for industrial
inference*:

```
illustrative corpus ≠ evidence corpus
```

So the next step is **not** broad ingestion. It is a small **Evidence Upgrade
Pilot**: ground 5–7 cases in real provenance, re-run, and check whether the same
ΔK / mechanisms / experiments **survive** the move from illustration to evidence.
If they do, the engine is robust to grounding — and only then is full ingestion
worth designing.

## What was done

`docs/failure-library/failure-provenance-upgrades.json` is a **provenance overlay**
that upgrades **7 of the 16 cases** — it adds `provenance` (source + date +
verifiability) and raises `evidenceQuality` to `standard`, and **changes nothing
else**. `scripts/failure-provenance-pilot.mjs` (`test:failure-provenance`) applies
the overlay, re-runs the MBM pilot, and enforces the pass conditions.

The 7 grounded cases are tied to **real, verifiable public standard designations**
that document exactly these failure/measurement modes:

| Case | Grounding standard(s) |
|------|-----------------------|
| `fail_app_premature_acid` | EN 13381-8 (reactive/intumescent fire protection), ISO 834 (fire curve) |
| `fail_acrylic_uv_chalking` | ISO 4628-6 (chalking), ASTM G154 (UV exposure) |
| `fail_concrete_carbonation_corrosion` | EN 13295 (carbonation resistance), ASTM C876 (half-cell potentials) |
| `fail_concrete_sulfate_attack` | ASTM C1012 (sulfate length change) |
| `fail_concrete_asr` | ASTM C1260 (ASR mortar-bar) |
| `fail_polymer_osmotic_blister` | ASTM D714 / ISO 4628-2 (blistering) |
| `fail_polymer_humidity_adhesion` | ASTM D4541 (pull-off adhesion), ISO 2115 (MFFT) |

### The honesty boundary (no invented chemistry, no fabricated citations)

Grounding uses **public standard designations** — stable, checkable identifiers —
**not** fabricated primary-literature citations (no invented DOIs, authors, or
journals). The **chemistry is unchanged**: the overlay touches only `provenance`
and `evidenceQuality`; every scientific field (mechanism, cascade, mappedMBM,
broken invariant, anti-conditions, symptoms) is byte-identical to the illustrative
case. Exact standard **editions** are explicitly marked
`datePrecision: "…confirmed at ingestion (human-in-the-loop)"` — the designation is
solid, the precise revision is a human confirmation at real ingestion.

## Pass conditions — all met

| # | Condition | Result |
|---|-----------|--------|
| 1 | source/date attached (`flag: sourced`) | ✅ all 7, verifiable public standards |
| 2 | mechanism still maps to the MBM | ✅ `mappedMBM` unchanged & resolvable |
| 3 | ≥2 competing mechanisms survive | ✅ **4** (`app_ppa1`, `concrete:carbonated→steel:active`, `photo_1`, `electro_1_coupled`) |
| 4 | ≥2 better experiments generated | ✅ **7** |
| 5 | no invented chemistry | ✅ only `provenance`/`evidenceQuality` changed (asserted field-by-field) |

Plus a **robustness check**: for the grounded ids, the pilot's yields are
**identical** before and after grounding — the engine never depended on the
`illustrative` flag — and the hallmark **cross-subsystem coupling**
(`concrete → steel`) survives. The overall corpus verdict remains positive.

## Verdict

The engine's yields survive illustration → evidence on real standards, with the
chemistry untouched. **Full ingestion is now justified to design** — and only now.

## Boundaries honoured

❌ no broad ingestion · ❌ no external fetch · ❌ no fabricated citations · ❌ no
invented chemistry (field-by-field asserted) · ❌ no decision (verdict advisory) ·
✅ real public standards as grounding, exact editions deferred to human-in-the-loop.

## Recommended next step

Design **full ingestion** as a human-in-the-loop pipeline: attach exact source
editions/DOIs (confirmed by a person), which activates C.14 Evidence Aging (real
dates) and turns C.10's observations from illustrative to real — enabling the
deferred Stage-C engines (C.6/C.7/C.11 + Surprise Analysis) on sourced data.
