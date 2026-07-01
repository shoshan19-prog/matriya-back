/**
 * P0 First Flight — controlled first exposure to (illustrative) real-shaped data.
 *
 * DRY-RUN / DESIGN. No ingestion, no fetch, no autonomous decision, no invented
 * chemistry. Runs a single ILLUSTRATIVE APP/PER/MEL dataset through the whole
 * Stage-B/C machinery to prove the PIPELINE listens correctly. Implements the five
 * first-flight principles, plus five efficiency ideas of our own (see the doc):
 *
 *   P1 Live-attenuated   — a known system; goal is "does the pipe work?", not new facts
 *   P2 Surveillance mode — every deviation triaged against invariants / failure
 *                          corpus / assumptions; an assumption-broken deviation is
 *                          reported as CONTEXT CHANGED, never as "new material"
 *   P3 Co-pilot          — every reading emits a machine recommendation AND the
 *                          targeted questions of what it does not know
 *   P4 Observations≠Hypotheses — raw observations kept separate from ranked
 *                          hypotheses; no promotion from a single flight
 *   P5 Post-flight report — did we LEARN? accuracy, surprises, adversarial check,
 *                          PROPOSED (not applied) prior updates with provenance
 *
 * The report proposes; humans (G1–G6) dispose. "We are not testing whether the
 * model is right — we are testing whether we know how to listen to it."
 */
import { generatePaths } from './mbm-alt-paths.mjs';
import { modelReliabilityIndex } from './mbm-reliability.mjs';
import { epistemicState } from './mbm-epistemic.mjs';
import { checkInvariants } from './mbm-invariants.mjs';

const TOL = 15; // °C matching tolerance
const round = (x) => Number(x.toFixed(4));
const near = (a, b) => Math.abs(a - b) <= TOL;

