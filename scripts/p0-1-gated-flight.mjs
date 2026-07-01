/**
 * P0.1 — Gated First Flight (one dataset through G1–G6, then the harness).
 *
 * This is the first flight wired to the ingestion GATES: the first-flight harness
 * runs ONLY if the dataset's ingestion request clears all six gates (human
 * submitter, provenance confirmed, evidence graded, every claim anchored, MBM
 * mapping confirmed, dual sign-off). You cannot fly ungated.
 *
 * Honesty (unchanged boundaries): the PROVENANCE is grounded in REAL public
 * standards; the numeric TGA/DSC values remain reference-class until true
 * instrument data; the reviewer roles in the request are illustrative role-holders
 * demonstrating the mechanism — not a claim that named humans reviewed real spans.
 * A true P0.1 swaps in a human-verified request + real curve. No fetch, no
 * autonomous decision.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { evaluateIngestionRequest } from './ingestion-design-check.mjs';
import { runFirstFlight } from './first-flight.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const load = (p) => JSON.parse(readFileSync(join(__dir, '..', p), 'utf8'));
const mbm = load('docs/material-state/mbm-stress-fixtures.json');
const corpus = load('docs/failure-library/failure-fixtures.json');
const dataset = load('docs/first-flight/dataset-001-app-per-mel.json');
const request = load('docs/first-flight/ingest-request-001-app.json');

/**
 * A flight is only permitted for a promotable request. Returns the gate result and
 * — only if permitted — the first-flight report, tagged with the grounded
 * provenance status.
 */
export function gatedFlight(mbm, corpus, dataset, request) {
  const gate = evaluateIngestionRequest(request);
  if (!gate.promotable) return { permitted: false, gate, report: null };
  const flight = runFirstFlight(mbm, corpus, dataset);
  return {
    permitted: true,
    gate,
    provenance: { source: request.rawSource.identifier, flag: 'sourced', numericValues: 'reference-class pending real instrument data' },
    flight
  };
}

// PASS / STOP decision for an operator run (a gauge for a human, not an auto-action).
export function passStop(R, threshold = 0.5) {
  const reasons = [];
  if (!R.permitted) return { verdict: 'STOP', reasons: ['gate(s) failed: ' + R.gate.reasons.join('; ')] };
  const f = R.flight;
  if (f.report.newRegion) reasons.push('NEW REGION — the MBM has no route for this system; model it before trusting');
  if (f.accuracy < threshold) reasons.push(`accuracy ${f.accuracy} < ${threshold} — pipeline/model mismatch, investigate`);
  const safety = f.surveillance.filter((s) => s.adversarial && s.adversarial.length);
  if (safety.length) reasons.push('surprise cross-flagged against the failure corpus — escalate to Experiment Planner (C.4): ' + safety.map((s) => s.id).join(', '));
  return { verdict: reasons.length ? 'STOP' : 'PASS', reasons };
}

