/**
 * MBM Stage C.5 — Historical Learning.
 *
 * C.10 measured that C.3/C.4 are (say) optimistic about Measurement experiments.
 * C.5 turns that measurement into a **correction**: a factor that shrinks or grows
 * a FUTURE predicted ΔMRI so it lands closer to what the lab will actually see.
 *
 * It corrects PREDICTIONS only — it changes no decision and selects no experiment
 * (the planner keeps its logic; C.5 just hands it better-calibrated numbers).
 *
 * Corrections are learned at several specificities and applied most-specific-first:
 *     targetTransition  →  experimentType×uncertaintyComponent  →  experimentType
 * A group only earns its own correction with enough history (MIN_SAMPLES). If a
 * context has no learned bias, it is left UNCORRECTED (factor 1.0) — deliberately
 * conservative: we do NOT nudge a well-calibrated group by an unrelated global
 * factor (that would import other groups' bias, e.g. Measurement optimism leaking
 * onto well-calibrated Validation). The global factor is reported, not applied.
 * Factor = mean(observed)/mean(predicted): <1 shrinks optimistic forecasts, >1
 * grows pessimistic ones.
 *
 * Honest note: the demo learns and re-checks IN-SAMPLE (correcting the same
 * records) — it proves the mechanism reduces bias to ~0 by construction; true
 * predictive validation needs held-out lab data (ingestion), documented.
 */
const round = (x) => Number(x.toFixed(4));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const MIN_SAMPLES = 2; // a group needs this much history before it earns its own factor

function factorOf(records) {
  const p = mean(records.map((r) => r.predictedDeltaMRI));
  const o = mean(records.map((r) => r.observedDeltaMRI));
  return p > 1e-9 ? round(clamp(o / p, 0, 2)) : 1;
}

function groupFactors(records, keyFn) {
  const groups = {};
  for (const r of records) (groups[keyFn(r)] ||= []).push(r);
  return Object.fromEntries(Object.entries(groups)
    .filter(([, rs]) => rs.length >= MIN_SAMPLES)
    .map(([k, rs]) => [k, { factor: factorOf(rs), n: rs.length }]));
}

/**
 * @param {{records:Array}} calibrationReport  output of C.10 calibrate()
 * @returns a correction model + apply()/correct() helpers.
 */
export function learnCorrections(calibrationReport) {
  const records = calibrationReport.records;
  // All keys are TYPE-AWARE — a bare-transition factor would mix a Measurement and
  // a Validation on the same transition and contaminate both.
  const model = {
    global: { factor: factorOf(records), n: records.length },
    byType: groupFactors(records, (r) => r.experimentType),
    byTypeComponent: groupFactors(records, (r) => `${r.experimentType}::${r.uncertaintyComponent}`),
    byTypeTransition: groupFactors(records, (r) => `${r.experimentType}::${r.targetTransition}`)
  };

  // Most-specific-first lookup. No learned bias for the context ⇒ identity (no
  // correction), NOT the global factor — see the header note.
  const correct = (predicted, ctx) => {
    const tries = [
      ['type×transition', model.byTypeTransition[`${ctx.experimentType}::${ctx.targetTransition}`]],
      ['type×component', model.byTypeComponent[`${ctx.experimentType}::${ctx.uncertaintyComponent}`]],
      ['type', model.byType[ctx.experimentType]]
    ];
    const [source, hit] = tries.find(([, v]) => v) || ['none', { factor: 1 }];
    return { correctedDeltaMRI: round(predicted * hit.factor), factor: hit.factor, source };
  };

  return { model, correct };
}

