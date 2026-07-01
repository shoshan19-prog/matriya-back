/**
 * MBM Stage C — Scientific Reasoning Report.
 *
 * The capstone of Stage C: one report that runs the whole reasoning loop over the
 * model and shows, end to end, what the MBM knows, what it doesn't, what to test
 * next, and how ready it is to meet real TGA/DSC data. Every number comes from a
 * Stage-C engine — this file only orchestrates and prints. It makes NO decision,
 * performs NO ingestion, and runs NO engine on external data.
 *
 * Sections: alternative paths · uncertainty attribution · information gain ·
 * experiment portfolio · calibration · learning correction · tension map ·
 * epistemic states · RRI · remaining gaps.
 */
import { generatePaths } from './mbm-alt-paths.mjs';
import { attributeUncertainty } from './mbm-uncertainty.mjs';
import { informationGain, applyCandidate } from './mbm-info-gain.mjs';
import { planExperiments } from './mbm-experiment-planner.mjs';
import { calibrate, simulateObserved } from './mbm-calibration.mjs';
import { learnCorrections } from './mbm-learning.mjs';
import { tensionMap } from './mbm-tension-map.mjs';
import { epistemicState } from './mbm-epistemic.mjs';
import { researchReadiness } from './mbm-readiness.mjs';
import { discoveryOpportunities } from './mbm-discovery.mjs';

export function stageCReport(doc, { from, to, keyPaths }) {
  // 1. Alternative paths for the headline transformation.
  const paths = generatePaths(doc, from, to);
  const primary = paths[0]?.ids || keyPaths[0];

  // 2–4. Attribution, information gain, and a budgeted plan on the primary path.
  const attribution = attributeUncertainty(doc, primary);
  const infoGain = informationGain(doc, primary);
  const plan = planExperiments(doc, primary, { maxCost: 6, maxTime: 12 });

  // 5. Calibration over predictions across all key paths (illustrative outcomes).
  const raw = [];
  for (const ids of keyPaths) for (const c of informationGain(doc, ids).candidates) raw.push({ ids, c });
  const records = raw.map(({ ids, c }) => ({
    id: c.id, experimentType: c.experimentType, targetTransition: c.target, uncertaintyComponent: c.attacks,
    predictedDeltaMRI: c.deltaMRI, observedDeltaMRI: simulateObserved(doc, ids, c, c.experimentType === 'Validation' ? 'corroborated' : 'partial')
  }));
  const calibration = calibrate(records);

  // 6. Learning correction from the calibration bias.
  const learning = learnCorrections(calibration);

  // 7–8. Model-wide tension map and epistemic state per key path.
  const tmap = tensionMap(doc);
  const epistemic = keyPaths.map((ids) => ({ ids, ...epistemicState(doc, ids) }));

  // 9. Research readiness (fed by the measured calibration).
  const rri = researchReadiness(doc, { paths: keyPaths, calibrationScore: calibration.calibrationScore });

  // 10. Discovery opportunities + remaining gaps.
  const discovery = discoveryOpportunities(doc);

  return { from, to, primary, paths, attribution, infoGain, plan, calibration, learning, tmap, epistemic, rri, discovery };
}

