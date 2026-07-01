/**
 * First-Flight Golden Suite — regression + anti-overfit.
 *
 * Runs the SAME first-flight harness over three illustrative datasets from three
 * different coating families (APP/PER/MEL · silicate · cementitious) to prove the
 * pipeline is not fitted only to APP. DRY-RUN: no ingestion, no fetch, no decision,
 * no invented chemistry (all datasets flagged illustrative).
 *
 * Anti-overfit claim: the same pipe (a) generates hypotheses only where the MBM
 * actually models the system (APP thermal path), and (b) for systems the MBM does
 * NOT model (silicate, cementitious thermal decomposition) reports a NEW REGION
 * honestly instead of fabricating an APP-like route — while still separating
 * context from surprise and proposing (never deciding) in every case.
 *
 * Golden regression: every dataset's flight is deterministic; this suite is the
 * baseline that guards against silent behaviour drift as the MBM evolves.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runFirstFlight, driftMonitor } from './first-flight.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const load = (p) => JSON.parse(readFileSync(join(__dir, '..', p), 'utf8'));
const mbm = load('docs/material-state/mbm-stress-fixtures.json');
const corpus = load('docs/failure-library/failure-fixtures.json');
const datasets = [
  load('docs/first-flight/dataset-001-app-per-mel.json'),
  load('docs/first-flight/dataset-002-silicate.json'),
  load('docs/first-flight/dataset-003-cementitious.json')
];

let fails = 0;
const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

console.log('First-Flight GOLDEN SUITE — same pipe, three chemistries (dry-run, no ingestion)\n');
const results = datasets.map((d) => runFirstFlight(mbm, corpus, d));

for (const R of results) {
  const ctx = R.surveillance.filter((s) => s.verdict === 'context_changed').map((s) => s.id);
  console.log(`  ${R.datasetId.padEnd(26)} acc ${(R.accuracy * 100).toFixed(0)}%  hyp ${R.hypotheses.length}  surprises ${R.surprises.length}  context [${ctx.join(',') || '-'}]  newRegion ${R.report.newRegion}`);

  // per-dataset pipeline invariants (must hold for EVERY chemistry)
  const d = datasets.find((x) => x.datasetId === R.datasetId);
  assert(R.observations.length === d.observations.length, `${R.datasetId}: observations preserved`);
  assert(R.accuracy >= 0 && R.accuracy <= 1, `${R.datasetId}: accuracy in [0,1]`);
  assert(R.report.promotionApplied === false, `${R.datasetId}: single flight promotes nothing`);
  assert(R.report.proposedUpdates.every((u) => u.status === 'proposed' && 'causedBy' in u && u.requires), `${R.datasetId}: all updates proposed w/ provenance + human gate`);
  // iron rule holds across chemistries: every context-dependent obs → context_changed, never a surprise
  for (const o of d.observations.filter((o) => o.contextDependent)) {
    const s = R.surveillance.find((x) => x.id === o.id);
    assert(s && s.verdict === 'context_changed', `${R.datasetId}: ${o.id} is context_changed (iron rule)`);
    assert(!R.surprises.some((x) => x.id === o.id), `${R.datasetId}: ${o.id} not counted as a surprise`);
  }
  // each dataset has ≥1 detected surprise (a planted candidate_new)
  assert(R.surprises.length >= 1, `${R.datasetId}: at least one surprise detected`);
  // determinism (golden replay)
  assert(JSON.stringify(runFirstFlight(mbm, corpus, d)) === JSON.stringify(R), `${R.datasetId}: deterministic golden replay`);
}

// --- anti-overfit cross-dataset assertions ---------------------------------
const byId = Object.fromEntries(results.map((r) => [r.datasetId, r]));
// APP is thermally modelled → hypotheses exist; silicate & cementitious are NOT →
// the pipe reports newRegion and fabricates NO route.
assert(byId.dataset_001_app_per_mel.hypotheses.length >= 2, 'APP (modelled) → the pipe generates ranked hypotheses');
assert(byId.dataset_001_app_per_mel.report.newRegion === false, 'APP → not flagged new region');
assert(byId.dataset_002_silicate.hypotheses.length === 0 && byId.dataset_002_silicate.report.newRegion === true, 'silicate (unmodelled) → NEW REGION, no fabricated route');
assert(byId.dataset_003_cementitious.hypotheses.length === 0 && byId.dataset_003_cementitious.report.newRegion === true, 'cementitious (thermally unmodelled) → NEW REGION, no fabricated route');
// the pipe is NOT a constant: it responds to different inputs (accuracies/surprises differ)
const accs = results.map((r) => r.accuracy);
assert(new Set(accs).size >= 2, 'the pipe responds to the data — accuracies are not all identical');
// golden regression baseline via the drift monitor across the suite
const drift = driftMonitor(accs);
console.log(`\n  golden baseline: accuracies ${accs.map((a) => a.toFixed(2)).join(', ')}  meanError ${drift.meanError}  recalibrationDue ${drift.recalibrationDue}`);
assert(drift.recalibrationDue === false, 'golden suite is within the drift budget (baseline healthy)');

console.log('');
if (fails) { console.error(`First-Flight Golden Suite FAILED: ${fails} check(s)`); process.exit(1); }
console.log('First-Flight Golden Suite PASSED — same pipe across 3 chemistries: hypotheses only where modelled, honest NEW REGION otherwise, context/surprise separated everywhere; deterministic. Not APP-specific.');
