/**
 * Failure Pattern Engine + Negative Knowledge.
 *
 * Two views over the failure corpus that a document store can't give you:
 *
 * 1) Failure Pattern Engine — mine RECURRING event sub-sequences across the
 *    cascades. If the same 2-step (or longer) sequence shows up in several
 *    unrelated cases, it is a reusable failure MOTIF (e.g. "water ingress →
 *    adhesion loss"). This is failure evolution, not retrieval.
 *
 * 2) Negative Knowledge — collect the antiConditions into "where you must NOT
 *    operate" boundaries. This maps onto FSCTM: Knowledge (what is observed) ·
 *    Contradiction (where it breaks) · Boundary (conditions of failure) · Law
 *    (a validity envelope with break conditions).
 *
 * Report only. Pure functions over the corpus.
 */
export function failurePatterns(cases, minSupport = 2) {
  // count n-grams (n=2,3) over cascades
  const ngrams = {};
  for (const c of cases) {
    const seq = c.cascade || [];
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= seq.length; i++) {
        const key = seq.slice(i, i + n).join(' → ');
        (ngrams[key] ||= { pattern: key, length: n, cases: [] }).cases.push(c.id);
      }
    }
  }
  const recurring = Object.values(ngrams)
    .filter((g) => new Set(g.cases).size >= minSupport)
    .map((g) => ({ ...g, support: new Set(g.cases).size, cases: [...new Set(g.cases)] }))
    .sort((a, b) => b.support - a.support || b.length - a.length);
  return { recurring, total: Object.keys(ngrams).length };
}

export function negativeKnowledge(cases) {
  // group antiConditions by domain into a boundary set (FSCTM Boundary/Law).
  const byDomain = {};
  for (const c of cases) {
    for (const cond of c.antiConditions || []) {
      (byDomain[c.domain] ||= []).push({ condition: cond, from: c.id, materialSystem: c.materialSystem });
    }
  }
  const boundaries = Object.fromEntries(Object.entries(byDomain).map(([d, list]) => [d, list.map((x) => x.condition)]));
  // FSCTM framing per case: Knowledge / Contradiction / Boundary / Law
  const fsctm = cases.map((c) => ({
    id: c.id,
    knowledge: c.observedSymptoms,                         // what is observed
    contradiction: c.brokenInvariant || null,             // where a law bends
    boundary: c.antiConditions || [],                     // conditions of failure
    law: (c.antiConditions || []).length ? `valid EXCEPT: ${(c.antiConditions || []).join('; ')}` : null
  }));
  const totalConditions = Object.values(byDomain).reduce((s, l) => s + l.length, 0);
  return { boundaries, fsctm, totalConditions };
}

// --- direct run: demo + self-consistency ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const corpus = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'failure-library', 'failure-fixtures.json'), 'utf8'));

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  const pat = failurePatterns(corpus.cases);
  const neg = negativeKnowledge(corpus.cases);

  console.log('Failure Pattern Engine — recurring failure motifs across the corpus\n');
  pat.recurring.slice(0, 6).forEach((g) => console.log(`  [${g.support}×] ${g.pattern}   (${g.cases.join(', ')})`));
  console.log('\nNegative Knowledge — where you must NOT operate (FSCTM boundaries)\n');
  for (const [d, conds] of Object.entries(neg.boundaries)) console.log(`  ${d}: ${conds.length} boundary condition(s)`);
  const sample = neg.fsctm.find((f) => f.law);
  console.log(`\n  e.g. ${sample.id} → law: "${sample.law}"`);
  console.log('');

  // --- self-consistency -----------------------------------------------------
  assert(pat.recurring.length >= 1, 'at least one recurring failure motif found');
  // the two motifs we planted must surface
  const patterns = pat.recurring.map((g) => g.pattern);
  assert(patterns.includes('water ingress → adhesion loss'), 'motif "water ingress → adhesion loss" recurs (≥2 cases)');
  assert(patterns.includes('weak char → fire failure'), 'motif "weak char → fire failure" recurs (≥2 cases)');
  // every recurring motif genuinely appears in ≥2 distinct cases
  assert(pat.recurring.every((g) => g.support >= 2), 'every reported motif has support ≥2');
  // a non-existent motif is not reported (the miner does not fabricate)
  assert(!patterns.includes('unicorn → rainbow'), 'the miner does not invent motifs');
  // negative knowledge captured across domains
  assert(Object.keys(neg.boundaries).length === 4, 'boundaries captured for all four domains');
  assert(neg.totalConditions >= 12, 'a meaningful set of anti-conditions collected');
  // FSCTM law only where there are anti-conditions
  assert(neg.fsctm.every((f) => (f.boundary.length > 0) === (f.law != null)), 'FSCTM law present iff boundary conditions exist');
  // purity
  assert(JSON.stringify(failurePatterns(corpus.cases)) === JSON.stringify(pat), 'failurePatterns is pure (deterministic)');

  if (fails) { console.error(`Failure Pattern Engine FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('Failure Pattern Engine PASSED — recurring motifs mined, negative-knowledge boundaries extracted (FSCTM); report only.');
}
