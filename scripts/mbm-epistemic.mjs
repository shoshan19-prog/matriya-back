/**
 * MBM Stage C.9 — Epistemic State.
 *
 * MRI is a number. Epistemic state is a KIND. Two paths can share an MRI yet be
 * epistemically different — a well-measured *hypothesis* vs. a thinly-sourced
 * *confirmed* mechanism. C.9 tags each path with a discrete state derived from
 * status + evidence tier + invariant standing (NOT from the MRI number):
 *
 *   Refuted      — a step is physically impossible or violates an invariant
 *   Undecidable  — the path contains an unknown step (toState/status unknown)
 *   Confirmed    — every step validated AND instrument-tier evidence throughout
 *   Corroborated — every step validated (observed/replicated/mechanism_supported)
 *                  with some evidence, but not all instrument-confirmed
 *   Hypothesized — at least one step is a hypothesis/prediction (a guess remains)
 *
 * This is the layer that will change DISCRETELY when real TGA/DSC data lands
 * (Corroborated → Confirmed, or → Refuted → Surprise). Report only.
 */
import { transitionConfidence } from './mbm-reliability.mjs';
import { checkInvariants } from './mbm-invariants.mjs';

const VALIDATED = new Set(['observed', 'replicated', 'mechanism_supported']);
const INSTRUMENTS = new Set(['tga', 'dsc', 'ftir', 'xrd', 'sem', 'uv_vis']);
const hasInstrument = (t) => (t.evidence || []).some((e) => INSTRUMENTS.has((e.documentType || '').toLowerCase()));
const hasEvidence = (t) => (t.evidence || []).length > 0;

export function epistemicState(doc, ids) {
  const byId = Object.fromEntries((doc.transitions || []).map((t) => [t.id, t]));
  const tx = ids.map((id) => byId[id]).filter(Boolean);
  const reasons = [];

  const impossible = tx.filter((t) => t.status === 'impossible' || t.toState == null && t.status === 'impossible');
  const violated = !checkInvariants({ states: doc.states, transitions: tx }).allOk;
  const unknown = tx.filter((t) => t.status === 'unknown' || (t.toState == null && t.status !== 'impossible'));

  let state;
  if (impossible.length || violated) { state = 'Refuted'; reasons.push(violated ? 'a step violates an invariant' : 'a step is physically impossible'); }
  else if (unknown.length) { state = 'Undecidable'; reasons.push(`unknown step(s): ${unknown.map((t) => t.id).join(', ')}`); }
  else if (tx.every((t) => VALIDATED.has(t.status)) && tx.every(hasInstrument)) { state = 'Confirmed'; reasons.push('every step validated with instrument-tier evidence'); }
  else if (tx.every((t) => VALIDATED.has(t.status)) && tx.every(hasEvidence)) { state = 'Corroborated'; reasons.push('every step validated & evidenced, but not all instrument-confirmed'); }
  else if (tx.every((t) => VALIDATED.has(t.status))) { state = 'Corroborated'; reasons.push('every step validated, but some steps lack evidence'); }
  else { state = 'Hypothesized'; reasons.push(`unvalidated step(s): ${tx.filter((t) => !VALIDATED.has(t.status)).map((t) => t.id).join(', ')}`); }

  return {
    ids, state, reasons,
    signals: {
      statuses: tx.map((t) => t.status),
      tiers: tx.map((t) => transitionConfidence(t).tier),
      allValidated: tx.every((t) => VALIDATED.has(t.status)),
      allInstrument: tx.every(hasInstrument),
      invariantsOk: !violated
    }
  };
}

// --- direct run: demo + self-consistency ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const { modelReliabilityIndex } = await import('./mbm-reliability.mjs');
  const { applyCandidate } = await import('./mbm-info-gain.mjs');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  const paths = [
    { name: 'crosslink route', ids: ['app_xl1', 'app_xl2'] },
    { name: 'polyphosphoric-acid route', ids: ['app_ppa1', 'app_ppa2'] },
    { name: 'epoxy thermal chain', ids: ['thermal_1', 'thermal_2', 'thermal_3'] }
  ];

  console.log('MBM Epistemic State — the KIND of knowledge, orthogonal to the MRI number\n');
  for (const p of paths) {
    const e = epistemicState(doc, p.ids);
    const mri = modelReliabilityIndex(doc, p.ids).mri;
    console.log(`  ${p.name.padEnd(26)} ${e.state.padEnd(12)} MRI=${mri}   (${e.reasons[0]})`);
  }

  // crosslink has a hypothesized step ⇒ Hypothesized; ppa is all-validated ⇒ Corroborated
  const xl = epistemicState(doc, ['app_xl1', 'app_xl2']);
  const ppa = epistemicState(doc, ['app_ppa1', 'app_ppa2']);
  assert(xl.state === 'Hypothesized', `crosslink route is Hypothesized (got ${xl.state})`);
  assert(ppa.state === 'Corroborated', `ppa route is Corroborated (got ${ppa.state})`);

  // ORTHOGONALITY to MRI: raise the ppa path's evidence to instrument tier ⇒ it
  // becomes Confirmed even though it was already the higher-MRI Corroborated path.
  let doc2 = doc;
  for (const id of ['app_ppa1', 'app_ppa2']) doc2 = applyCandidate(doc2, { kind: 'instrument', target: id, instrument: 'tga' });
  const ppaConfirmed = epistemicState(doc2, ['app_ppa1', 'app_ppa2']);
  assert(ppaConfirmed.state === 'Confirmed', `ppa route becomes Confirmed with instrument evidence (got ${ppaConfirmed.state})`);

  // Undecidable: a path through an unknown transition
  const unknownT = (doc.transitions || []).find((t) => t.status === 'unknown');
  if (unknownT) {
    const u = epistemicState(doc, [unknownT.id]);
    assert(u.state === 'Undecidable', `a path with an unknown step is Undecidable (got ${u.state})`);
    console.log(`  [unknown] ${unknownT.id.padEnd(24)} ${u.state}`);
  }
  // Refuted: a path through an impossible transition
  const impossibleT = (doc.transitions || []).find((t) => t.status === 'impossible');
  if (impossibleT) {
    const r = epistemicState(doc, [impossibleT.id]);
    assert(r.state === 'Refuted', `a path with an impossible step is Refuted (got ${r.state})`);
    console.log(`  [impossible] ${impossibleT.id.padEnd(21)} ${r.state}`);
  }
  // BITE: a genuine invariant violation ⇒ Refuted
  const bad = {
    states: [...doc.states, { id: 'z:a', material: 'z', state: 'a', phase: 'solid' }, { id: 'z:b', material: 'z', state: 'b', phase: 'solid' }],
    transitions: [{ id: 'z_v', fromState: 'z:a', toState: 'z:b', drivers: ['temperature'], reversibility: 'irreversible', status: 'observed', confidence: 0.8, evidence: [{ documentType: 'tga' }], mechanism: 'bad', resultingProperties: ['mass ↑ from nothing'] }]
  };
  assert(epistemicState(bad, ['z_v']).state === 'Refuted', 'an invariant-violating step ⇒ Refuted even with instrument evidence');

  console.log('');
  if (fails) { console.error(`MBM Epistemic State FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Epistemic State PASSED — Hypothesized/Corroborated/Confirmed/Refuted/Undecidable derived from evidence & invariants, not from MRI.');
}
