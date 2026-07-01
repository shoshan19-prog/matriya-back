/**
 * External Failure KB — Provenance Pilot (Evidence Upgrade).
 *
 * The illustrative pilot proved the STRUCTURE works. This proves the engine stays
 * strong when cases move from illustrative → grounded. It upgrades 5–7 cases with
 * REAL, verifiable public standard designations (see failure-provenance-upgrades.json)
 * WITHOUT touching the chemistry, re-runs the MBM pilot, and checks the pass
 * conditions on the grounded subset:
 *
 *   1. source/date attached (flag 'sourced')
 *   2. mechanism still maps to the MBM
 *   3. ≥2 competing mechanisms survive
 *   4. ≥2 better experiments generated
 *   5. no invented chemistry — the upgrade changed ONLY provenance/evidenceQuality
 *
 * Plus a robustness check: for the grounded ids, the pilot's yields are IDENTICAL
 * before and after grounding (the engine never depended on the illustrative flag).
 * No broad ingestion, no external fetch, no decision.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runPilot } from './failure-mbm-pilot.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const mbm = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));
const corpus = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'failure-library', 'failure-fixtures.json'), 'utf8'));
const overlay = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'failure-library', 'failure-provenance-upgrades.json'), 'utf8'));

// The science fields that grounding must NOT alter (no invented chemistry).
const SCIENCE_FIELDS = ['domain', 'materialSystem', 'failureMode', 'outcome', 'margin', 'conditions', 'observedSymptoms', 'claimedMechanism', 'cascade', 'rootCause', 'mappedMBM', 'brokenInvariant', 'antiConditions', 'suggestedExperiment', 'confidence'];

function applyUpgrades(corpus, overlay) {
  const up = overlay.upgrades;
  return { ...corpus, cases: corpus.cases.map((c) => (up[c.id] ? { ...c, ...up[c.id] } : c)) };
}

const grounded = applyUpgrades(corpus, overlay);
const groundedIds = new Set(Object.keys(overlay.upgrades));
const origById = Object.fromEntries(corpus.cases.map((c) => [c.id, c]));
const grndById = Object.fromEntries(grounded.cases.map((c) => [c.id, c]));

const pilotIll = runPilot(mbm, corpus);
const pilotGr = runPilot(mbm, grounded);
const inGrounded = (arr) => arr.filter((x) => groundedIds.has(x.id));

// --- report -----------------------------------------------------------------
const line = (s = '') => console.log(s);
line('════════════════════════════════════════════════════════════════════');
line('  FAILURE KB — PROVENANCE PILOT   (illustrative → grounded)');
line(`  ${groundedIds.size} cases grounded in real public standards · no ingestion · report only`);
line('════════════════════════════════════════════════════════════════════\n');
for (const id of groundedIds) {
  const p = grndById[id].provenance;
  line(`  ${id}`);
  line(`     source: ${p.source}`);
  line(`     date: ${p.date} (${p.datePrecision})  · ${p.verifiability} · flag=${p.flag}`);
}
const gComp = inGrounded(pilotGr.competingMechanisms);
const gExp = inGrounded(pilotGr.betterExperiments);
const gDk = inGrounded(pilotGr.newDeltaK);
line(`\n  grounded-subset yields:  competing mechanisms ${gComp.length}  ·  better experiments ${gExp.length}  ·  new ΔK ${gDk.length}`);
line(`  competing survive: ${gComp.map((x) => x.for).join(', ')}`);
line('════════════════════════════════════════════════════════════════════');

// --- pass conditions --------------------------------------------------------
let fails = 0;
const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

// 1. source/date attached, flagged sourced
for (const id of groundedIds) {
  const p = grndById[id].provenance;
  assert(p && p.flag === 'sourced' && p.source && p.date, `${id}: source + date attached, flag 'sourced' (condition 1)`);
  assert(p.sourceType === 'standard' && /verifiab|standard designation/i.test(p.verifiability || ''), `${id}: grounded in a verifiable public standard`);
}
// 2. mechanism still maps to the MBM (mappedMBM unchanged & resolvable)
const transIds = new Set((mbm.transitions || []).map((t) => t.id));
for (const id of groundedIds) {
  const m = grndById[id].mappedMBM;
  const resolvable = (m.competingMechanismFor ? transIds.has(m.competingMechanismFor) : true) && (m.fromState || m.toState || m.competingMechanismFor);
  assert(resolvable, `${id}: mechanism still maps to the MBM (condition 2)`);
}
// 3. ≥2 competing mechanisms survive
assert(gComp.length >= 2, `≥2 competing mechanisms survive in the grounded subset (got ${gComp.length}) (condition 3)`);
// 4. ≥2 better experiments generated
assert(gExp.length >= 2, `≥2 better experiments in the grounded subset (got ${gExp.length}) (condition 4)`);
// 5. NO invented chemistry — grounding changed ONLY provenance + evidenceQuality
for (const id of groundedIds) {
  const same = SCIENCE_FIELDS.every((f) => JSON.stringify(origById[id][f]) === JSON.stringify(grndById[id][f]));
  assert(same, `${id}: grounding changed only provenance/evidenceQuality — no invented chemistry (condition 5)`);
}
// robustness: for grounded ids, the pilot yields are IDENTICAL before/after grounding
assert(JSON.stringify(inGrounded(pilotIll.competingMechanisms)) === JSON.stringify(gComp), 'competing-mechanism yields identical illustrative vs grounded (engine ignores the flag)');
assert(JSON.stringify(inGrounded(pilotIll.newDeltaK)) === JSON.stringify(gDk), 'ΔK yields identical illustrative vs grounded');
// the hallmark cross-subsystem coupling survives grounding
assert(gDk.some((x) => x.reasons.some((r) => /cross-subsystem/.test(r))), 'the concrete→steel cross-subsystem ΔK survives grounding');
// overall corpus verdict still positive after grounding
assert(pilotGr.verdict === true, 'overall pilot verdict remains positive after grounding');

console.log('');
if (fails) { console.error(`Failure KB Provenance Pilot FAILED: ${fails} check(s)`); process.exit(1); }
console.log('Failure KB Provenance Pilot PASSED — yields survive illustrative → grounded on real standards; chemistry unchanged; no ingestion. Full ingestion is now justified to design.');
