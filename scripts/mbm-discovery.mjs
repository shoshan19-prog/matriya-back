/**
 * MBM Stage C.15 — Discovery Opportunity Map.
 *
 * The rest of Stage C asks "what do we know / how sure are we?". C.15 asks the
 * opposite: "where is the highest chance to discover something NEW?" It combines
 * the existing signals into a ranked list of opportunities:
 *   • competing mechanisms  — a branch point where routes disagree (C.8 tension)
 *   • high uncertainty      — low outgoing confidence (Stage B)
 *   • low coverage          — a frontier / unvalidated region (C.8 coverage_gap)
 *   • industrial value      — OPTIONAL external weight (default neutral; supplied
 *                             per state by the caller — never invented)
 *
 * If you have budget for one exploratory experiment, the top row is where ΔK is
 * most likely. Report only — it ranks potential, it decides nothing.
 */
import { tensionMap } from './mbm-tension-map.mjs';

const round = (x) => Number(x.toFixed(4));
// Documented weights (tunable).
const W = { competing: 0.35, uncertainty: 0.35, coverage: 0.15, value: 0.15 };

export function discoveryOpportunities(doc, { industrialValue = {} } = {}) {
  const map = tensionMap(doc);
  const scored = map.cells.map((c) => {
    const competing = c.competingTargets >= 2 ? 1 : 0;
    const uncertainty = c.outDegree > 0 ? round(1 - c.meanConfidence) : 1; // frontier = maximal uncertainty
    const coverage = (c.label === 'coverage_gap') ? 1 : 0;
    const value = industrialValue[c.state] != null ? Math.max(0, Math.min(1, industrialValue[c.state])) : 0.5; // neutral default
    const score = round(W.competing * competing + W.uncertainty * uncertainty + W.coverage * coverage + W.value * value);
    return { state: c.state, label: c.label, score, drivers: { competing, uncertainty, coverage, value } };
  }).sort((a, b) => b.score - a.score);
  return { opportunities: scored, top: scored.slice(0, 5) };
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

  // Optional, caller-supplied industrial value (illustrative — never invented by the engine).
  const industrialValue = { 'app:solid': 1.0, 'concrete:intact': 0.9 };
  const d = discoveryOpportunities(doc, { industrialValue });

  console.log('MBM Discovery Opportunity Map — where new knowledge is most likely\n');
  d.top.forEach((o, i) => console.log(`  ${i + 1}. ${o.state.padEnd(26)} score ${o.score}  [${o.label}]  competing=${o.drivers.competing} uncertainty=${o.drivers.uncertainty} coverage=${o.drivers.coverage} value=${o.drivers.value}`));
  console.log('');

  // --- self-consistency -----------------------------------------------------
  assert(d.opportunities.length === (doc.states || []).length, 'every state is scored');
  for (let i = 1; i < d.opportunities.length; i++) assert(d.opportunities[i - 1].score >= d.opportunities[i].score, 'opportunities ranked by score descending');
  assert(d.opportunities.every((o) => o.score >= 0 && o.score <= 1), 'scores in [0,1]');
  // app:solid: competing branch point + high industrial value ⇒ near the top
  assert(d.top.some((o) => o.state === 'app:solid'), 'app:solid (competing branch, high value) surfaces in the top opportunities');
  // industrial value moves the ranking (it is an input, not invented)
  const neutral = discoveryOpportunities(doc);
  const solidV = d.opportunities.find((o) => o.state === 'app:solid').score;
  const solidN = neutral.opportunities.find((o) => o.state === 'app:solid').score;
  assert(solidV > solidN, 'supplied industrial value raises app:solid’s discovery score (external input respected)');
  // purity
  assert(JSON.stringify(discoveryOpportunities(doc, { industrialValue })) === JSON.stringify(d), 'discoveryOpportunities is pure (deterministic)');

  if (fails) { console.error(`MBM Discovery Opportunity Map FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Discovery Opportunity Map PASSED — ranks discovery potential from competing/uncertainty/coverage/value; report only.');
}
