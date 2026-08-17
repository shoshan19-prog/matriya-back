/**
 * Dual-Provenance POC tests — prove the structural blocker is broken:
 * the system can HOLD two isolated provenances and COMPARE with full provenance.
 * Run: node --test poc/dualProvenance.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  compareClaims,
  assertClaim,
  renderComparison,
  RELATION,
  SOURCE_CLASSES,
} from './dualProvenance.js';

const __dir = dirname(fileURLToPath(import.meta.url));

// --- The REAL Fresco claim, grounded in the actual internal document ---------
// (INT-TFX-001 Expansion Ratio = 18.5, from INT-TFX-001_Results.pdf — the value
//  used across the repo's own attribution check-scripts.)
const frescoClaim = {
  source_class: 'fresco_internal',
  source_id: 'INT-TFX-001_Results.pdf',
  subject: 'INT-TFX-001 (APP:PER:MEL)',
  metric: 'Expansion Ratio',
  value: 18.5,
  unit: 'ratio (x)',
  context: 'Reported in the INT-TFX-001 experiment results table (internal Fresco document).',
};

// --- The ONE manual, frozen world_external claim -----------------------------
const worldClaim = JSON.parse(readFileSync(join(__dir, 'frozen-external-source.json'), 'utf8'));

test('contract: only the two provenance classes are legal', () => {
  assert.deepEqual(SOURCE_CLASSES, ['fresco_internal', 'world_external']);
  assert.throws(() => assertClaim({ ...frescoClaim, source_class: 'other' }), /source_class/);
  assert.throws(() => assertClaim({ ...frescoClaim, source_id: '' }), /source_id/);
});

test('ISOLATION: refuses to pool two same-provenance claims (the current bug)', () => {
  const anotherFresco = { ...frescoClaim, source_id: 'INT-TFX-001_Summary.pdf' };
  // There is no slot where two same-provenance claims can be pooled: a second
  // Fresco claim placed in the world slot is rejected by the side-type check.
  assert.throws(() => compareClaims(frescoClaim, anotherFresco), /world side must be world_external/);
});

test('ISOLATION: refuses same source_id on both sides', () => {
  const collidingWorld = { ...worldClaim, source_id: frescoClaim.source_id };
  assert.throws(() => compareClaims(frescoClaim, collidingWorld), /provenance mix refused/);
});

test('ISOLATION: wrong side rejected (world value passed as fresco side)', () => {
  assert.throws(() => compareClaims(worldClaim, null), /fresco side must be fresco_internal/);
});

test('relation FRESCO_ONLY == a Knowledge Gap (world side missing)', () => {
  const cmp = compareClaims(frescoClaim, null);
  assert.equal(cmp.relation, RELATION.FRESCO_ONLY);
  assert.equal(cmp.world, null);
  assert.equal(cmp.provenance.length, 1);
  assert.equal(cmp.provenance[0].source_class, 'fresco_internal');
});

test('relation WORLD_ONLY (fresco side missing)', () => {
  const cmp = compareClaims(null, worldClaim);
  assert.equal(cmp.relation, RELATION.WORLD_ONLY);
  assert.equal(cmp.fresco, null);
});

test('relation AGREE when values overlap', () => {
  const worldOverlap = { ...worldClaim, source_id: 'FROZEN-EXT-REF-AGREE', value: [18, 19] };
  const cmp = compareClaims(frescoClaim, worldOverlap);
  assert.equal(cmp.relation, RELATION.AGREE);
});

test('REAL CASE: INT-TFX 18.5 vs frozen external [8,12] -> CONFLICT, full provenance', () => {
  const cmp = compareClaims(frescoClaim, worldClaim);

  // The comparison is produced...
  assert.equal(cmp.relation, RELATION.CONFLICT);

  // ...and both sides are preserved, not merged.
  assert.equal(cmp.fresco.source_class, 'fresco_internal');
  assert.equal(cmp.fresco.source_id, 'INT-TFX-001_Results.pdf');
  assert.equal(cmp.fresco.value, 18.5);
  assert.equal(cmp.world.source_class, 'world_external');
  assert.equal(cmp.world.source_id, 'FROZEN-EXT-REF-0001');

  // ...with FULL provenance: two distinct sources, two distinct classes.
  assert.equal(cmp.provenance.length, 2);
  const classes = new Set(cmp.provenance.map((p) => p.source_class));
  const ids = new Set(cmp.provenance.map((p) => p.source_id));
  assert.equal(classes.size, 2, 'both provenance classes present and distinct');
  assert.equal(ids.size, 2, 'both source ids present and distinct');

  // Print the demo board line for the human.
  console.log('    DEMO >', renderComparison(cmp));
});
