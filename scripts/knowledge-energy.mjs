/**
 * Knowledge Energy — the efficiency of knowledge creation, not just its amount.
 *
 * We already measure MRI, ΔK, surprise. This measures how much EFFORT it cost to
 * produce a unit of knowledge:
 *
 *     Knowledge Energy = (experiments × cost × time) / ΔK
 *
 * High energy = many experiments for little ΔK (inefficient). Low energy = a lean
 * program. It lets you COMPARE projects on efficiency, not size. Report only.
 */
const round = (x) => Number(x.toFixed(4));

export function knowledgeEnergy({ experiments, cost, time, deltaK }) {
  const dk = Math.max(1e-6, deltaK);
  const energy = round((experiments * cost * time) / dk);
  return { experiments, cost, time, deltaK: round(deltaK), energy, efficiency: round(1 / energy) };
}

export function compareProjects(projects) {
  const scored = projects.map((p) => ({ name: p.name, ...knowledgeEnergy(p) })).sort((a, b) => a.energy - b.energy);
  return { ranked: scored, mostEfficient: scored[0]?.name, leastEfficient: scored[scored.length - 1]?.name };
}

// --- direct run: demo + bite tests ------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  // Illustrative projects (flagged): same ΔK, different effort.
  const lean = { name: 'lean (5 exp)', experiments: 5, cost: 2, time: 3, deltaK: 1 };
  const heavy = { name: 'heavy (100 exp)', experiments: 100, cost: 2, time: 3, deltaK: 1 };
  const cmp = compareProjects([heavy, lean]);

  console.log('Knowledge Energy — effort per unit of knowledge (illustrative)\n');
  cmp.ranked.forEach((p) => console.log(`  ${p.name.padEnd(16)} energy ${p.energy}  (exp ${p.experiments}, ΔK ${p.deltaK})`));
  console.log(`  most efficient: ${cmp.mostEfficient}\n`);

  // more experiments for the same ΔK ⇒ higher energy (less efficient)
  assert(knowledgeEnergy(heavy).energy > knowledgeEnergy(lean).energy, 'more experiments per ΔK ⇒ higher Knowledge Energy (less efficient)');
  // more ΔK for the same effort ⇒ lower energy
  assert(knowledgeEnergy({ ...lean, deltaK: 2 }).energy < knowledgeEnergy(lean).energy, 'more ΔK for the same effort ⇒ lower energy');
  // ranking puts the lean project first
  assert(cmp.mostEfficient === 'lean (5 exp)' && cmp.leastEfficient === 'heavy (100 exp)', 'projects are comparable on efficiency');
  // guard: ΔK → 0 does not divide-by-zero (energy is large but finite)
  assert(Number.isFinite(knowledgeEnergy({ experiments: 3, cost: 1, time: 1, deltaK: 0 }).energy), 'ΔK = 0 is guarded (finite energy)');
  // purity
  assert(JSON.stringify(knowledgeEnergy(lean)) === JSON.stringify(knowledgeEnergy(lean)), 'knowledgeEnergy is pure');

  console.log('');
  if (fails) { console.error(`Knowledge Energy FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('Knowledge Energy PASSED — effort-per-ΔK measured; projects comparable on efficiency; report only.');
}