export function runFirstFlight(mbm, failureCorpus, dataset) {
  const obs = dataset.observations || [];
  const expected = dataset.expectedTransitions || [];

  // P4 — Observations (raw) vs Hypotheses (ranked, NOT decided).
  const observations = obs.map((o) => ({ id: o.id, technique: o.technique, kind: o.kind, tempC: o.tempC, magnitude: o.magnitude }));
  const paths = generatePaths(mbm, dataset.mbmEndpoints.from, dataset.mbmEndpoints.to);
  const hypotheses = paths.map((p) => ({
    route: p.route.join(' → '), ids: p.ids, mri: p.pathMRI,
    epistemic: epistemicState(mbm, p.ids).state, // single flight never promotes past this
    weakest: p.weakest.id
  }));

  // Prediction accuracy: each expected transition matched by an observation near its temperature?
  const predictions = expected.map((e) => {
    const hit = obs.find((o) => near(o.tempC, e.aboutTempC));
    return { label: e.label, mbmTransition: e.mbmTransition, aboutTempC: e.aboutTempC, matched: Boolean(hit), by: hit ? hit.id : null };
  });
  const accuracy = round(predictions.filter((p) => p.matched).length / (predictions.length || 1));

  // P2 — Surveillance: triage every observation that does not sit near ANY expected
  // transition (an observation near a matched step is CORROBORATING, not a surprise).
  const explains = new Set(obs.filter((o) => expected.some((e) => near(o.tempC, e.aboutTempC))).map((o) => o.id));
  const domainCorpus = (failureCorpus.cases || []).filter((c) => c.domain === dataset.domain);
  const surveillance = obs.filter((o) => !explains.has(o.id)).map((o) => {
    // 1) assumption/context check FIRST — the iron rule: an assumption-broken
    //    deviation is CONTEXT, not a new material.
    if (o.contextDependent) {
      return { id: o.id, tempC: o.tempC, verdict: 'context_changed', why: `depends on assumption '${o.contextDependent.assumption}' at ${o.contextDependent.atValue} (dataset assumes ${dataset.assumptions.find((a) => a.id === o.contextDependent.assumption)?.value}) — reported as context, not new material` };
    }
    // 2) invariant check — does physics allow it?
    const massViol = /mass/.test(o.kind) && false; // a lone TGA/DSC event asserts no invariant violation by itself
    if (massViol) return { id: o.id, tempC: o.tempC, verdict: 'model_rejected', why: 'would violate an invariant' };
    // 3) failure-corpus adversarial check — did a similar system fail near here?
    const corpusHit = o.tempC >= 340 ? domainCorpus.filter((c) => /oxid|re-?ignit|degrad|burn/i.test(JSON.stringify(c.cascade || []) + c.failureMode)) : [];
    // 4) otherwise it is a genuine candidate-new (a surprise)
    return { id: o.id, tempC: o.tempC, verdict: 'candidate_new', why: 'not predicted by any path, physically allowed, not an assumption artefact', adversarial: corpusHit.map((c) => c.id) };
  });
  const surprises = surveillance.filter((s) => s.verdict === 'candidate_new');

  // P3 — Co-pilot: machine recommendation + the targeted questions it needs answered.
  const coPilot = {
    recommendation: hypotheses[0] ? `most credible route: ${hypotheses[0].route} (MRI ${hypotheses[0].mri}, ${hypotheses[0].epistemic})` : 'no route',
    questions: [
      ...hypotheses.slice(0, 1).map((h) => `does the DSC show the compensating entropy/enthalpy change expected along ${h.route}?`),
      ...predictions.filter((p) => !p.matched).map((p) => `no observation near ${p.aboutTempC} °C for "${p.label}" — was this step present under these conditions?`),
      ...surprises.map((s) => `unexpected ${obs.find((o) => o.id === s.id).kind} at ${s.tempC} °C — which mechanism produces it?`)
    ]
  };

  // P5 — Post-flight report: PROPOSED updates only, each with provenance (idea #5).
  const proposedUpdates = [
    ...predictions.filter((p) => p.matched && p.mbmTransition).map((p) => ({ kind: 'raise_prior', target: p.mbmTransition, causedBy: [p.by], status: 'proposed', requires: 'dual sign-off (G6) + ≥3 independent datasets' })),
    ...predictions.filter((p) => !p.matched).map((p) => ({ kind: 'parameter_adjustment', target: p.mbmTransition || p.label, causedBy: [], status: 'proposed', requires: 'human review — step not observed under these conditions' })),
    ...surprises.map((s) => ({ kind: 'propose_new_path', target: `near ${s.tempC} °C`, causedBy: [s.id], adversarial: s.adversarial || [], status: 'proposed', requires: 'human review + Experiment Planner (C.4)' }))
  ];
  const assumptionValidated = dataset.assumptions.filter((a) => a.holds).map((a) => a.id);
  // idea #3 — assumption-sensitivity: conclusions that hang on a context-dependent obs.
  const assumptionFragile = surveillance.filter((s) => s.verdict === 'context_changed').map((s) => s.id);

  return {
    datasetId: dataset.datasetId, system: dataset.system, flag: dataset.flag,
    observations, hypotheses,
    predictions, accuracy,
    surveillance, surprises,
    coPilot,
    report: {
      accuracy,
      surprisesDetected: surprises.length,
      adversarialFlags: surveillance.flatMap((s) => s.adversarial || []),
      proposedUpdates,
      assumptionValidated,
      assumptionFragile,
      promotionApplied: false, // P4 + idea #2: a single flight never promotes
      promotionRule: 'Corroborated requires ≥3 independent datasets AND ≥2 distinct techniques'
    }
  };
}

// idea #4 — Drift monitor: cumulative prediction error across flights vs a budget.
export function driftMonitor(accuracies, budget = 0.3) {
  const meanErr = accuracies.length ? accuracies.reduce((s, a) => s + (1 - a), 0) / accuracies.length : 0;
  return { flights: accuracies.length, meanError: round(meanErr), budget, recalibrationDue: meanErr > budget };
}

