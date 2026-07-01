/**
 * MBM Stage C.10 — Prediction Calibration Engine.
 *
 * C.3 values experiments and C.4 plans them, but both emit a PREDICTION:
 * `predictedDeltaMRI` with `observedDeltaMRI = null`. C.10 closes the loop:
 *
 *     Prediction → experiment result → Observed ΔMRI → Calibration Error → learn
 *
 * Its only job is MEASUREMENT — how trustworthy are C.3/C.4's forecasts? It does
 * NOT change any decision and does NOT choose experiments. It answers:
 *   • is the model optimistic (predicts more gain than it gets)?
 *   • pessimistic?
 *   • well-calibrated?
 *   • on which experiment TYPES and which uncertainty COMPONENTS is it wrong?
 * That is the prerequisite for a Research Readiness Index and for trusting the
 * planner against real TGA/DSC data — neither of which we do yet.
 *
 * `calibrate(records)` is a pure function over prediction/observation pairs. The
 * observations here come from an ILLUSTRATIVE outcome model (`simulateObserved`)
 * clearly flagged as such — real observations arrive with ingestion. The engine's
 * logic is what is under test, not the fixture outcomes.
 */
import { attributeUncertainty } from './mbm-uncertainty.mjs';
import { informationGain, applyCandidate } from './mbm-info-gain.mjs';

const round = (x) => Number(x.toFixed(4));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Sign convention: calibrationError = observed − predicted.
//   error < 0  → predicted more gain than observed → OPTIMISTIC
//   error > 0  → observed more gain than predicted → PESSIMISTIC
const EPS = 0.01;
const direction = (signed) => (signed < -EPS ? 'optimistic' : signed > EPS ? 'pessimistic' : 'well-calibrated');

function biasBy(records, key) {
  const groups = {};
  for (const r of records) (groups[r[key]] ||= []).push(r);
  return Object.fromEntries(Object.entries(groups).map(([k, rs]) => {
    const signed = mean(rs.map((r) => r.calibrationError));
    const abs = mean(rs.map((r) => Math.abs(r.calibrationError)));
    return [k, { n: rs.length, meanSignedError: round(signed), meanAbsError: round(abs), direction: direction(signed) }];
  }));
}

/**
 * @param {Array<{id,experimentType,targetTransition,uncertaintyComponent,predictedDeltaMRI,observedDeltaMRI}>} records
 * @returns calibration report — per-record error, bias by type & component, and a score.
 */
export function calibrate(records) {
  const withErr = records.map((r) => ({ ...r, calibrationError: round(r.observedDeltaMRI - r.predictedDeltaMRI) }));
  const mae = mean(withErr.map((r) => Math.abs(r.calibrationError)));
  // Normalise error by the magnitude actually at stake (max of predicted/observed)
  // so a 0.02 miss on a 0.02 prediction is "wrong", not "almost perfect".
  const norm = mean(withErr.map((r) => Math.max(Math.abs(r.predictedDeltaMRI), Math.abs(r.observedDeltaMRI)))) || 1;
  const calibrationScore = round(clamp01(1 - mae / norm));
  const meanSignedError = round(mean(withErr.map((r) => r.calibrationError)));
  return {
    n: withErr.length,
    records: withErr,
    byExperimentType: biasBy(withErr, 'experimentType'),
    byUncertaintyComponent: biasBy(withErr, 'uncertaintyComponent'),
    meanSignedError,
    overall: direction(meanSignedError),
    calibrationScore // 1 = predictions match reality; 0 = wildly off. Heuristic, documented.
  };
}

// --- ILLUSTRATIVE outcome model (NOT real data) -----------------------------
// A real experiment can corroborate, partly corroborate, or refute the projected
// effect. We realise each on the model and read the ACTUAL ΔMRI — so `observed`
// genuinely differs from `predicted` (which assumed full corroboration). Flagged
// clearly: this stands in for lab results until ingestion.
const UNVALIDATED = (s) => s === 'hypothesized' || s === 'predicted';
const patch = (doc, target, p) => ({ states: doc.states, transitions: (doc.transitions || []).map((t) => (t.id === target ? { ...t, ...p } : t)) });

function realise(doc, cand, outcome) {
  if (outcome === 'refuted') return doc;                       // no confirmation → no gain
  if (outcome === 'corroborated') return applyCandidate(doc, cand); // full intended effect
  // partial: weaker-than-hoped result
  const t = (doc.transitions || []).find((x) => x.id === cand.target);
  if (cand.kind === 'observe') return patch(doc, cand.target, { status: 'mechanism_supported' }); // supported, not cleanly observed
  if (cand.kind === 'validate') return doc;                    // replication inconclusive
  // instrument partial: status promoted, but only literature-tier evidence (not tier-1)
  return patch(doc, cand.target, { status: UNVALIDATED(t.status) ? 'observed' : t.status, evidence: [...(t.evidence || []), { documentType: 'literature' }] });
}