// --- direct run: full report + end-to-end self-consistency ------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));

  const keyPaths = [['app_ppa1', 'app_ppa2'], ['app_xl1', 'app_xl2'], ['thermal_1', 'thermal_2', 'thermal_3']];
  const R = stageCReport(doc, { from: 'app:solid', to: 'app:char', keyPaths });

  const line = (s = '') => console.log(s);
  line('════════════════════════════════════════════════════════════════════');
  line('  MBM STAGE C — SCIENTIFIC REASONING REPORT   (app:solid → app:char)');
  line('  measurement / recommendation / report only — no decisions, no ingestion');
  line('════════════════════════════════════════════════════════════════════\n');

  line('1) ALTERNATIVE PATHS (ranked by reliability)');
  R.paths.forEach((p, i) => line(`   ${i + 1}. ${p.route.join(' → ')}   pathMRI ${p.pathMRI}  weakest ${p.weakest.id}`));

  line('\n2) UNCERTAINTY ATTRIBUTION (primary path)');
  line(`   MRI ${R.attribution.mri}  dominant ${R.attribution.dominant}  → ${R.attribution.recommendation}`);
  for (const [k, v] of Object.entries(R.attribution.components)) line(`      ${k.padEnd(9)} ${v}%`);

  line('\n3) INFORMATION GAIN (top experiments by ΔMRI)');
  R.infoGain.candidates.slice(0, 3).forEach((c) => line(`   [${c.experimentType}] ${c.id}  ΔMRI +${c.deltaMRI}  attacks ${c.attacks}`));

  line('\n4) EXPERIMENT PORTFOLIO (budget cost≤6, time≤12)');
  R.plan.portfolio.forEach((p) => line(`   ${p.step}. [${p.experimentType}] ${p.id}  predicted ΔMRI +${p.predictedDeltaMRI}`));
  line(`   → MRI ${R.plan.baseline.mri} → ${R.plan.expected.mriAfter}  (closes ${(R.plan.expected.knowledgeClosed * 100).toFixed(0)}% of the gap)`);

  line('\n5) CALIBRATION (predicted vs observed — illustrative outcomes)');
  line(`   overall ${R.calibration.overall}  calibrationScore ${R.calibration.calibrationScore}`);
  for (const [k, v] of Object.entries(R.calibration.byExperimentType)) line(`      ${k.padEnd(12)} ${v.direction} (meanErr ${v.meanSignedError})`);

  line('\n6) LEARNING CORRECTION (bias → forecast factors)');
  line(`   global ×${R.learning.model.global.factor}`);
  for (const [k, v] of Object.entries(R.learning.model.byType)) line(`      ${k.padEnd(12)} ×${v.factor} (n=${v.n})`);

  line('\n7) KNOWLEDGE TENSION MAP (whole model)');
  line(`   ${Object.entries(R.tmap.counts).map(([k, v]) => `${k}=${v}`).join('  ')}   tensionIndex ${R.tmap.tensionIndex}`);
  line(`   tension: ${R.tmap.hotspots.tension.join(', ') || 'none'}`);

  line('\n8) EPISTEMIC STATES (per key path)');
  R.epistemic.forEach((e) => line(`   ${e.ids.join('→').padEnd(28)} ${e.state}`));

  line('\n9) RESEARCH READINESS INDEX');
  line(`   RRI ${R.rri.rri} → ${R.rri.label.toUpperCase()}   weakest: ${R.rri.weakestDimension}`);
  for (const [k, v] of Object.entries(R.rri.subscores)) line(`      ${k.padEnd(12)} ${v}`);
  line(`   ${R.rri.note}`);

  line('\n10) REMAINING GAPS & DISCOVERY OPPORTUNITIES');
  line(`   after the plan: dominant=${R.plan.remainingGaps.dominantAfter}  unvalidated=[${R.plan.remainingGaps.unvalidatedSteps.join(', ') || 'none'}]  no-instrument=[${R.plan.remainingGaps.stepsWithoutInstrument.join(', ') || 'none'}]`);
  R.discovery.top.slice(0, 3).forEach((o, i) => line(`   discovery ${i + 1}. ${o.state} (score ${o.score}, ${o.label})`));
  line('\n════════════════════════════════════════════════════════════════════');

  // --- end-to-end self-consistency -----------------------------------------
  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };
  assert(R.paths.length >= 1 && R.paths[0].route[0] === 'app:solid', 'alternative paths generated for the headline transformation');
  assert(Object.values(R.attribution.components).reduce((a, b) => a + b, 0) > 99.4, 'attribution components sum to ~100%');
  assert(R.plan.expected.mriAfter >= R.plan.baseline.mri, 'the plan does not lower MRI');
  assert(R.calibration.n === R.calibration.records.length && R.calibration.n >= 1, 'calibration covers every prediction record');
  assert(R.learning.model.byType.Measurement.factor <= 1, 'learning produced a (non-inflating) correction for the biased type');
  assert(R.tmap.cells.length === doc.states.length && R.tmap.tensionIndex >= 0, 'tension map covers the whole model');
  assert(R.epistemic.length === keyPaths.length && R.epistemic.every((e) => typeof e.state === 'string'), 'every key path has an epistemic state');
  assert(R.rri.rri >= 0 && R.rri.rri <= 1 && /gauge, not an automatic decision gate/.test(R.rri.note), 'RRI present and self-declared as a gauge, not a gate');
  assert(R.discovery.top.length >= 1, 'discovery opportunities ranked');
  // the whole report is a pure function of the model + query
  assert(JSON.stringify(stageCReport(doc, { from: 'app:solid', to: 'app:char', keyPaths })) === JSON.stringify(R), 'the Stage C report is pure (deterministic)');

  console.log('');
  if (fails) { console.error(`MBM Stage C Report FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Stage C Report PASSED — full reasoning loop wired end-to-end; every section sourced from a Stage-C engine; report only.');
}
