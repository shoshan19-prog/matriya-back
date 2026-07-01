/**
 * MBM Stage C.12 — Research Readiness Index (RRI).
 *
 * MRI describes a PATH. RRI describes the WHOLE MODEL — combining the Stage-C
 * measurements into one maturity gauge that answers a single question:
 *
 *     Is the MBM mature enough to receive real TGA/DSC data?
 *
 * RRI is NOT a decision gate and never auto-approves ingestion. It is a maturity
 * descriptor for the scientific instrument itself, with the weakest dimension
 * called out so effort can go where it helps most.
 *
 * Five dimensions (each in [0,1], documented heuristic weights):
 *   coverage     — invariant coverage across the model (Stage A)
 *   calibration  — how trustworthy the planner's forecasts are (C.10)
 *   epistemic    — fraction of key paths that are Confirmed/Corroborated (C.9)
 *   mechanism    — fraction of the model NOT stuck in unresolved competing
 *                  mechanisms (C.8 tension)
 *   gaps         — fraction of transitions validated AND evidenced (information gaps)
 */
import { computeCoverage, INVARIANTS } from './mbm-invariants.mjs';
import { tensionMap } from './mbm-tension-map.mjs';
import { epistemicState } from './mbm-epistemic.mjs';

const round = (x) => Number(x.toFixed(4));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const REAL = (t) => t.status !== 'unknown' && t.status !== 'impossible';
const VALIDATED = new Set(['observed', 'replicated', 'mechanism_supported']);
const MIN_EXERCISED = 3; // same diversity floor as the coverage gate

// Documented weights (tunable). Epistemic maturity and calibration matter most
// before trusting the instrument against real data.
const WEIGHTS = { coverage: 0.2, calibration: 0.25, epistemic: 0.25, mechanism: 0.15, gaps: 0.15 };

export function researchReadiness(doc, { paths = [], calibrationScore = null } = {}) {
  const real = (doc.transitions || []).filter(REAL);

  // coverage: mean over invariants of how close each is to the diversity floor.
  const cov = computeCoverage(doc);
  const coverage = round(cov.rows.reduce((s, r) => s + Math.min(1, r.exercised / MIN_EXERCISED), 0) / INVARIANTS.length);

  // calibration: from C.10 if measured; if never measured, readiness is penalised
  // (you cannot trust forecasts you have not checked).
  const calibration = calibrationScore == null ? 0 : clamp01(calibrationScore);

  // epistemic: fraction of key paths that are Confirmed or Corroborated.
  const states = paths.map((ids) => epistemicState(doc, ids).state);
  const mature = states.filter((s) => s === 'Confirmed' || s === 'Corroborated').length;
  const epistemic = paths.length ? round(mature / paths.length) : 0;

  // mechanism: fraction of states NOT in unresolved competing-mechanism tension.
  const tmap = tensionMap(doc);
  const tension = tmap.counts.tension || 0;
  const mechanism = tmap.cells.length ? round(1 - tension / tmap.cells.length) : 1;

  // gaps: fraction of real transitions that are validated AND evidenced.
  const solid = real.filter((t) => VALIDATED.has(t.status) && (t.evidence || []).length > 0).length;
  const gaps = real.length ? round(solid / real.length) : 0;

  const subscores = { coverage, calibration, epistemic, mechanism, gaps };
  const rri = round(Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * subscores[k], 0));
  const weakestDimension = Object.entries(subscores).sort((a, b) => a[1] - b[1])[0][0];

  const label = rri >= 0.7 ? 'ready' : rri >= 0.4 ? 'partially ready' : 'not ready';
  const recommendation = calibrationScore == null
    ? 'run the Calibration Engine (C.10) first — forecast trust is unmeasured'
    : `strengthen the weakest dimension: ${weakestDimension} (${subscores[weakestDimension]})`;

  return {
    rri, label, subscores, weakestDimension, weights: WEIGHTS,
    // explicit: a gauge, not a gate.
    note: 'RRI is a maturity gauge, not an automatic decision gate — a human decides on ingestion.',
    recommendation
  };
}

// --- direct run: demo + self-consistency ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const { informationGain, applyCandidate } = await import('./mbm-info-gain.mjs');
  const { calibrate, simulateObserved } = await import('./mbm-calibration.mjs');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  const paths = [['app_xl1', 'app_xl2'], ['app_ppa1', 'app_ppa2'], ['thermal_1', 'thermal_2', 'thermal_3']];

  // measure calibration to feed RRI
  const raw = [];
  for (const ids of paths) for (const c of informationGain(doc, ids).candidates) raw.push({ ids, c });
  const records = raw.map(({ ids, c }) => ({
    id: c.id, experimentType: c.experimentType, targetTransition: c.target, uncertaintyComponent: c.attacks,
    predictedDeltaMRI: c.deltaMRI, observedDeltaMRI: simulateObserved(doc, ids, c, c.experimentType === 'Validation' ? 'corroborated' : 'partial')
  }));
  const calibrationScore = calibrate(records).calibrationScore;

  const rri = researchReadiness(doc, { paths, calibrationScore });
  console.log('MBM Research Readiness Index — is the model ready for real TGA/DSC?\n');
  console.log(`  RRI = ${rri.rri}  → ${rri.label.toUpperCase()}   (weakest: ${rri.weakestDimension})`);
  for (const [k, v] of Object.entries(rri.subscores)) console.log(`    ${k.padEnd(12)} ${v}   (w=${rri.weights[k]})`);
  console.log(`  → ${rri.recommendation}\n`);

  // --- self-consistency -----------------------------------------------------
  assert(rri.rri >= 0 && rri.rri <= 1, 'RRI in [0,1]');
  assert(Object.values(rri.subscores).every((v) => v >= 0 && v <= 1), 'every subscore in [0,1]');
  assert(Object.values(rri.weights).reduce((a, b) => a + b, 0) === 1, 'weights sum to 1');
  assert(rri.weakestDimension === Object.entries(rri.subscores).sort((a, b) => a[1] - b[1])[0][0], 'weakestDimension is the lowest subscore');
  // unmeasured calibration penalises readiness AND changes the recommendation
  const noCal = researchReadiness(doc, { paths });
  assert(noCal.subscores.calibration === 0, 'unmeasured calibration scores 0');
  assert(noCal.rri < rri.rri, 'measuring calibration cannot lower RRI (unmeasured is penalised)');
  assert(/Calibration Engine/.test(noCal.recommendation), 'unmeasured calibration recommends running C.10 first');
  // MONOTONICITY: instrument-confirming every path raises epistemic maturity ⇒ RRI up
  let doc2 = doc;
  for (const ids of paths) for (const id of ids) doc2 = applyCandidate(doc2, { kind: 'instrument', target: id, instrument: 'tga' });
  const rri2 = researchReadiness(doc2, { paths, calibrationScore });
  assert(rri2.rri >= rri.rri, 'confirming paths with instrument evidence does not lower RRI');
  assert(rri2.subscores.epistemic >= rri.subscores.epistemic, 'epistemic maturity rises when paths become Confirmed');
  // it is a gauge, not a gate
  assert(/not an automatic decision gate/.test(rri.note), 'RRI explicitly declares itself a gauge, not a gate');

  if (fails) { console.error(`MBM Research Readiness Index FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Research Readiness Index PASSED — five dimensions combined into a maturity gauge; weakest called out; not a decision gate.');
}
