/**
 * World Knowledge provenance layer — isolation-law checks (no DB required).
 * Run: node scripts/check-world-knowledge.js
 */
import assert from 'node:assert/strict';
import {
  buildWorldMetadata,
  frescoScopeFilter,
  worldScopeFilter,
  provenanceOf,
  WORLD_SOURCE_CLASS,
  FRESCO_SOURCE_CLASS,
} from '../lib/worldKnowledge.js';

// 1) A world document may not enter the store anonymous.
assert.throws(() => buildWorldMetadata({}), /source_id/);
assert.throws(() => buildWorldMetadata({ source_id: 'X' }), /citation_title/);
assert.throws(() => buildWorldMetadata({ source_id: '   ', citation_title: 'T' }), /source_id/);

// 2) Valid world metadata carries class + id + citation.
const meta = buildWorldMetadata({
  source_id: 'Oguz2025-FSJ-104367',
  citation_title: "Evaluating the impact of testing conditions on intumescent coatings' fire performance",
  citation_year: 2025,
  citation_doi: '10.1016/j.firesaf.2025.104367',
  license: 'CC BY',
});
assert.equal(meta.source_class, WORLD_SOURCE_CLASS);
assert.equal(meta.source_id, 'Oguz2025-FSJ-104367');
assert.equal(meta.citation.year, '2025');
assert.equal(meta.citation.doi, '10.1016/j.firesaf.2025.104367');

// 3) Default retrieval is fresco-scoped: world chunks are excluded.
assert.deepEqual(frescoScopeFilter(null), { exclude_source_class: WORLD_SOURCE_CLASS });
assert.deepEqual(frescoScopeFilter({ filename: 'a.pdf' }), {
  filename: 'a.pdf',
  exclude_source_class: WORLD_SOURCE_CLASS,
});

// 4) Explicit scope wins — a caller that asks for a class is not overridden.
assert.deepEqual(frescoScopeFilter({ source_class: WORLD_SOURCE_CLASS }), {
  source_class: WORLD_SOURCE_CLASS,
});
assert.deepEqual(frescoScopeFilter({ source_class: FRESCO_SOURCE_CLASS }), {
  source_class: FRESCO_SOURCE_CLASS,
});

// 5) World scope is explicit-only and never carries the exclusion.
assert.deepEqual(worldScopeFilter({ exclude_source_class: WORLD_SOURCE_CLASS }), {
  source_class: WORLD_SOURCE_CLASS,
});

// 6) Original filter object is not mutated (no cross-call leakage).
const original = { filename: 'b.pdf' };
frescoScopeFilter(original);
assert.deepEqual(original, { filename: 'b.pdf' });

// 7) Provenance projection returns the full provenance of a world row.
const prov = provenanceOf({ ...meta, filename: 'paper.pdf' });
assert.equal(prov.source_class, WORLD_SOURCE_CLASS);
assert.equal(prov.source_id, 'Oguz2025-FSJ-104367');
assert.equal(prov.citation.title.startsWith('Evaluating'), true);
assert.equal(prov.filename, 'paper.pdf');

console.log('check-world-knowledge: OK (7 isolation-law checks passed)');
