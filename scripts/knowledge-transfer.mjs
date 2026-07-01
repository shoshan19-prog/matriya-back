/**
 * Knowledge Transfer Engine (KTE) — learn from the SHAPE of how knowledge evolves,
 * never copy the knowledge itself.
 *
 * It does not ask "did this work in biology?". It asks "did the knowledge follow
 * the same developmental signature?" — e.g. Observation → Contradiction → Boundary
 * → NewModel → Law. If two domains share the structure, it emits a TRANSFER
 * CANDIDATE (a hypothesis-shaped hint for a human), NEVER a prediction and NEVER a
 * transferred conclusion. Structural similarity ≠ causal similarity.
 */
const STAGES = ['Observation', 'Contradiction', 'Boundary', 'NewModel', 'Law'];

export function signatureOf(events) {
  // ordered stage sequence, de-duplicated consecutively, normalised to the vocabulary
  const seq = [];
  for (const e of events) {
    const s = STAGES.find((x) => x.toLowerCase() === String(e.stage || '').toLowerCase());
    if (s && seq[seq.length - 1] !== s) seq.push(s);
  }
  return seq;
}

// order-preserving longest common subsequence length
function lcs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

export function matchSignatures(sigA, sigB, threshold = 0.8) {
  const common = lcs(sigA, sigB);
  const similarity = Number((common / Math.max(1, Math.max(sigA.length, sigB.length))).toFixed(3));
  return {
    similarity,
    transferCandidate: similarity >= threshold,
    kind: 'structural-similarity-only',
    disclaimer: 'Structural similarity is NOT proof of causal similarity. This is a TRANSFER CANDIDATE for human review — never a prediction, never a transferred conclusion.'
    // note: deliberately NO 'prediction' / 'conclusion' field exists.
  };
}

// --- direct run: demo + bite tests ------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  // Illustrative domain histories (flagged) — same developmental shape.
  const biology = [{ stage: 'Observation' }, { stage: 'Contradiction' }, { stage: 'Boundary' }, { stage: 'NewModel' }, { stage: 'Law' }];
  const fireRetardants = [{ stage: 'Observation' }, { stage: 'Observation' }, { stage: 'Contradiction' }, { stage: 'Boundary' }, { stage: 'NewModel' }, { stage: 'Law' }];
  const shallow = [{ stage: 'Observation' }, { stage: 'Law' }]; // jumped — different shape

  const sigBio = signatureOf(biology), sigFire = signatureOf(fireRetardants), sigShallow = signatureOf(shallow);
  const m1 = matchSignatures(sigBio, sigFire);
  const m2 = matchSignatures(sigBio, sigShallow);

  console.log('Knowledge Transfer Engine — structural signatures, not conclusions\n');
  console.log(`  biology:        ${sigBio.join(' → ')}`);
  console.log(`  fire retardants:${sigFire.join(' → ')}`);
  console.log(`  match(bio,fire):    similarity ${m1.similarity}  → ${m1.transferCandidate ? 'TRANSFER CANDIDATE' : 'no'}`);
  console.log(`  match(bio,shallow): similarity ${m2.similarity}  → ${m2.transferCandidate ? 'TRANSFER CANDIDATE' : 'no'}\n`);

  // same shape ⇒ transfer candidate; different shape ⇒ not
  assert(m1.transferCandidate === true && m1.similarity >= 0.8, 'same developmental signature ⇒ TRANSFER CANDIDATE');
  assert(m2.transferCandidate === false, 'a different (jumped) signature ⇒ NOT a candidate');
  // it NEVER emits a prediction or a transferred conclusion
  assert(!('prediction' in m1) && !('conclusion' in m1) && m1.kind === 'structural-similarity-only', 'KTE never emits a prediction/conclusion — structural similarity only');
  assert(/NOT proof of causal/.test(m1.disclaimer), 'every match carries the causal-similarity disclaimer');
  // signature extraction normalises + de-dups consecutive stages
  assert(sigFire.length === 5 && sigFire[0] === 'Observation', 'signature de-dups consecutive repeats');
  // purity
  assert(JSON.stringify(matchSignatures(sigBio, sigFire)) === JSON.stringify(m1), 'matchSignatures is pure');

  console.log('');
  if (fails) { console.error(`Knowledge Transfer Engine FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('Knowledge Transfer Engine PASSED — structural-signature matching; transfer CANDIDATES only, never conclusions; disclaimer always attached.');
}