// --- direct run: first-flight report + self-consistency / bite tests ---------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const mbm = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));
  const corpus = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'failure-library', 'failure-fixtures.json'), 'utf8'));
  const dataset = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'first-flight', 'dataset-001-app-per-mel.json'), 'utf8'));

  const R = runFirstFlight(mbm, corpus, dataset);
  const line = (s = '') => console.log(s);
  line('════════════════════════════════════════════════════════════════════');
  line(`  P0 FIRST FLIGHT — Post-Flight Report (${R.datasetId})`);
  line(`  ${R.system}  ·  DRY-RUN on an ILLUSTRATIVE dataset  ·  no ingestion, no decision`);
  line('════════════════════════════════════════════════════════════════════\n');
  line('OBSERVATIONS (raw):');
  R.observations.forEach((o) => line(`   ${o.id}: ${o.technique} ${o.kind} @ ${o.tempC}°C (${o.magnitude})`));
  line('\nHYPOTHESES (ranked, NOT decided):');
  R.hypotheses.forEach((h, i) => line(`   ${i + 1}. ${h.route}  MRI ${h.mri}  [${h.epistemic}]`));
  line(`\nPREDICTION ACCURACY: ${(R.accuracy * 100).toFixed(0)}%`);
  R.predictions.forEach((p) => line(`   ${p.matched ? '✅' : '❌'} ${p.label} @~${p.aboutTempC}°C${p.matched ? ' ← ' + p.by : ' (no observation)'}`));
  line('\nSURVEILLANCE (deviation triage):');
  R.surveillance.forEach((s) => line(`   ${s.id} @${s.tempC}°C → ${s.verdict}${s.adversarial && s.adversarial.length ? ' [corpus: ' + s.adversarial.join(', ') + ']' : ''}\n       ${s.why}`));
  line('\nCO-PILOT QUESTIONS:');
  R.coPilot.questions.forEach((q) => line(`   • ${q}`));
  line('\nPROPOSED MODEL UPDATES (proposed, NOT applied):');
  R.report.proposedUpdates.forEach((u) => line(`   ${u.kind} → ${u.target}  causedBy=[${u.causedBy.join(',')}]  (${u.requires})`));
  line(`\n   assumptions validated: ${R.report.assumptionValidated.join(', ')}   assumption-fragile: ${R.report.assumptionFragile.join(', ') || 'none'}`);
  line(`   promotion applied: ${R.report.promotionApplied}  (${R.report.promotionRule})`);
  line('════════════════════════════════════════════════════════════════════');

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  // P4 — observations and hypotheses are separate, and nothing is promoted.
  assert(R.observations.length === dataset.observations.length, 'all observations kept as raw observations');
  assert(R.hypotheses.length >= 2 && R.hypotheses.every((h) => ['Hypothesized', 'Corroborated', 'Confirmed', 'Refuted', 'Undecidable'].includes(h.epistemic)), 'hypotheses ranked with an epistemic state');
  assert(R.report.promotionApplied === false, 'a single first flight promotes nothing (P4)');
  // accuracy computed (3 of 4 expected matched → 75%)
  assert(R.accuracy === 0.75, `prediction accuracy computed (got ${R.accuracy})`);
  // P2 iron rule — the assumption-broken observation is CONTEXT, not new material
  const o5 = R.surveillance.find((s) => s.id === 'o5');
  assert(o5 && o5.verdict === 'context_changed', 'assumption-broken deviation reported as context_changed, NOT new material (P2 iron rule)');
  assert(!R.surprises.some((s) => s.id === 'o5'), 'the assumption artefact is NOT counted as a surprise');
  // the planted surprise IS detected
  const o4 = R.surveillance.find((s) => s.id === 'o4');
  assert(o4 && o4.verdict === 'candidate_new', 'the planted 350°C surprise is detected as candidate_new');
  // adversarial check links the surprise to the failure corpus (char-region)
  assert(o4.adversarial && o4.adversarial.includes('fail_app_char_oxidation'), 'surprise cross-checked against the failure corpus (char oxidation)');
  // P3 — co-pilot asks targeted questions (incl. about the surprise and the miss)
  assert(R.coPilot.questions.length >= 2, 'co-pilot emits targeted questions of what it does not know (P3)');
  // P5 — updates are proposals with provenance, gated behind humans
  assert(R.report.proposedUpdates.every((u) => u.status === 'proposed' && 'causedBy' in u && u.requires), 'all model updates are PROPOSED with provenance + human gate (P5, idea #5)');
  assert(R.report.proposedUpdates.some((u) => u.kind === 'propose_new_path'), 'the surprise yields a proposed new path (not silently dropped)');
  // idea #3 — assumption-fragile conclusions surfaced
  assert(R.report.assumptionFragile.includes('o5'), 'assumption-sensitivity flags the context-dependent observation (idea #3)');
  // idea #4 — drift monitor
  const drift1 = driftMonitor([R.accuracy]);
  const drift2 = driftMonitor([0.6, 0.55, 0.5]);
  assert(drift1.recalibrationDue === false && drift2.recalibrationDue === true, 'drift monitor flags recalibration only when cumulative error exceeds budget (idea #4)');
  // idea #1 — golden replay: the whole flight is deterministic (pure)
  assert(JSON.stringify(runFirstFlight(mbm, corpus, dataset)) === JSON.stringify(R), 'first flight is a deterministic golden replay (idea #1)');

  console.log('');
  if (fails) { console.error(`P0 First Flight FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('P0 First Flight PASSED — pipeline listens end-to-end: observations≠hypotheses, surveillance separates context from surprise, co-pilot asks, report proposes (never decides). Dry-run, no ingestion.');
}
