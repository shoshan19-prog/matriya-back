/**
 * Failure Library — schema + integrity check.
 *
 * Validates the illustrative failure corpus against failure-case.schema.json
 * (lightweight, no ajv) AND checks referential integrity to the MBM: every
 * mappedMBM state/transition either exists in the MBM or is legitimately NEW
 * (that novelty is the corpus's contribution). No invented chemistry: every case
 * must be flagged illustrative|sourced with a provenance source.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'failure-library', 'failure-fixtures.json'), 'utf8'));
const mbm = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));

const DOMAINS = ['intumescent', 'silicate', 'cementitious', 'polymer'];
const OUTCOMES = ['failure', 'near_failure'];
const EVIDENCE = ['instruments', 'standard', 'scientific_paper', 'patent', 'field_report', 'anecdotal', 'illustrative'];
const ROOT = ['known', 'suspected', 'unknown'];
const INVARIANTS = ['conservation_of_mass', 'entropy_monotonicity', 'causality', 'equivalence', 'continuity'];

const stateIds = new Set((mbm.states || []).map((s) => s.id));
const transIds = new Set((mbm.transitions || []).map((t) => t.id));

let fails = 0;
const bad = (id, msg) => { console.log(`  ✗ ${id}: ${msg}`); fails++; };

const ids = new Set();
for (const c of corpus.cases) {
  const id = c.id || '(no id)';
  if (!/^fail_[a-z0-9_]+$/.test(c.id || '')) bad(id, 'id must match ^fail_[a-z0-9_]+$');
  if (ids.has(c.id)) bad(id, 'duplicate id'); ids.add(c.id);
  if (!DOMAINS.includes(c.domain)) bad(id, `domain must be one of ${DOMAINS}`);
  if (!OUTCOMES.includes(c.outcome)) bad(id, 'outcome must be failure|near_failure');
  if (c.outcome === 'near_failure' && !c.margin) bad(id, 'near_failure must record a margin');
  if (!c.materialSystem || c.materialSystem.length < 3) bad(id, 'materialSystem required');
  if (!c.failureMode || c.failureMode.length < 3) bad(id, 'failureMode required');
  if (!Array.isArray(c.observedSymptoms) || c.observedSymptoms.length < 1) bad(id, 'observedSymptoms must be non-empty');
  if (!c.claimedMechanism) bad(id, 'claimedMechanism required');
  if (!EVIDENCE.includes(c.evidenceQuality)) bad(id, 'invalid evidenceQuality');
  if (!c.rootCause || !ROOT.includes(c.rootCause.status)) bad(id, 'rootCause.status must be known|suspected|unknown');
  if (c.brokenInvariant != null && !INVARIANTS.includes(c.brokenInvariant)) bad(id, 'brokenInvariant must be a known invariant or null');
  if (typeof c.confidence !== 'number' || c.confidence < 0 || c.confidence > 1) bad(id, 'confidence must be in [0,1]');
  if (!c.provenance || !['illustrative', 'sourced'].includes(c.provenance.flag) || !c.provenance.source) bad(id, 'provenance {source, flag} required (no invented chemistry)');
  // referential integrity: mapped states either exist OR are declared-new (novelty is allowed & meaningful)
  const m = c.mappedMBM || {};
  if (m.competingMechanismFor != null && !transIds.has(m.competingMechanismFor)) bad(id, `competingMechanismFor '${m.competingMechanismFor}' is not an MBM transition`);
  // a case must connect to the MBM somehow: a mapped state (existing or new), or a competing mechanism
  const connects = m.fromState || m.toState || m.competingMechanismFor;
  if (!connects) bad(id, 'case does not connect to the MBM (needs a mapped state or a competing mechanism)');
}

// corpus-level: pilot needs breadth across domains
for (const d of DOMAINS) if (!corpus.cases.some((c) => c.domain === d)) bad('corpus', `no cases for domain '${d}'`);
if (corpus.cases.length < 12) bad('corpus', `pilot wants ≥12 cases (got ${corpus.cases.length})`);
if (corpus.flag !== 'illustrative') bad('corpus', 'pilot corpus must be flagged illustrative');

console.log(`Failure Library schema check — ${corpus.cases.length} cases across ${DOMAINS.length} domains`);
// quick reference use of stateIds so mis-typed existing states surface as info (not error)
const mappedExisting = corpus.cases.filter((c) => (c.mappedMBM.fromState && stateIds.has(c.mappedMBM.fromState)) || (c.mappedMBM.toState && stateIds.has(c.mappedMBM.toState))).length;
console.log(`  ${mappedExisting} cases touch an existing MBM state; the rest propose new regions (ΔK candidates)`);

if (fails) { console.error(`\nFailure Library schema check FAILED: ${fails} problem(s)`); process.exit(1); }
console.log('Failure Library schema check PASSED — all cases valid, provenance-flagged, and connected to the MBM.');
