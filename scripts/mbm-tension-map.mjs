/**
 * MBM Stage C.8 — Knowledge Tension Map.
 *
 * C.1–C.5 reason about a single path. C.8 lifts uncertainty to the WHOLE model:
 * a map of the state graph that shows, at a glance, WHERE knowledge is solid and
 * where it is fragile. It is a research-management view, not a path metric.
 *
 * Each state is labelled by the character of its outgoing behaviour (priority
 * order, most-salient first):
 *   • coverage_gap — a frontier with no known outgoing transition, or a state whose
 *                    only known evolution is unvalidated/unevidenced (all guesses)
 *   • contradiction— an outgoing transition genuinely VIOLATES an invariant
 *                    (a real conflict — NOT a declared exception like normal mass
 *                    loss, which is legitimate and never a contradiction)
 *   • tension      — competing mechanisms: ≥2 outgoing routes to different states
 *                    (the model offers more than one explanation)
 *   • stable       — a single, validated, evidenced outgoing transition
 *
 * Report only — it flags where to look; it decides nothing.
 */
import { transitionConfidence } from './mbm-reliability.mjs';
import { checkInvariants } from './mbm-invariants.mjs';

const REAL = (t) => t.status !== 'unknown' && t.status !== 'impossible';
const round = (x) => Number(x.toFixed(4));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const UNVALIDATED = (s) => s === 'hypothesized' || s === 'predicted';

export function tensionMap(doc) {
  const states = (doc.states || []).map((s) => (typeof s === 'string' ? s : s.id));
  const outOf = {};
  for (const t of doc.transitions || []) (outOf[t.fromState] ||= []).push(t);

  const cells = states.map((state) => {
    const outs = (outOf[state] || []);
    const real = outs.filter(REAL);
    const confs = real.map((t) => transitionConfidence(t).c);
    const distinctTargets = new Set(real.map((t) => t.toState).filter((x) => x != null));
    const hasException = real.some((t) => (t.invariantExceptions || []).length > 0);
    const allUnvalidated = real.length > 0 && real.every((t) => UNVALIDATED(t.status) || (t.evidence || []).length === 0);
    // genuine violation = an invariant fails (checkInvariants honours declared
    // exceptions, so ok=false here is a real, undeclared conflict).
    const hasViolation = real.some((t) => !checkInvariants({ states: doc.states, transitions: [t] }).allOk);

    let label;
    if (real.length === 0) label = 'coverage_gap';   // frontier: no known evolution
    else if (hasViolation) label = 'contradiction';  // a real conflict, not a declared exception
    else if (distinctTargets.size >= 2) label = 'tension'; // competing mechanisms
    else if (allUnvalidated) label = 'coverage_gap'; // only guesses leave this state
    else label = 'stable';

    return {
      state, label,
      outDegree: real.length,
      competingTargets: distinctTargets.size,
      meanConfidence: round(mean(confs)),
      hasInvariantException: hasException
    };
  });

  const counts = cells.reduce((m, c) => ((m[c.label] = (m[c.label] || 0) + 1), m), {});
  const n = cells.length || 1;
  // Fraction of the model NOT solid — feeds RRI (C.12).
  const tensionIndex = round((n - (counts.stable || 0)) / n);
  const hotspots = {
    tension: cells.filter((c) => c.label === 'tension').map((c) => c.state),
    contradiction: cells.filter((c) => c.label === 'contradiction').map((c) => c.state),
    coverage_gap: cells.filter((c) => c.label === 'coverage_gap').map((c) => c.state)
  };
  return { cells, counts, tensionIndex, hotspots };
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

  const map = tensionMap(doc);
  console.log('MBM Knowledge Tension Map — where the whole model is solid vs. fragile\n');
  console.log(`  counts: ${Object.entries(map.counts).map(([k, v]) => `${k}=${v}`).join('  ')}   tensionIndex=${map.tensionIndex}\n`);
  for (const label of ['tension', 'contradiction', 'coverage_gap', 'stable']) {
    const cs = map.cells.filter((c) => c.label === label);
    if (!cs.length) continue;
    console.log(`  ${label}:`);
    for (const c of cs) console.log(`    ${c.state.padEnd(28)} out=${c.outDegree} competing=${c.competingTargets} meanConf=${c.meanConfidence}${c.hasInvariantException ? ' [exception]' : ''}`);
  }
  console.log('');

  // --- self-consistency -----------------------------------------------------
  assert(map.cells.length === (doc.states || []).length, 'every state is classified exactly once');
  assert(map.cells.every((c) => ['stable', 'tension', 'contradiction', 'coverage_gap'].includes(c.label)), 'every cell carries a valid label');
  assert(map.tensionIndex >= 0 && map.tensionIndex <= 1, 'tensionIndex in [0,1]');
  // app:solid branches to PPA / crosslinked / char (competing mechanisms) ⇒ tension
  const solid = map.cells.find((c) => c.state === 'app:solid');
  assert(solid && solid.competingTargets >= 2, 'app:solid shows ≥2 competing mechanisms (branch point)');
  assert(solid.label === 'tension', `app:solid labelled tension (got ${solid && solid.label})`);
  // a terminal/frontier state with no real outgoing transition is a coverage gap
  assert(map.hotspots.coverage_gap.length >= 1, 'at least one coverage-gap / frontier state is flagged');
  // declared exceptions (normal mass loss) are NOT mislabelled as contradictions
  assert((map.counts.contradiction || 0) === 0, 'no false contradictions: declared invariant exceptions are legitimate');
  // counts partition the states
  assert(Object.values(map.counts).reduce((a, b) => a + b, 0) === map.cells.length, 'label counts partition all states');
  // purity
  assert(JSON.stringify(tensionMap(doc)) === JSON.stringify(map), 'tensionMap is pure (deterministic)');

  // BITE TEST: inject a genuine invariant violation (mass created, no declared
  // exception) ⇒ its state is flagged contradiction.
  const violating = {
    states: [...doc.states, { id: 'bite:from', material: 'bite', state: 'a', phase: 'solid' }, { id: 'bite:to', material: 'bite', state: 'b', phase: 'solid' }],
    transitions: [{ id: 'bite_v', fromState: 'bite:from', toState: 'bite:to', drivers: ['temperature'], reversibility: 'irreversible', status: 'observed', entropy: 'decrease', confidence: 0.8, evidence: [{ documentType: 'illustrative' }], mechanism: 'injected violation', resultingProperties: ['mass ↑ created from nothing'] }]
  };
  const bmap = tensionMap(violating);
  const biteCell = bmap.cells.find((c) => c.state === 'bite:from');
  assert(biteCell && biteCell.label === 'contradiction', `bite: a genuine invariant violation is flagged as contradiction (got ${biteCell && biteCell.label})`);

  if (fails) { console.error(`MBM Knowledge Tension Map FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Knowledge Tension Map PASSED — model-wide stability/tension/contradiction/coverage-gap map; report only.');
}
