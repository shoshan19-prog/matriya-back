/**
 * MBM Stage C.14 — Evidence Aging.
 *
 * Not all evidence stays reliable. A 1998 paper, a measurement on old equipment,
 * an unreplicated result — each should count for less than fresh, replicated data.
 * C.14 adjusts an evidence item's tier by three provenance signals:
 *   • freshness        — exponential decay with age (halves every HALF_LIFE years)
 *   • replicationCount — independent replications raise trust back up
 *   • lastValidation   — recency of the last time it was re-checked
 *
 * DORMANT BY DESIGN: the MBM evidence records don't yet carry provenance dates, so
 * this changes NO schema and NO fixture. It is a pure function that activates at
 * ingestion, when real evidence arrives with `year` / `replications` /
 * `lastValidationYear`. Report only — it never rejects evidence, it re-weights it.
 * (Time is passed in via `nowYear`; the runtime has no wall clock.)
 */
const round = (x) => Number(x.toFixed(4));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const BASE_TIER = { tga: 1.0, dsc: 1.0, ftir: 1.0, xrd: 1.0, sem: 1.0, uv_vis: 1.0, standard: 0.95, scientific_paper: 0.8, patent: 0.75, literature: 0.7, illustrative: 0.6 };
const HALF_LIFE = 15; // years for freshness to halve
const NO_DATE_FRESHNESS = 1; // undated evidence is not penalised for age (unknown ≠ old)

export function ageEvidence(ev, nowYear) {
  const base = BASE_TIER[(ev.documentType || '').toLowerCase()] ?? 0.6;
  const age = ev.year != null ? Math.max(0, nowYear - ev.year) : null;
  const freshness = age == null ? NO_DATE_FRESHNESS : round(Math.pow(0.5, age / HALF_LIFE));
  // replications lift trust back toward 1 (diminishing): +0.1 per extra replication, cap +0.3
  const repBoost = ev.replications ? Math.min(0.3, 0.1 * ev.replications) : 0;
  // stale validation (>HALF_LIFE since last re-check) applies an extra small discount
  const staleValidation = ev.lastValidationYear != null && (nowYear - ev.lastValidationYear) > HALF_LIFE ? 0.9 : 1;
  const adjustedTier = round(clamp01((base * freshness + repBoost) * staleValidation));
  return { ...ev, baseTier: base, freshness, adjustedTier, agedBy: age };
}

export function ageEvidenceSet(evidence, nowYear) {
  const items = (evidence || []).map((e) => ageEvidence(e, nowYear));
  return { items, effectiveTier: items.length ? round(Math.max(...items.map((i) => i.adjustedTier))) : 0 };
}

// --- direct run: demo + self-consistency ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };
  const NOW = 2026; // passed in (no wall clock in the runtime)

  // Illustrative evidence records (synthetic — activates on real provenance).
  const fresh = { documentType: 'tga', year: 2024, replications: 2 };
  const old = { documentType: 'scientific_paper', year: 1998 };
  const oldReplicated = { documentType: 'scientific_paper', year: 1998, replications: 3, lastValidationYear: 2023 };
  const undated = { documentType: 'tga' };

  console.log('MBM Evidence Aging — provenance-weighted trust (dormant until ingestion)\n');
  for (const [name, ev] of [['fresh TGA (2024, ×2)', fresh], ['old paper (1998)', old], ['old paper replicated (×3)', oldReplicated], ['undated TGA', undated]]) {
    const a = ageEvidence(ev, NOW);
    console.log(`  ${name.padEnd(26)} base ${a.baseTier}  freshness ${a.freshness}  → adjustedTier ${a.adjustedTier}`);
  }
  console.log('');

  const A = ageEvidence(fresh, NOW), O = ageEvidence(old, NOW), OR = ageEvidence(oldReplicated, NOW), U = ageEvidence(undated, NOW);
  // old unreplicated evidence is worth less than fresh
  assert(O.adjustedTier < A.adjustedTier, 'old unreplicated evidence < fresh evidence');
  // replication partly restores an old source
  assert(OR.adjustedTier > O.adjustedTier, 'replication lifts an old source back up');
  // freshness decays with age; ~28 years ≈ two half-lives ⇒ freshness ≈ 0.25
  assert(Math.abs(O.freshness - Math.pow(0.5, (NOW - 1998) / HALF_LIFE)) < 1e-4, 'freshness follows the documented half-life decay');
  // undated evidence is not penalised for unknown age (unknown ≠ old)
  assert(U.freshness === 1 && U.adjustedTier === U.baseTier, 'undated evidence keeps its base tier (dormant, no fabricated age)');
  // set effective tier is the best available
  const set = ageEvidenceSet([old, fresh], NOW);
  assert(set.effectiveTier === Math.max(A.adjustedTier, O.adjustedTier), 'set effective tier is the strongest surviving evidence');
  // purity
  assert(JSON.stringify(ageEvidence(fresh, NOW)) === JSON.stringify(A), 'ageEvidence is pure (deterministic)');

  if (fails) { console.error(`MBM Evidence Aging FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Evidence Aging PASSED — age decays trust, replication restores it, undated is neutral; pure, dormant until ingestion.');
}
