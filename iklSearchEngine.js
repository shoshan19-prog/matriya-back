/**
 * IKL Search — Engine 1, as a pure engine function (G7).
 *
 * Extracts the core of `POST /ikl/search` into a stateless
 * `runSearch(input, ctx) -> Result` that conforms to the MATRIYA Engine
 * Contract v1.1 (see docs/engine-contract/SearchEngine.contract.json).
 *
 * This is the FIRST engine to actually run under the contract. It is NOT a
 * Composer and adds NO features: the HTTP route keeps its exact old behaviour by
 * calling runSearch and mapping the Result back with `searchResultToLegacyResponse`.
 *
 * Dependencies are injectable via `ctx` (vectorStore / layers / sourceModel) so
 * the engine is testable in isolation. When not injected, the vector store is
 * imported lazily — so importing this module has no heavy side effects.
 */
import { IKL_LAYERS, IklSource } from './iklModels.js';

/** Static manifest facts, mirrored from SearchEngine.contract.json (v1.1). */
export const SEARCH_ENGINE = Object.freeze({
  name: 'ikl-search',
  version: '0.1.0',
  produces: 'ikl.SearchResultSet@1',
  emits: Object.freeze(['observation', 'evidence']), // v1.1 emit vocabulary — never 'decision'
  reasoningClass: 'retrieval',
  confidenceType: 'semantic_similarity'
});

function envelope(status, data, extra = {}) {
  return {
    engine: SEARCH_ENGINE.name,
    engineVersion: SEARCH_ENGINE.version,
    produces: SEARCH_ENGINE.produces,
    emits: [...SEARCH_ENGINE.emits],
    status, // 'ok' | 'empty' | 'failed'
    data,
    confidence: null, // set-level confidence not computed (contract gap G2); unchanged behaviour
    reasoning: {
      reasoningClass: SEARCH_ENGINE.reasoningClass,
      confidenceType: SEARCH_ENGINE.confidenceType,
      reasoningTrace: null
    },
    warnings: [],
    failure: null,
    ...extra
  };
}

/**
 * Run the IKL search engine.
 * @param {{query?:string,q?:string,layer?:string,limit?:number}} input  ikl.SearchQuery@1
 * @param {{vectorStore?:object, layers?:object, sourceModel?:object}} [ctx]
 * @returns {Promise<object>} Engine Contract v1.1 Result envelope (data = { query, total, items })
 */
export async function runSearch(input, ctx = {}) {
  const startedAt = Date.now();
  const layers = ctx.layers || IKL_LAYERS;
  const sourceModel = ctx.sourceModel || IklSource;

  // NOTE: preserve exact legacy semantics — `||` (not `??`) so an empty-string
  // `query` falls through to `q`, and a 0/empty `limit` falls back to 10.
  const query = (input?.query || input?.q || '').toString().trim();
  if (!query) {
    return envelope('failed', null, { failure: { code: 'E_QUERY_REQUIRED', message: 'query is required' } });
  }
  const limit = Math.min(parseInt(input?.limit, 10) || 10, 100);
  const layerFilter = input?.layer;
  if (layerFilter && !layers[layerFilter]) {
    return envelope('failed', null, {
      failure: { code: 'E_UNKNOWN_LAYER', message: `Unknown layer '${layerFilter}'`, layers: Object.keys(layers) }
    });
  }

  let vectorStore = ctx.vectorStore;
  if (!vectorStore) {
    const mod = await import('./iklVectorStore.js');
    vectorStore = mod.getIklVectorStore();
  }

  const filter = layerFilter ? { layer: layerFilter } : null;
  const hits = await vectorStore.search(query, limit, filter);

  // Hydrate matched records (grouped per layer) — identical to the legacy route.
  const byLayer = {};
  for (const h of hits) {
    const key = h.metadata?.layer;
    const rid = h.metadata?.record_id;
    if (!key || !layers[key] || rid == null) continue;
    (byLayer[key] ||= new Map()).set(Number(rid), h.distance);
  }
  const records = {};
  for (const [key, idMap] of Object.entries(byLayer)) {
    const rows = await layers[key].model.findAll({
      where: { id: Array.from(idMap.keys()) },
      include: [{ model: sourceModel, as: 'source', required: false }]
    });
    for (const row of rows) records[`${key}:${row.id}`] = row;
  }
  const items = hits
    .map((h) => {
      const key = h.metadata?.layer;
      const rid = h.metadata?.record_id;
      const rec = records[`${key}:${rid}`];
      if (!rec) return null;
      return { layer: key, score: h.distance, snippet: h.document, record: rec };
    })
    .filter(Boolean);

  // `data` IS the exact legacy response body: { query, total, items }.
  const data = { query, total: items.length, items };
  return envelope(items.length ? 'ok' : 'empty', data, { metrics: { latencyMs: Date.now() - startedAt, cost: null } });
}

/**
 * Map an Engine Result back to the EXACT legacy HTTP response of POST /ikl/search.
 * Kept in one tested place so the route stays a thin, behaviour-preserving adapter.
 * Unexpected errors are NOT represented here — runSearch throws them and the route's
 * existing try/catch + sendError handles them exactly as before.
 */
export function searchResultToLegacyResponse(result) {
  if (result.failure) {
    const f = result.failure;
    if (f.code === 'E_QUERY_REQUIRED') return { httpStatus: 400, body: { error: 'query is required' } };
    if (f.code === 'E_UNKNOWN_LAYER') return { httpStatus: 400, body: { error: f.message, layers: f.layers } };
  }
  return { httpStatus: 200, body: result.data };
}
