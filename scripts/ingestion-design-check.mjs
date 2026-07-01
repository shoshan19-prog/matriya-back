/**
 * Ingestion Pipeline — DESIGN gate check.
 *
 * DESIGN ONLY. This does not run ingestion, fetch anything, or insert a corpus.
 * It encodes the human-in-the-loop pipeline's GATES as a pure function and proves
 * each gate BITES on tiny design fixtures. A request may be promoted to a grounded
 * Failure Case only if EVERY gate passes:
 *
 *   G1 human submitter        — no auto-fetch / auto-submit
 *   G2 provenance confirmed    — identifier + exact edition/DOI confirmed by a human
 *   G3 evidence graded         — a real tier (not illustrative/null)
 *   G4 no invented chemistry   — every scientific claim has a CONFIRMED citation anchor
 *   G5 MBM mapping confirmed    — a human confirmed the link into the model
 *   G6 dual-control sign-off    — two DISTINCT reviewers signed
 *
 * Only G1..G6 all true ⇒ promotable (flag flips illustrative → sourced).
 */
const ANCHOR_REQUIRED = ['claimedMechanism', 'observedSymptoms', 'mappedMBM', 'antiConditions'];

export function evaluateIngestionRequest(req) {
  const gates = {};
  const reasons = [];
  const fail = (g, why) => { gates[g] = false; reasons.push(`${g}: ${why}`); };
  const pass = (g) => { gates[g] = true; };

  // G1 — human submitter
  req.submittedBy && req.submittedBy.length >= 2 ? pass('G1_humanSubmitter') : fail('G1_humanSubmitter', 'no human submitter (pipeline never auto-fetches)');

  // G2 — provenance confirmed by a human, exact edition/DOI verified
  const pr = req.provenanceReview || {};
  (pr.status === 'confirmed' && pr.identifierConfirmed && pr.editionOrDoiConfirmed && pr.reviewer)
    ? pass('G2_provenanceConfirmed') : fail('G2_provenanceConfirmed', 'source identifier and exact edition/DOI not human-confirmed');

  // G3 — evidence graded to a real tier
  (req.evidenceQuality && req.evidenceQuality !== 'illustrative')
    ? pass('G3_evidenceGraded') : fail('G3_evidenceGraded', 'evidence quality not graded (still illustrative/null)');

  // G4 — no invented chemistry: every required scientific claim has a CONFIRMED anchor
  const anchors = (req.citationAnchors || []).filter((a) => a.confirmed && a.quote);
  const anchoredFields = new Set(anchors.map((a) => a.field));
  const pc = req.proposedCase || {};
  const missing = ANCHOR_REQUIRED.filter((f) => {
    const v = pc[f];
    const present = Array.isArray(v) ? v.length > 0 : v != null && v !== '';
    return present && !anchoredFields.has(f); // a present claim with no confirmed anchor = invented chemistry
  });
  missing.length === 0 ? pass('G4_noInventedChemistry') : fail('G4_noInventedChemistry', `unanchored claim(s): ${missing.join(', ')}`);

  // G5 — MBM mapping confirmed by a human
  (req.mbmMapping && req.mbmMapping.confirmedBy) ? pass('G5_mbmMappingConfirmed') : fail('G5_mbmMappingConfirmed', 'MBM mapping not human-confirmed');

  // G6 — dual-control sign-off by two distinct reviewers
  const s = req.signoff || {};
  (s.status === 'signed' && s.reviewer1 && s.reviewer2 && s.reviewer1 !== s.reviewer2)
    ? pass('G6_dualSignoff') : fail('G6_dualSignoff', 'needs two DISTINCT reviewers signed (dual control)');

  const promotable = Object.values(gates).every(Boolean);
  return { promotable, gates, reasons, resultingFlag: promotable ? 'sourced' : null };
}

