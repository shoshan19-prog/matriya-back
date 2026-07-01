/**
 * G7 test — proves the extracted runSearch engine preserves the EXACT legacy
 * behaviour of POST /ikl/search and that its Result conforms to Engine Contract
 * v1.1. Pure unit test: all dependencies injected via ctx (no DB, no network,
 * no auth), so it runs anywhere.
 *
 *   node scripts/test-run-search-g7.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runSearch, searchResultToLegacyResponse, SEARCH_ENGINE } from '../iklSearchEngine.js';

const __dir = dirname(fileURLToPath(import.meta.url));
let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); } else { console.log('  ✗ ' + msg); failures++; }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- injectable fakes -------------------------------------------------------
function makeCtx(hits, recordsById = {}) {
  const calls = {};
  const ctx = {
    vectorStore: {
      async search(query, limit, filter) { calls.search = { query, limit, filter }; return hits; }
    },
    layers: {
      products: {
        model: {
          async findAll({ where }) {
            calls.findAll = { where };
            return (where.id || []).filter((id) => recordsById[id]).map((id) => recordsById[id]);
          }
        }
      }
    },
    sourceModel: {}
  };
  return { ctx, calls };
}

// === 1. success: legacy body { query, total, items } is byte-identical ======
console.log('1. success — data equals legacy { query, total, items }');
{
  const hits = [
    { id: 'products:1', document: 'snippet A', metadata: { layer: 'products', record_id: 1 }, distance: 0.9 },
    { id: 'products:2', document: 'snippet B', metadata: { layer: 'products', record_id: 2 }, distance: 0.8 }
  ];
  const { ctx } = makeCtx(hits, { 1: { id: 1, product_name: 'P1' }, 2: { id: 2, product_name: 'P2' } });
  const r = await runSearch({ query: 'silane', limit: 5, layer: 'products' }, ctx);
  assert(r.status === 'ok', "status 'ok'");
  const expected = {
    query: 'silane',
    total: 2,
    items: [
      { layer: 'products', score: 0.9, snippet: 'snippet A', record: { id: 1, product_name: 'P1' } },
      { layer: 'products', score: 0.8, snippet: 'snippet B', record: { id: 2, product_name: 'P2' } }
    ]
  };
  assert(eq(r.data, expected), 'data matches the exact legacy shape/order');
  const legacy = searchResultToLegacyResponse(r);
  assert(legacy.httpStatus === 200 && eq(legacy.body, expected), 'legacy HTTP = 200 with identical body');
}

// === 2. query missing -> 400 { error: 'query is required' } =================
console.log("2. missing query — 400 { error: 'query is required' }");
{
  const { ctx } = makeCtx([]);
  const r = await runSearch({}, ctx);
  assert(r.status === 'failed' && r.failure.code === 'E_QUERY_REQUIRED', 'failure E_QUERY_REQUIRED');
  const legacy = searchResultToLegacyResponse(r);
  assert(legacy.httpStatus === 400 && eq(legacy.body, { error: 'query is required' }), 'legacy 400 body unchanged');
}

// === 2b. `||` fallback preserved (empty query falls through to q) ===========
console.log('2b. empty query + q — resolves to q via `||` (not `??`)');
{
  const { ctx } = makeCtx([]);
  const r = await runSearch({ query: '', q: 'wax', layer: 'products' }, ctx);
  assert(r.status === 'empty' && r.data.query === 'wax', "query resolved to 'wax' (legacy `||` semantics)");
}

// === 3. unknown layer -> 400 { error, layers } ==============================
console.log('3. unknown layer — 400 { error, layers } unchanged');
{
  const { ctx } = makeCtx([]);
  const r = await runSearch({ query: 'x', layer: 'nope' }, ctx);
  assert(r.failure && r.failure.code === 'E_UNKNOWN_LAYER', 'failure E_UNKNOWN_LAYER');
  const legacy = searchResultToLegacyResponse(r);
  assert(
    legacy.httpStatus === 400 && eq(legacy.body, { error: "Unknown layer 'nope'", layers: ['products'] }),
    "legacy 400 body { error: \"Unknown layer 'nope'\", layers: ['products'] }"
  );
}

// === 4. empty results -> { query, total: 0, items: [] } =====================
console.log('4. no hits — empty status, legacy body { total: 0, items: [] }');
{
  const { ctx } = makeCtx([]);
  const r = await runSearch({ query: 'zzz' }, ctx);
  assert(r.status === 'empty', "status 'empty'");
  const legacy = searchResultToLegacyResponse(r);
  assert(legacy.httpStatus === 200 && eq(legacy.body, { query: 'zzz', total: 0, items: [] }), 'legacy empty body unchanged');
}

// === 5. limit clamping / defaulting (unchanged) =============================
console.log('5. limit — clamp to 100, default/zero -> 10');
{
  let { ctx, calls } = makeCtx([]);
  await runSearch({ query: 'x', limit: 9999 }, ctx);
  assert(calls.search.limit === 100, 'limit 9999 -> clamped to 100');
  ({ ctx, calls } = makeCtx([]));
  await runSearch({ query: 'x' }, ctx);
  assert(calls.search.limit === 10, 'no limit -> default 10');
  ({ ctx, calls } = makeCtx([]));
  await runSearch({ query: 'x', limit: 0 }, ctx);
  assert(calls.search.limit === 10, 'limit 0 -> 10 (legacy `|| 10`)');
}

// === 6. non-hydratable hits are dropped (unchanged) =========================
console.log('6. hits with missing record / unknown metadata layer are filtered');
{
  const hits = [
    { id: 'products:1', document: 's1', metadata: { layer: 'products', record_id: 1 }, distance: 0.7 },
    { id: 'products:3', document: 's3', metadata: { layer: 'products', record_id: 3 }, distance: 0.6 }, // no record
    { id: 'ghost:9', document: 's9', metadata: { layer: 'ghost', record_id: 9 }, distance: 0.5 } // unknown layer
  ];
  const { ctx } = makeCtx(hits, { 1: { id: 1 } });
  const r = await runSearch({ query: 'x', layer: 'products' }, ctx);
  assert(r.data.total === 1 && r.data.items.length === 1 && r.data.items[0].record.id === 1, 'only hydratable hit survives');
}

// === 7. Result conforms to Engine Contract v1.1 (matches the frozen manifest) =
console.log('7. envelope conforms to Engine Contract v1.1 / SearchEngine.contract.json');
{
  const contract = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'engine-contract', 'SearchEngine.contract.json'), 'utf8'));
  const { ctx } = makeCtx([]);
  const r = await runSearch({ query: 'x' }, ctx);
  assert(r.engine === contract.name, `engine name '${contract.name}'`);
  assert(r.produces === contract.produces[0].type, `produces '${contract.produces[0].type}'`);
  assert(eq(r.emits, contract.outputEpistemics.emits), 'emits equals the manifest emits');
  assert(!r.emits.includes('decision'), 'Decision Boundary — engine never emits a decision');
  assert(r.reasoning.confidenceType === contract.reasoning.confidenceType, `confidenceType '${contract.reasoning.confidenceType}'`);
  assert(r.reasoning.reasoningClass === contract.reasoning.class, `reasoningClass '${contract.reasoning.class}'`);
  assert(SEARCH_ENGINE.name === contract.name && SEARCH_ENGINE.version === contract.version, 'SEARCH_ENGINE constants match manifest');
}

console.log('');
if (failures) { console.error(`G7 test FAILED: ${failures} assertion(s)`); process.exit(1); }
console.log('G7 test PASSED — runSearch preserves legacy /ikl/search behaviour and conforms to Engine Contract v1.1');
