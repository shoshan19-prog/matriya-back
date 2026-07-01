/**
 * MBM Stage C.13 — Contradiction Memory.
 *
 * Don't delete contradictions — store them as knowledge objects. When a
 * prediction meets an experiment and loses, that refutation is an ASSET: over
 * time it shows which mechanisms produce the most contradictions, which
 * uncertainty components mislead, and which regions of the model are least
 * stable. Report only; it accumulates memory, it decides nothing.
 *
 * A contradiction here = the planner predicted a gain but the experiment
 * delivered none (or a reversal): predictedDeltaMRI > ε and observedDeltaMRI ≤ 0.
 * (Invariant-violation contradictions are surfaced by C.8; this is the
 * prediction-vs-reality kind.)
 */
const round = (x) => Number(x.toFixed(4));
const EPS = 0.01;

const tally = (items, keyFn) => {
  const m = {};
  for (const it of items) m[keyFn(it)] = (m[keyFn(it)] || 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};

/**
 * @param {Array} events  calibration records {id, experimentType, targetTransition, uncertaintyComponent, predictedDeltaMRI, observedDeltaMRI}
 * @param {Array} prior   an existing contradiction ledger to append to (memory persists)
 */
export function contradictionMemory(events, prior = []) {
  const fresh = events
    .filter((e) => e.predictedDeltaMRI > EPS && e.observedDeltaMRI <= 0)
    .map((e) => ({
      id: e.id, experimentType: e.experimentType, targetTransition: e.targetTransition,
      uncertaintyComponent: e.uncertaintyComponent,
      predictedDeltaMRI: e.predictedDeltaMRI, observedDeltaMRI: e.observedDeltaMRI,
      magnitude: round(e.predictedDeltaMRI - e.observedDeltaMRI)
    }));
  const ledger = [...prior, ...fresh];
  return {
    ledger,
    added: fresh.length,
    byTransition: tally(ledger, (c) => c.targetTransition),
    byMechanism: tally(ledger, (c) => c.experimentType),
    byComponent: tally(ledger, (c) => c.uncertaintyComponent),
    // least-stable regions = transitions with the most refutations
    unstableRegions: Object.entries(tally(ledger, (c) => c.targetTransition)).filter(([, n]) => n >= 1).map(([t, n]) => ({ target: t, contradictions: n }))
  };
}

// --- direct run: demo + self-consistency ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  // Illustrative events (clearly synthetic): some experiments refute predictions.
  const round1 = [
    { id: 'e1', experimentType: 'Measurement', targetTransition: 'app_xl2', uncertaintyComponent: 'modelGap', predictedDeltaMRI: 0.25, observedDeltaMRI: 0.0 },   // refuted
    { id: 'e2', experimentType: 'Measurement', targetTransition: 'app_ppa2', uncertaintyComponent: 'evidence', predictedDeltaMRI: 0.14, observedDeltaMRI: 0.05 },  // under-delivered, not refuted
    { id: 'e3', experimentType: 'Validation', targetTransition: 'app_ppa1', uncertaintyComponent: 'modelGap', predictedDeltaMRI: 0.02, observedDeltaMRI: 0.02 }     // held
  ];
  const round2 = [
    { id: 'e4', experimentType: 'Measurement', targetTransition: 'app_xl2', uncertaintyComponent: 'weakLink', predictedDeltaMRI: 0.09, observedDeltaMRI: -0.01 }   // refuted again
  ];

  const mem1 = contradictionMemory(round1);
  const mem2 = contradictionMemory(round2, mem1.ledger); // memory persists across rounds

  console.log('MBM Contradiction Memory — refutations kept as knowledge\n');
  console.log(`  round 1 added ${mem1.added}, round 2 added ${mem2.added}, total ledger ${mem2.ledger.length}`);
  console.log(`  most contradiction-prone transition(s): ${JSON.stringify(mem2.byTransition)}`);
  console.log(`  by mechanism: ${JSON.stringify(mem2.byMechanism)}   by component: ${JSON.stringify(mem2.byComponent)}\n`);

  // only genuine contradictions are stored (under-delivery e2 and held e3 are NOT)
  assert(mem1.added === 1 && mem1.ledger[0].id === 'e1', 'only refutations (predicted gain, observed ≤ 0) are stored');
  // memory persists and accumulates
  assert(mem2.ledger.length === 2, 'memory accumulates across rounds (nothing deleted)');
  // app_xl2 is the least-stable region (2 contradictions)
  assert(mem2.byTransition.app_xl2 === 2, 'app_xl2 flagged as the most contradiction-prone transition');
  assert(mem2.unstableRegions[0].target === 'app_xl2', 'unstable regions ranked by contradiction count');
  // purity
  assert(JSON.stringify(contradictionMemory(round1)) === JSON.stringify(mem1), 'contradictionMemory is pure (deterministic)');

  if (fails) { console.error(`MBM Contradiction Memory FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Contradiction Memory PASSED — refutations retained & aggregated by transition/mechanism/component; report only.');
}
