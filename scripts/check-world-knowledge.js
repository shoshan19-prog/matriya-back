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

// ---------------------------------------------------------------------------
// SQL-boundary proofs: run the REAL vector-store methods against a fake pool
// and assert the SQL they emit enforces the provenance boundary.
// ---------------------------------------------------------------------------
import SupabaseVectorStore from '../vectorStoreSupabase.js';
import { deltaScopeForIngest } from '../lib/worldKnowledge.js';

const captured = [];
function makeStore() {
  // Bypass the constructor (no DB, no embedding model) — test methods as-is.
  const store = Object.create(SupabaseVectorStore.prototype);
  store.collectionName = 'documents';
  store.embeddingDim = 4;
  store.embeddingModel = async () => ({ data: new Float32Array([0.1, 0.2, 0.3, 0.4]) });
  store._localModelReady = Promise.resolve();
  store.pool = {
    connect: async () => ({
      query: async (sql, params) => {
        captured.push({ sql: String(sql), params: params || [] });
        if (String(sql).includes('COUNT(')) return { rows: [{ count: '1' }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    }),
  };
  return store;
}
const store = makeStore();
const EXCL = "metadata->>'source_class' IS NULL OR metadata->>'source_class' <> ";
const last = () => captured[captured.length - 1];

// B1: default Fresco retrieval excludes world chunks.
await store.search('q', 5, frescoScopeFilter(null));
assert.ok(last().sql.includes(EXCL), 'fresco search SQL must exclude world');
assert.ok(last().params.includes(WORLD_SOURCE_CLASS), 'exclusion param must be world_external');

// B1: filename-scoped Fresco search still excludes world (same-name collision safe).
await store.search('q', 5, frescoScopeFilter({ filename: 'paper.pdf' }));
assert.ok(last().sql.includes(EXCL), 'filename-scoped fresco search must exclude world');

// B1: ask-matriya text loaders are fresco-scoped.
await store.getFullTextForFile('paper.pdf');
assert.ok(last().sql.includes(EXCL.trim().slice(0, 40)), 'getFullTextForFile must exclude world');
await store.getFirstChunkForFile('paper.pdf');
assert.ok(last().sql.includes("<> 'world_external'"), 'getFirstChunkForFile must exclude world');

// B2: world search selects ONLY world_external (never legacy/fresco rows).
await store.search('q', 5, worldScopeFilter(null));
assert.ok(last().sql.includes("metadata->>'source_class' = $"), 'world search must require source_class equality');
assert.ok(!last().sql.includes(EXCL), 'world search must not carry the exclusion clause');
assert.ok(last().params.includes(WORLD_SOURCE_CLASS));

// B4/B5: file enumeration (files lists + OpenAI sync catalog) is fresco-scoped.
await store.getAllFilenames();
assert.ok(last().sql.includes("<> 'world_external'"), 'getAllFilenames must exclude world');
await store.getFilesWithMetadata();
assert.ok(last().sql.includes("<> 'world_external'"), 'getFilesWithMetadata must exclude world');

// B5: deletion respects the boundary in both directions.
await store.deleteDocuments(null, { filename: 'x.pdf', ...deltaScopeForIngest({ source_class: WORLD_SOURCE_CLASS }) });
assert.ok(last().sql.includes("metadata->>'source_class' = $"), 'world delta-delete must target world rows only');
await store.deleteDocuments(null, { filename: 'x.pdf', ...deltaScopeForIngest(null) });
assert.ok(last().sql.includes(EXCL), 'fresco delta-delete must exclude world rows');
assert.deepEqual(deltaScopeForIngest({ source_class: WORLD_SOURCE_CLASS }), { source_class: WORLD_SOURCE_CLASS });
assert.deepEqual(deltaScopeForIngest({ source_class: FRESCO_SOURCE_CLASS }), { exclude_source_class: WORLD_SOURCE_CLASS });

// B3: untagged rows are reported as explicit legacy_internal in status.
await store.countBySourceClass();
assert.ok(last().sql.includes("COALESCE(metadata->>'source_class', 'legacy_internal')"), 'status must classify untagged rows as legacy_internal');

console.log('check-world-knowledge: OK (isolation-law + SQL-boundary proofs passed)');