// --- direct run: OPERATOR mode (argv) or SELF-TEST mode (no args) ------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  if (argv.length >= 2) {
    // OPERATOR MODE: node p0-1-gated-flight.mjs <dataset.json> <ingest-request.json>
    const ds = JSON.parse(readFileSync(argv[0], 'utf8'));
    const req = JSON.parse(readFileSync(argv[1], 'utf8'));
    const R = gatedFlight(mbm, corpus, ds, req);
    const ps = passStop(R);
    console.log(`P0.1 operator run — ${argv[0]}`);
    console.log(`  gates: ${Object.entries(R.gate.gates).map(([g, v]) => `${g.split('_')[0]}${v ? '✓' : '✗'}`).join(' ')}  → promotable=${R.gate.promotable}`);
    if (R.permitted) {
      const f = R.flight;
      console.log(`  accuracy ${(f.accuracy * 100).toFixed(0)}%  hypotheses ${f.hypotheses.length}  surprises ${f.surprises.length}  newRegion ${f.report.newRegion}  promotionApplied ${f.report.promotionApplied}`);
    }
    console.log(`\n  VERDICT: ${ps.verdict}`);
    ps.reasons.forEach((r) => console.log(`    - ${r}`));
    process.exit(ps.verdict === 'PASS' ? 0 : 1);
  }

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  const R = gatedFlight(mbm, corpus, dataset, request);
  const line = (s = '') => console.log(s);
  line('════════════════════════════════════════════════════════════════════');
  line('  P0.1 — GATED FIRST FLIGHT   (one dataset through G1–G6, then fly)');
  line(`  source: ${request.rawSource.identifier}  ·  provenance grounded in real standards`);
  line('  numeric TGA/DSC values: reference-class pending real instrument data');
  line('════════════════════════════════════════════════════════════════════\n');
  line(`  GATES: ${Object.entries(R.gate.gates).map(([g, v]) => `${g.split('_')[0]}${v ? '✓' : '✗'}`).join(' ')}  → promotable=${R.gate.promotable}`);
  if (!R.permitted) { line('\n  FLIGHT BLOCKED — request did not clear the gates. (This is the safety property.)'); }
  else {
    const f = R.flight;
    line(`\n  FLIGHT PERMITTED. Post-flight (dataset ${f.datasetId}):`);
    line(`    accuracy ${(f.accuracy * 100).toFixed(0)}%  ·  hypotheses ${f.hypotheses.length}  ·  surprises ${f.surprises.length}  ·  newRegion ${f.report.newRegion}`);
    line(`    top hypothesis: ${f.hypotheses[0] ? f.hypotheses[0].route + ' (MRI ' + f.hypotheses[0].mri + ', ' + f.hypotheses[0].epistemic + ')' : 'none'}`);
    line(`    surprise: ${f.surprises.map((s) => s.tempC + '°C').join(', ') || 'none'}   context: ${f.surveillance.filter((s) => s.verdict === 'context_changed').map((s) => s.id).join(', ') || 'none'}`);
    line(`    proposed updates: ${f.report.proposedUpdates.length} (all proposed, human-gated)  ·  promotion applied: ${f.report.promotionApplied}`);
  }
  line('════════════════════════════════════════════════════════════════════');

  // --- self-consistency -----------------------------------------------------
  // the request clears all six gates → flight permitted
  assert(R.gate.promotable === true, 'the standards-grounded request clears G1–G6');
  assert(R.permitted === true && R.flight, 'flight runs only because the request is promotable');
  assert(R.flight.datasetId === 'dataset_001_app_per_mel', 'the permitted flight ran on the gated dataset');
  assert(R.flight.report.promotionApplied === false, 'even a gated flight promotes nothing on its own (still needs ≥3 datasets)');
  assert(R.provenance.numericValues.includes('reference-class'), 'numeric values honestly flagged reference-class pending real data');

  // BITE: break one gate (drop the mechanism anchor) → flight MUST be blocked.
  const broken = JSON.parse(JSON.stringify(request));
  broken.citationAnchors = broken.citationAnchors.filter((a) => a.field !== 'claimedMechanism');
  const B = gatedFlight(mbm, corpus, dataset, broken);
  assert(B.permitted === false && B.report === null, 'un-anchored (invented-chemistry) request BLOCKS the flight — you cannot fly ungated');
  assert(B.gate.gates.G4_noInventedChemistry === false, 'the blocked flight fails specifically on the anti-invented-chemistry gate');

  // BITE: single reviewer (no dual control) → blocked
  const broken2 = JSON.parse(JSON.stringify(request));
  broken2.signoff.reviewer2 = broken2.signoff.reviewer1;
  assert(gatedFlight(mbm, corpus, dataset, broken2).permitted === false, 'single-reviewer request BLOCKS the flight (dual control)');

  // PASS/STOP: the demo flight carries a corpus-flagged surprise (o4) ⇒ STOP for review
  const ps = passStop(R);
  assert(ps.verdict === 'STOP' && ps.reasons.some((r) => /failure corpus/.test(r)), 'PASS/STOP routes a corpus-flagged surprise to human review (STOP)');
  // a blocked request is STOP with the gate reason
  assert(passStop(B).verdict === 'STOP', 'a blocked (ungated) request is STOP');
  // purity
  assert(JSON.stringify(gatedFlight(mbm, corpus, dataset, request)) === JSON.stringify(R), 'gatedFlight is deterministic');

  console.log('');
  if (fails) { console.error(`P0.1 Gated Flight FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('P0.1 Gated Flight PASSED — flight runs iff the request clears G1–G6; ungated/un-anchored requests are blocked; provenance grounded in real standards, numeric values honestly reference-class. No fetch, no decision.');
}