export function simulateObserved(doc, ids, cand, outcome) {
  const base = attributeUncertainty(doc, ids).mri;
  return round(attributeUncertainty(realise(doc, cand, outcome), ids).mri - base);
}

// --- direct run: demo + self-consistency ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  // Build prediction records from C.3 across both APP routes (varied type/component).
  const paths = [['app_xl1', 'app_xl2'], ['app_ppa1', 'app_ppa2']];
  const rawCands = [];
  for (const ids of paths) for (const c of informationGain(doc, ids).candidates) rawCands.push({ ids, c });

  // ILLUSTRATIVE outcome fixture: Measurements come back weaker than hoped
  // (model is optimistic on them); Validations corroborate (well-calibrated).
  const outcomeFor = (c) => (c.experimentType === 'Validation' ? 'corroborated' : c.kind === 'observe' ? 'refuted' : 'partial');

  const records = rawCands.map(({ ids, c }) => ({
    id: c.id,
    experimentType: c.experimentType,
    targetTransition: c.target,
    uncertaintyComponent: c.attacks,
    predictedDeltaMRI: c.deltaMRI,
    observedDeltaMRI: simulateObserved(doc, ids, c, outcomeFor(c))
  }));

  const report = calibrate(records);

  console.log('MBM Prediction Calibration — did C.3/C.4 forecasts hold up? (measurement only)\n');
  console.log(`  n=${report.n}  overall: ${report.overall.toUpperCase()}  calibrationScore=${report.calibrationScore}  (meanSignedError=${report.meanSignedError})\n`);
  console.log('  per record (observed − predicted):');
  for (const r of report.records) console.log(`    ${r.id.padEnd(26)} pred +${r.predictedDeltaMRI}  obs +${r.observedDeltaMRI}  err ${r.calibrationError >= 0 ? '+' : ''}${r.calibrationError}  [${r.experimentType}/${r.uncertaintyComponent}]`);
  console.log('\n  bias by experiment type:');
  for (const [k, v] of Object.entries(report.byExperimentType)) console.log(`    ${k.padEnd(12)} n=${v.n}  meanErr ${v.meanSignedError >= 0 ? '+' : ''}${v.meanSignedError}  → ${v.direction}`);
  console.log('\n  bias by uncertainty component:');
  for (const [k, v] of Object.entries(report.byUncertaintyComponent)) console.log(`    ${k.padEnd(12)} n=${v.n}  meanErr ${v.meanSignedError >= 0 ? '+' : ''}${v.meanSignedError}  → ${v.direction}`);
  console.log('');

  // --- self-consistency -----------------------------------------------------
  // error identity
  assert(report.records.every((r) => Math.abs(r.calibrationError - (r.observedDeltaMRI - r.predictedDeltaMRI)) < 1e-9), 'calibrationError = observed − predicted for every record');
  // the injected optimism is detected: refuted/partial Measurements ⇒ observed < predicted ⇒ optimistic overall
  assert(report.overall === 'optimistic', `overall bias detected as optimistic (got ${report.overall})`);
  assert(report.byExperimentType.Measurement.direction === 'optimistic', 'Measurement forecasts flagged optimistic');
  // Validations were corroborated ⇒ well-calibrated
  assert(report.byExperimentType.Validation.direction === 'well-calibrated', 'Validation forecasts flagged well-calibrated');
  // score in range and NOT perfect (there is real error)
  assert(report.calibrationScore >= 0 && report.calibrationScore <= 1, 'calibrationScore in [0,1]');
  assert(report.calibrationScore < 1, 'calibrationScore < 1 when predictions miss (the score bites)');

  // BITE TEST: if every experiment corroborates, error → 0, score → 1, well-calibrated.
  const perfect = rawCands.map(({ ids, c }) => ({
    id: c.id, experimentType: c.experimentType, targetTransition: c.target, uncertaintyComponent: c.attacks,
    predictedDeltaMRI: c.deltaMRI, observedDeltaMRI: simulateObserved(doc, ids, c, 'corroborated')
  }));
  const perfectReport = calibrate(perfect);
  assert(perfectReport.overall === 'well-calibrated', 'perfect corroboration ⇒ well-calibrated');
  assert(perfectReport.calibrationScore > 0.99, `perfect corroboration ⇒ calibrationScore ≈ 1 (got ${perfectReport.calibrationScore})`);

  // PURITY: calibrate() is a pure measurement — same input, same output; no selection.
  assert(JSON.stringify(calibrate(records)) === JSON.stringify(report), 'calibrate() is pure (deterministic, side-effect free)');

  if (fails) { console.error(`MBM Prediction Calibration FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Prediction Calibration PASSED — predicted vs observed measured; optimism/pessimism by type & component detected; score bites; pure measurement, no decisions.');
}