// --- direct run: demo + self-consistency ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const { informationGain } = await import('./mbm-info-gain.mjs');
  const { calibrate, simulateObserved } = await import('./mbm-calibration.mjs');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  // Reproduce C.10's records (illustrative outcomes: Measurements under-deliver).
  const paths = [['app_xl1', 'app_xl2'], ['app_ppa1', 'app_ppa2']];
  const raw = [];
  for (const ids of paths) for (const c of informationGain(doc, ids).candidates) raw.push({ ids, c });
  const outcomeFor = (c) => (c.experimentType === 'Validation' ? 'corroborated' : c.kind === 'observe' ? 'refuted' : 'partial');
  const records = raw.map(({ ids, c }) => ({
    id: c.id, experimentType: c.experimentType, targetTransition: c.target, uncertaintyComponent: c.attacks,
    predictedDeltaMRI: c.deltaMRI, observedDeltaMRI: simulateObserved(doc, ids, c, outcomeFor(c))
  }));
  const before = calibrate(records);
  const { model, correct } = learnCorrections(before);

  console.log('MBM Historical Learning — turn calibration bias into forecast corrections (predictions only)\n');
  console.log(`  global correction factor: ${model.global.factor} (n=${model.global.n})`);
  console.log('  by experiment type:');
  for (const [k, v] of Object.entries(model.byType)) console.log(`    ${k.padEnd(12)} ×${v.factor} (n=${v.n})`);
  console.log('  by uncertainty component (type×component):');
  for (const [k, v] of Object.entries(model.byTypeComponent)) console.log(`    ${k.padEnd(24)} ×${v.factor} (n=${v.n})`);

  // Apply corrections to the same predictions, then re-calibrate.
  const corrected = records.map((r) => ({ ...r, predictedDeltaMRI: correct(r.predictedDeltaMRI, r).correctedDeltaMRI }));
  const after = calibrate(corrected);
  console.log(`\n  calibrationScore: ${before.calibrationScore} → ${after.calibrationScore}   overall: ${before.overall} → ${after.overall}\n`);

  // --- self-consistency -----------------------------------------------------
  // optimistic groups get a shrink factor (<1)
  assert(model.byType.Measurement.factor < 1, 'optimistic Measurement forecasts get a shrink factor (<1)');
  // learning reduces bias: corrected predictions are closer to observed (lower MAE, better score)
  const mae = (rep) => mean(rep.records.map((r) => Math.abs(r.calibrationError)));
  assert(mae(after) < mae(before) - 1e-9, `correction lowers mean abs error (${round(mae(before))} → ${round(mae(after))})`);
  assert(after.calibrationScore >= before.calibrationScore, 'correction does not worsen calibrationScore');
  // per-type signed bias does not get worse, and the biased type improves
  for (const [k, v] of Object.entries(after.byExperimentType)) assert(Math.abs(v.meanSignedError) <= Math.abs(before.byExperimentType[k].meanSignedError) + 1e-9, `${k}: per-type bias not worse after correction`);
  assert(Math.abs(after.byExperimentType.Measurement.meanSignedError) < Math.abs(before.byExperimentType.Measurement.meanSignedError), 'Measurement bias reduced by its correction');
  // the well-calibrated group is NOT disturbed (no global-factor pollution)
  assert(Math.abs(after.byExperimentType.Validation.meanSignedError) < 1e-9, 'well-calibrated Validation left undisturbed (conservative fallback)');
  // only groups with enough history earn a correction (MIN_SAMPLES honoured)
  assert(Object.values(model.byTypeTransition).every((v) => v.n >= MIN_SAMPLES), 'only groups with enough history earn a correction (MIN_SAMPLES honoured)');
  // unknown context ⇒ identity (no correction), reported transparently
  const s = correct(0.2, { experimentType: 'Nonexistent', uncertaintyComponent: 'x', targetTransition: 'none' });
  assert(s.source === 'none' && s.factor === 1 && s.correctedDeltaMRI === 0.2, 'unknown context is left uncorrected (identity), not nudged by global');
  // purity
  assert(JSON.stringify(learnCorrections(before).model) === JSON.stringify(model), 'learnCorrections is pure (deterministic)');

  if (fails) { console.error(`MBM Historical Learning FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Historical Learning PASSED — bias → correction factors by type/component/transition; forecasts improve; predictions only, no decisions.');
}