// --- direct run: design fixtures + bite tests -------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  // A fully-valid DESIGN fixture (illustrative of a real request — no real source fetched).
  const valid = {
    requestId: 'ingest_demo_ok',
    submittedBy: 'analyst.a',
    submittedAt: '2026-07-01',
    rawSource: { type: 'standard', identifier: 'ASTM C1012', title: 'Sulfate length change', authors: null, year: '1984', license: 'ASTM', accessRights: 'licensed' },
    provenanceReview: { status: 'confirmed', reviewer: 'reviewer.p', identifierConfirmed: true, editionOrDoiConfirmed: true, note: 'edition confirmed' },
    evidenceQuality: 'standard',
    proposedCase: {
      claimedMechanism: 'expansive ettringite formation under sulfate exposure',
      observedSymptoms: ['expansion', 'cracking'],
      cascade: ['sulfate ingress', 'ettringite formation', 'expansion', 'cracking'],
      antiConditions: ['high-C3A cement in sulfate exposure'],
      mappedMBM: { fromState: 'concrete:intact', toState: 'concrete:sulfate_expanded', mechanism: 'ettringite expansion' },
      brokenInvariant: null
    },
    citationAnchors: [
      { field: 'claimedMechanism', locator: '§1', quote: 'sulfate reacts to form expansive ettringite', confirmed: true },
      { field: 'observedSymptoms', locator: '§7', quote: 'length change and cracking observed', confirmed: true },
      { field: 'mappedMBM', locator: '§1', quote: 'expansion of the mortar bar', confirmed: true },
      { field: 'antiConditions', locator: '§5', quote: 'high-C3A cements are susceptible', confirmed: true }
    ],
    mbmMapping: { confirmedBy: 'reviewer.d', proposesNewState: true, proposesNewTransition: true, note: null },
    signoff: { status: 'signed', reviewer1: 'reviewer.p', reviewer2: 'reviewer.d' },
    promotion: { status: 'quarantined', resultingFlag: null }
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const okEval = evaluateIngestionRequest(valid);
  console.log('Ingestion Pipeline — DESIGN gate check (no ingestion, no fetch)\n');
  console.log(`  valid request → promotable=${okEval.promotable}  flag=${okEval.resultingFlag}`);
  console.log(`  gates: ${Object.entries(okEval.gates).map(([g, v]) => `${g.split('_')[0]}${v ? '✓' : '✗'}`).join(' ')}\n`);
  assert(okEval.promotable === true && okEval.resultingFlag === 'sourced', 'a fully-gated request is promotable to sourced');

  // BITE TESTS — each removes exactly one gate and must block promotion.
  const bites = [
    ['G1', (r) => { r.submittedBy = ''; }, 'auto/anonymous submission blocked'],
    ['G2', (r) => { r.provenanceReview.editionOrDoiConfirmed = false; }, 'unconfirmed edition/DOI blocked'],
    ['G3', (r) => { r.evidenceQuality = 'illustrative'; }, 'ungraded (illustrative) evidence blocked'],
    ['G4', (r) => { r.citationAnchors = r.citationAnchors.filter((a) => a.field !== 'claimedMechanism'); }, 'unanchored mechanism (invented chemistry) blocked'],
    ['G4b', (r) => { r.citationAnchors.forEach((a) => { a.confirmed = false; }); }, 'unconfirmed anchors blocked'],
    ['G5', (r) => { delete r.mbmMapping.confirmedBy; }, 'unconfirmed MBM mapping blocked'],
    ['G6', (r) => { r.signoff.reviewer2 = r.signoff.reviewer1; }, 'single-reviewer (no dual control) blocked']
  ];
  for (const [label, mutate, desc] of bites) {
    const r = clone(valid); mutate(r);
    const e = evaluateIngestionRequest(r);
    console.log(`  bite ${label}: promotable=${e.promotable}  (${e.reasons[0] || 'ok'})`);
    assert(e.promotable === false, `${label} — ${desc}`);
  }

  // the anti-invented-chemistry gate is the crux: it must be the failing gate for G4
  const g4 = evaluateIngestionRequest((() => { const r = clone(valid); r.citationAnchors = r.citationAnchors.filter((a) => a.field !== 'claimedMechanism'); return r; })());
  assert(g4.gates.G4_noInventedChemistry === false, 'the anti-invented-chemistry gate specifically fails when a claim is unanchored');
  // purity
  assert(JSON.stringify(evaluateIngestionRequest(valid)) === JSON.stringify(okEval), 'evaluateIngestionRequest is pure (deterministic)');

  console.log('');
  if (fails) { console.error(`Ingestion Design gate check FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('Ingestion Design gate check PASSED — all six gates bite; only a fully human-verified, anchored, dual-signed request promotes to sourced. Design only, no ingestion.');
}
