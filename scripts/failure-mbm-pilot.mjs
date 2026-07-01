/**
 * Failure Library → MBM Pilot.
 *
 * The decisive question before investing in full ingestion: does an EXTERNAL
 * failure corpus, run against the Material Behavior Model, actually GENERATE
 * knowledge — or is it just more documents? The pilot measures three yields:
 *
 *   1. new competing mechanisms — alternative explanations/routes the MBM lacks
 *   2. better experiments       — high-value tests surfaced on the MBM's own
 *                                 weakest (unvalidated / low-evidence) transitions
 *   3. new ΔK                   — new states, cross-subsystem couplings, candidate
 *                                 broken-law boundaries, and negative knowledge
 *
 * Novelty is DERIVED against the live MBM (not declared by the cases). Report only
 * — no ingestion, no decision. If all three yields are positive, the corpus is a
 * knowledge engine and full ingestion is worth designing.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { transitionConfidence } from './mbm-reliability.mjs';
import { failurePatterns, negativeKnowledge } from './failure-pattern-engine.mjs';

const subsystem = (s) => (s ? String(s).split(':')[0] : null);

export function runPilot(mbm, corpus) {
  const states = new Set((mbm.states || []).map((s) => s.id));
  const byId = Object.fromEntries((mbm.transitions || []).map((t) => [t.id, t]));
  const edges = new Set((mbm.transitions || []).filter((t) => t.toState).map((t) => `${t.fromState}->${t.toState}`));
  const low = (t) => !t || ['hypothesized', 'predicted'].includes(t.status) || transitionConfidence(t).tier < 1;

  const competingMechanisms = [];
  const betterExperiments = [];
  const newDeltaK = [];

  for (const c of corpus.cases) {
    const m = c.mappedMBM || {};
    const fromNew = m.fromState && !states.has(m.fromState);
    const toNew = m.toState && !states.has(m.toState);
    const newState = Boolean(fromNew || toNew);
    const bothExisting = m.fromState && m.toState && states.has(m.fromState) && states.has(m.toState);
    const edgeKey = m.fromState && m.toState ? `${m.fromState}->${m.toState}` : null;
    const newTransition = Boolean(edgeKey && !edges.has(edgeKey));
    const crossSubsystem = Boolean(m.fromState && m.toState && subsystem(m.fromState) !== subsystem(m.toState));
    const targetT = m.competingMechanismFor ? byId[m.competingMechanismFor] : null;

    // 1) competing mechanism: an alternative explanation of an existing edge, or a
    //    new route between two already-known states.
    if (m.competingMechanismFor || (newTransition && bothExisting)) {
      competingMechanisms.push({ id: c.id, for: m.competingMechanismFor || edgeKey, mechanism: m.mechanism, targetStatus: targetT ? targetT.status : 'n/a' });
    }
    // 2) better experiment: surfaced on the MBM's weak spots or on unexplored regions.
    if (c.suggestedExperiment && ((targetT && low(targetT)) || newState || newTransition)) {
      betterExperiments.push({ id: c.id, experiment: c.suggestedExperiment, lands_on: targetT ? `${m.competingMechanismFor} (${targetT.status})` : (newState ? 'new region' : edgeKey) });
    }
    // 3) new ΔK: new states / cross-subsystem coupling / candidate broken-law boundary.
    const reasons = [];
    if (newState) reasons.push(`new state(s): ${[fromNew && m.fromState, toNew && m.toState].filter(Boolean).join(', ')}`);
    if (crossSubsystem) reasons.push(`cross-subsystem coupling ${subsystem(m.fromState)}→${subsystem(m.toState)}`);
    if (c.brokenInvariant) reasons.push(`candidate broken law: ${c.brokenInvariant}`);
    if (reasons.length) newDeltaK.push({ id: c.id, reasons });
  }

  const patterns = failurePatterns(corpus.cases);
  const negative = negativeKnowledge(corpus.cases);

  // corroboration: how many corpus experiments land on the MBM's OWN weakest links
  const weakLinkHits = betterExperiments.filter((e) => /hypothesized|predicted/.test(e.lands_on)).map((e) => e.id);

  const verdict = competingMechanisms.length > 0 && betterExperiments.length > 0 && newDeltaK.length > 0;
  return {
    counts: {
      cases: corpus.cases.length,
      competingMechanisms: competingMechanisms.length,
      betterExperiments: betterExperiments.length,
      newDeltaK: newDeltaK.length,
      recurringMotifs: patterns.recurring.length,
      negativeKnowledgeConditions: negative.totalConditions
    },
    competingMechanisms, betterExperiments, newDeltaK,
    weakLinkHits, patterns: patterns.recurring, boundaries: negative.boundaries,
    verdict
  };
}

// --- direct run: full pilot report + self-consistency -----------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const mbm = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));
  const corpus = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'failure-library', 'failure-fixtures.json'), 'utf8'));
  const R = runPilot(mbm, corpus);

  const line = (s = '') => console.log(s);
  line('════════════════════════════════════════════════════════════════════');
  line('  FAILURE LIBRARY → MBM PILOT   (does an external corpus generate ΔK?)');
  line('  illustrative corpus · no ingestion · measurement / report only');
  line('════════════════════════════════════════════════════════════════════\n');
  line(`  corpus: ${R.counts.cases} standard failure cases across 4 coating families\n`);

  line(`1) NEW COMPETING MECHANISMS: ${R.counts.competingMechanisms}`);
  R.competingMechanisms.forEach((x) => line(`   ${x.id} → for ${x.for} (${x.targetStatus}): ${x.mechanism}`));
  line(`\n2) BETTER EXPERIMENTS SURFACED: ${R.counts.betterExperiments}  (of which ${R.weakLinkHits.length} land on the MBM's OWN unvalidated links)`);
  R.betterExperiments.slice(0, 6).forEach((x) => line(`   ${x.id} → ${x.experiment}  [${x.lands_on}]`));
  line(`\n3) NEW ΔK (new states / couplings / broken-law boundaries): ${R.counts.newDeltaK}`);
  R.newDeltaK.forEach((x) => line(`   ${x.id}: ${x.reasons.join('; ')}`));
  line(`\n   recurring failure motifs: ${R.counts.recurringMotifs}   negative-knowledge conditions: ${R.counts.negativeKnowledgeConditions}`);
  R.patterns.slice(0, 4).forEach((g) => line(`     [${g.support}×] ${g.pattern}`));

  line(`\n  VERDICT: ${R.verdict ? 'the external corpus GENERATES knowledge — designing full ingestion is justified.' : 'no clear knowledge yield — do NOT invest in ingestion yet.'}`);
  line('  (verdict is a recommendation, not a decision — a human approves the next step.)');
  line('════════════════════════════════════════════════════════════════════');

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };
  // the three success criteria
  assert(R.counts.competingMechanisms > 0, 'the corpus yields new competing mechanisms');
  assert(R.counts.betterExperiments > 0, 'the corpus surfaces better experiments');
  assert(R.counts.newDeltaK > 0, 'the corpus yields new ΔK (states/couplings/boundaries)');
  assert(R.verdict === true, 'pilot verdict: the corpus generates knowledge');
  // strong result: the corpus independently targets the MBM's own weakest links
  assert(R.weakLinkHits.length >= 1, 'at least one corpus experiment lands on an MBM unvalidated transition (independent corroboration)');
  assert(R.competingMechanisms.some((x) => x.for === 'app_xl2'), 'corpus offers a competing mechanism for the hypothesized app_xl2 (the MBM\'s weakest APP link)');
  // ΔK includes a genuine cross-subsystem coupling (concrete carbonation → steel corrosion)
  assert(R.newDeltaK.some((x) => x.reasons.some((r) => /cross-subsystem/.test(r))), 'ΔK includes a cross-subsystem coupling');
  // novelty is derived, not declared: an existing edge with a competing mechanism is NOT counted as a new state
  assert(R.newDeltaK.every((x) => x.id !== 'fail_polymer_osmotic_blister'), 'an existing-edge competing mechanism is not miscounted as new ΔK');
  // purity
  assert(JSON.stringify(runPilot(mbm, corpus)) === JSON.stringify(R), 'runPilot is pure (deterministic)');

  console.log('');
  if (fails) { console.error(`Failure Library → MBM Pilot FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('Failure Library → MBM Pilot PASSED — corpus yields competing mechanisms, better experiments & ΔK; verdict positive; report only.');
}
