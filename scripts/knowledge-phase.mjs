/**
 * Knowledge Phase Diagram — thermodynamics of knowledge.
 *
 * Instead of "MRI = 0.63", show the STATE of a piece of knowledge as a phase, and
 * enforce one law: knowledge can only move through ADJACENT phase transitions — an
 * Observation never jumps straight to Grounded; it climbs Inferred → StrongInferred
 * → Corroborated → Grounded. Falsification (a contradiction) can drop it at any
 * time. Report only — it classifies and checks legality; it decides nothing.
 *
 * Bands:  Stable  = {Confirmed, Corroborated, Grounded}
 *         Metastable = {StrongInferred, Inferred}
 *         Unstable = {Unknown, Contradiction, KnowledgeDebt, Refuted}
 */
// Upward ladder (rungs). Off-ladder perturbations sit below rung 0.
export const LADDER = ['Unknown', 'Inferred', 'StrongInferred', 'Corroborated', 'Grounded'];
export const BAND = {
  Grounded: 'stable', Confirmed: 'stable', Corroborated: 'stable',
  StrongInferred: 'metastable', Inferred: 'metastable',
  Unknown: 'unstable', Contradiction: 'unstable', KnowledgeDebt: 'unstable', Refuted: 'unstable'
};
const rung = (p) => (p === 'Confirmed' ? LADDER.indexOf('Grounded') : LADDER.indexOf(p)); // Confirmed ≡ top

export function phaseOfEpistemic(state) {
  return ({ Confirmed: 'Grounded', Corroborated: 'Corroborated', Hypothesized: 'Inferred', Undecidable: 'Unknown', Refuted: 'Refuted' })[state] || 'Unknown';
}
export function phaseOfEdge(edge) {
  if (edge.contradictions && edge.contradictions.length) return 'Contradiction';
  if (edge.status === 'unknown' || edge.status === 'candidate_new') return edge.contradictions && edge.contradictions.length ? 'Contradiction' : (edge.tier === 'inferred' ? 'Inferred' : 'Unknown');
  return ({ grounded: 'Grounded', strong: 'StrongInferred', inferred: 'Inferred' })[edge.tier] || 'Unknown';
}

/**
 * Legal move: upward only one rung at a time; downward (falsification) any amount;
 * dropping into Contradiction/Refuted always allowed; Knowledge can never skip a
 * rung upward (Observation ↛ Grounded).
 */
export function legalTransition(from, to) {
  if (to === 'Contradiction' || to === 'Refuted') return true; // a discovery can always destabilise
  const a = rung(from), b = rung(to);
  if (a < 0 || b < 0) return to === from; // off-ladder → only stay
  if (b > a) return b - a === 1;          // upward: exactly one rung
  return true;                            // downward / same: allowed
}

export function placeOnDiagram(items) {
  // items: [{id, phase}] → grouped by band with rung
  const cells = items.map((it) => ({ id: it.id, phase: it.phase, band: BAND[it.phase] || 'unstable', rung: rung(it.phase) }));
  const counts = cells.reduce((m, c) => ((m[c.band] = (m[c.band] || 0) + 1), m), {});
  return { cells, counts };
}

// --- direct run: demo + bite tests ------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  console.log('Knowledge Phase Diagram — phases + the no-jump law\n');
  console.log('  bands:', JSON.stringify({ stable: LADDER.slice(3), metastable: LADDER.slice(1, 3), unstable: ['Unknown', 'Contradiction', 'KnowledgeDebt'] }));

  // the law: no upward jumps
  assert(legalTransition('Inferred', 'StrongInferred') === true, 'Inferred → StrongInferred is legal (one rung up)');
  assert(legalTransition('Inferred', 'Grounded') === false, 'Inferred → Grounded is ILLEGAL (jumps rungs) — the no-jump law bites');
  assert(legalTransition('Unknown', 'Grounded') === false, 'Unknown → Grounded is ILLEGAL');
  assert(legalTransition('Corroborated', 'Grounded') === true, 'Corroborated → Grounded is legal (one rung up)');
  // falsification can drop any distance / always destabilise
  assert(legalTransition('Grounded', 'Inferred') === true, 'Grounded → Inferred is legal (downward is allowed)');
  assert(legalTransition('Grounded', 'Contradiction') === true, 'anything → Contradiction is allowed (a discovery can destabilise)');
  // band mapping
  assert(BAND.Grounded === 'stable' && BAND.Inferred === 'metastable' && BAND.Contradiction === 'unstable', 'phases map to the right bands');
  // edge/epistemic phase mapping
  assert(phaseOfEpistemic('Hypothesized') === 'Inferred' && phaseOfEpistemic('Corroborated') === 'Corroborated', 'epistemic → phase mapping');
  assert(phaseOfEdge({ tier: 'grounded', status: 'observed' }) === 'Grounded', 'grounded edge → Grounded phase');
  assert(phaseOfEdge({ tier: 'inferred', status: 'candidate_new', contradictions: ['conservation_of_mass'] }) === 'Contradiction', 'an edge with a contradiction is in the Contradiction phase');
  // placement partitions
  const d = placeOnDiagram([{ id: 'a', phase: 'Grounded' }, { id: 'b', phase: 'Inferred' }, { id: 'c', phase: 'Contradiction' }]);
  assert(d.cells.length === 3 && d.counts.stable === 1 && d.counts.metastable === 1 && d.counts.unstable === 1, 'placement partitions items into bands');

  console.log('');
  if (fails) { console.error(`Knowledge Phase Diagram FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('Knowledge Phase Diagram PASSED — phases + bands + the no-upward-jump law (falsification may drop); report only.');
}
