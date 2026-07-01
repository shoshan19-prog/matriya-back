/**
 * Industrial Knowledge Library (IKL) — HTTP API.
 *
 * Mounted at /ikl. Reads are open to any authenticated user; writes require an
 * admin. The router enforces the library's core principles at the boundary:
 *   - Provenance: fact-stating layers reject writes without a source.
 *   - No orphan knowledge: a record is created together with (or bound to) an
 *     ikl_sources row.
 *   - Separation: knowledge_domain is forced to 'external'; External↔Fresco
 *     connections are always created as a hypothesis.
 *   - Version history: updates snapshot the previous state into
 *     ikl_record_history and bump the version — never a silent overwrite.
 */
import express from 'express';
import { Op } from 'sequelize';
import { initDb } from './database.js';
import { getCurrentUser } from './authEndpoints.js';
import logger from './logger.js';
import {
  IklSource,
  IklRecordHistory,
  IklMechanism,
  IklMechanismEdge,
  IklRelationship,
  IklConnection,
  IKL_LAYERS,
  DOCUMENT_TYPES,
  CONNECTION_STATUS,
  KNOWLEDGE_DOMAIN_EXTERNAL,
  sequelize
} from './iklModels.js';
import { getIklVectorStore, indexRecord } from './iklVectorStore.js';
import { runSearch, searchResultToLegacyResponse } from './iklSearchEngine.js';

const router = express.Router();

// System columns a client may never set directly.
const PROTECTED_FIELDS = new Set([
  'id', 'version', 'knowledge_domain', 'created_at', 'updated_at', 'validated_by', 'validated_at'
]);

let dbReady = false;
async function ensureDbInitialized(req, res, next) {
  if (!dbReady) {
    try {
      await initDb();
      dbReady = true;
    } catch (e) {
      logger.error(`IKL: database initialization failed: ${e.message}`);
      return res.status(503).json({ error: 'Database unavailable', detail: e.message });
    }
  }
  next();
}

async function requireAuth(req, res, next) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}

async function requireAdmin(req, res, next) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!(user.is_admin || user.username === 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.user = user;
  next();
}

function getLayer(req, res) {
  const layer = IKL_LAYERS[req.params.layer];
  if (!layer) {
    res.status(404).json({ error: `Unknown IKL layer '${req.params.layer}'`, layers: Object.keys(IKL_LAYERS) });
    return null;
  }
  return layer;
}

// Keep only writable fields for a layer; drop protected/unknown keys.
function pickWritable(layer, body) {
  const out = {};
  for (const key of layer.writable) {
    if (key in body && !PROTECTED_FIELDS.has(key)) out[key] = body[key];
  }
  return out;
}

// Resolve provenance: accept an existing source_id or an inline `source` object.
async function resolveSource(body, { transaction }) {
  if (body.source && typeof body.source === 'object') {
    const s = body.source;
    if (!s.document_type || !DOCUMENT_TYPES.includes(s.document_type)) {
      throw new HttpError(400, `source.document_type is required and must be one of: ${DOCUMENT_TYPES.join(', ')}`);
    }
    const created = await IklSource.create(
      {
        title: s.title || null,
        url: s.url || null,
        document: s.document || null,
        document_type: s.document_type,
        version: s.version || null,
        retrieval_date: s.retrieval_date || null,
        confidence: s.confidence ?? null,
        publisher: s.publisher || null,
        notes: s.notes || null
      },
      { transaction }
    );
    return created.id;
  }
  if (body.source_id != null) {
    const found = await IklSource.findByPk(body.source_id, { transaction });
    if (!found) throw new HttpError(400, `source_id ${body.source_id} does not exist in ikl_sources`);
    return found.id;
  }
  return null;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Shared create path (used by single POST and bulk import). Enforces provenance
// and the domain guard, writes a v1 history row. Runs inside the caller's tx.
async function createRecordInTx(layer, layerKey, body, userId, t) {
  const values = pickWritable(layer, body || {});
  const sourceId = await resolveSource(body || {}, { transaction: t });
  if (layer.sourceRequired && sourceId == null) {
    throw new HttpError(400, `Provenance required: provide 'source_id' or inline 'source' for layer '${layerKey}'`);
  }
  values.source_id = sourceId;
  values.confidence = body?.confidence ?? null;
  values.is_hypothesis = Boolean(body?.is_hypothesis) || false;
  values.knowledge_domain = KNOWLEDGE_DOMAIN_EXTERNAL; // separation guard
  values.version = 1;
  const created = await layer.model.create(values, { transaction: t });
  await IklRecordHistory.create(
    { record_type: layer.recordType, record_id: created.id, version: 1, change_kind: 'create', snapshot: created.toJSON(), changed_by: userId },
    { transaction: t }
  );
  return created;
}

function sendError(res, e, context) {
  if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
  logger.error(`IKL ${context}: ${e.message}`);
  return res.status(500).json({ error: `${context}: ${e.message}` });
}

// ---------------------------------------------------------------------------
// Overview / catalogue
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  res.json({
    library: 'MATRIYA Industrial Knowledge Library',
    domain: KNOWLEDGE_DOMAIN_EXTERNAL,
    principles: ['read_only_bias', 'provenance_required', 'no_invented_chemistry', 'separation_from_fresco', 'version_history'],
    layers: Object.keys(IKL_LAYERS),
    endpoints: {
      list: 'GET /ikl/:layer',
      get: 'GET /ikl/:layer/:id',
      create: 'POST /ikl/:layer (admin)',
      bulkImport: 'POST /ikl/:layer/bulk (admin)',
      update: 'PUT /ikl/:layer/:id (admin)',
      history: 'GET /ikl/:layer/:id/history',
      search: 'POST /ikl/search { query, layer?, limit? }',
      reindex: 'POST /ikl/reindex (admin)',
      sources: 'GET|POST /ikl/sources',
      mechanismGraph: 'GET /ikl/graph/mechanisms',
      relationshipGraph: 'GET /ikl/graph/relationships',
      connections: 'GET|POST /ikl/connections , POST /ikl/connections/:id/validate (admin)',
      overview: 'GET /ikl/overview'
    }
  });
});

router.get('/overview', ensureDbInitialized, requireAuth, async (req, res) => {
  try {
    const counts = {};
    for (const [name, layer] of Object.entries(IKL_LAYERS)) {
      counts[name] = await layer.model.count();
    }
    const [sources, connections, hypotheses] = await Promise.all([
      IklSource.count(),
      IklConnection.count(),
      IklConnection.count({ where: { status: 'hypothesis' } })
    ]);
    res.json({
      domain: KNOWLEDGE_DOMAIN_EXTERNAL,
      layer_counts: counts,
      sources,
      connections: { total: connections, hypotheses }
    });
  } catch (e) {
    sendError(res, e, 'overview');
  }
});

// ---------------------------------------------------------------------------
// Provenance sources
// ---------------------------------------------------------------------------
router.get('/sources', ensureDbInitialized, requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const rows = await IklSource.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
    res.json({ total: rows.count, items: rows.rows });
  } catch (e) {
    sendError(res, e, 'list sources');
  }
});

router.post('/sources', ensureDbInitialized, requireAdmin, async (req, res) => {
  try {
    const s = req.body || {};
    if (!s.document_type || !DOCUMENT_TYPES.includes(s.document_type)) {
      return res.status(400).json({ error: `document_type is required and must be one of: ${DOCUMENT_TYPES.join(', ')}` });
    }
    const created = await IklSource.create({
      title: s.title || null,
      url: s.url || null,
      document: s.document || null,
      document_type: s.document_type,
      version: s.version || null,
      retrieval_date: s.retrieval_date || null,
      confidence: s.confidence ?? null,
      publisher: s.publisher || null,
      notes: s.notes || null
    });
    res.status(201).json(created);
  } catch (e) {
    sendError(res, e, 'create source');
  }
});

// ---------------------------------------------------------------------------
// Mechanism knowledge graph (Layer 4 nodes + Layer 10 edges)
// ---------------------------------------------------------------------------
router.get('/graph/mechanisms', ensureDbInitialized, requireAuth, async (req, res) => {
  try {
    const [nodes, edges] = await Promise.all([
      IklMechanism.findAll({ order: [['name', 'ASC']] }),
      IklMechanismEdge.findAll()
    ]);
    res.json({
      nodes: nodes.map((n) => ({ id: n.id, name: n.name, is_hypothesis: n.is_hypothesis })),
      edges: edges.map((e) => ({ id: e.id, from: e.from_mechanism_id, to: e.to_mechanism_id, relation: e.relation, scientific_reference: e.scientific_reference }))
    });
  } catch (e) {
    sendError(res, e, 'mechanism graph');
  }
});

router.get('/graph/relationships', ensureDbInitialized, requireAuth, async (req, res) => {
  try {
    const where = {};
    if (req.query.type) where.relationship_type = req.query.type;
    const edges = await IklRelationship.findAll({ where, limit: 1000 });
    res.json({
      edges: edges.map((e) => ({
        id: e.id,
        from: { type: e.from_type, id: e.from_id },
        to: { type: e.to_type, id: e.to_id },
        relationship_type: e.relationship_type,
        is_hypothesis: e.is_hypothesis,
        notes: e.notes
      }))
    });
  } catch (e) {
    sendError(res, e, 'relationship graph');
  }
});

// ---------------------------------------------------------------------------
// Separation bridge — External ↔ Fresco connections (hypothesis until validated)
// ---------------------------------------------------------------------------
router.get('/connections', ensureDbInitialized, requireAuth, async (req, res) => {
  try {
    const where = {};
    if (req.query.status && CONNECTION_STATUS.includes(req.query.status)) where.status = req.query.status;
    const rows = await IklConnection.findAll({ where, order: [['id', 'DESC']], limit: 500 });
    res.json({ items: rows });
  } catch (e) {
    sendError(res, e, 'list connections');
  }
});

router.post('/connections', ensureDbInitialized, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.external_type || b.external_id == null || !b.fresco_ref) {
      return res.status(400).json({ error: 'external_type, external_id and fresco_ref are required' });
    }
    // Separation rule: a new connection is ALWAYS a hypothesis. Never write into
    // Fresco internal knowledge — fresco_ref is stored as an opaque string only.
    const created = await IklConnection.create({
      external_type: b.external_type,
      external_id: b.external_id,
      fresco_ref: String(b.fresco_ref),
      fresco_ref_kind: b.fresco_ref_kind || null,
      relation: b.relation || null,
      note: b.note || null,
      status: 'hypothesis',
      is_hypothesis: true,
      confidence: b.confidence ?? null
    });
    res.status(201).json(created);
  } catch (e) {
    sendError(res, e, 'create connection');
  }
});

router.post('/connections/:id/validate', ensureDbInitialized, requireAdmin, async (req, res) => {
  try {
    const conn = await IklConnection.findByPk(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    const decision = req.body?.decision === 'reject' ? 'rejected' : 'validated';
    await IklRecordHistory.create({
      record_type: 'connection', record_id: conn.id, version: conn.version,
      change_kind: `validate:${decision}`, snapshot: conn.toJSON(), changed_by: req.user.id
    });
    conn.status = decision;
    conn.is_hypothesis = decision !== 'validated';
    conn.validated_by = req.user.id;
    conn.validated_at = new Date();
    conn.version += 1;
    conn.updated_at = new Date();
    await conn.save();
    res.json(conn);
  } catch (e) {
    sendError(res, e, 'validate connection');
  }
});

// ---------------------------------------------------------------------------
// Semantic search over the IKL (separate vector collection from Fresco RAG)
// ---------------------------------------------------------------------------
// G7: the route is now a thin adapter over the runSearch engine (Engine 1,
// Engine Contract v1.1). Behaviour is unchanged — searchResultToLegacyResponse
// reproduces the exact legacy body; unexpected errors still flow to sendError.
router.post('/search', ensureDbInitialized, requireAuth, async (req, res) => {
  try {
    const result = await runSearch(req.body || {});
    const { httpStatus, body } = searchResultToLegacyResponse(result);
    return res.status(httpStatus).json(body);
  } catch (e) {
    sendError(res, e, 'search');
  }
});

// Backfill / rebuild embeddings for existing records (best-effort per record).
router.post('/reindex', ensureDbInitialized, requireAdmin, async (req, res) => {
  try {
    const onlyLayer = req.body?.layer;
    if (onlyLayer && !IKL_LAYERS[onlyLayer]) {
      return res.status(400).json({ error: `Unknown layer '${onlyLayer}'` });
    }
    const layers = onlyLayer ? [onlyLayer] : Object.keys(IKL_LAYERS);
    const summary = {};
    for (const key of layers) {
      const rows = await IKL_LAYERS[key].model.findAll();
      let ok = 0;
      for (const row of rows) if (await indexRecord(key, row)) ok++;
      summary[key] = { total: rows.length, indexed: ok };
    }
    res.json({ reindexed: summary });
  } catch (e) {
    sendError(res, e, 'reindex');
  }
});

// ---------------------------------------------------------------------------
// Bulk import (provenance-enforced, all-or-nothing). Optional shared `source`.
// Body: { records: [ {...fields, source_id|source} ], source?: {...} }
// ---------------------------------------------------------------------------
router.post('/:layer/bulk', ensureDbInitialized, requireAdmin, async (req, res) => {
  const layer = getLayer(req, res);
  if (!layer) return;
  const records = req.body?.records;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records must be a non-empty array' });
  }
  if (records.length > 1000) {
    return res.status(400).json({ error: 'bulk import is limited to 1000 records per request' });
  }
  const sharedSource = req.body?.source; // applied to records that omit their own source
  const t = await sequelize.transaction();
  try {
    const created = [];
    for (let i = 0; i < records.length; i++) {
      const rec = records[i] || {};
      // Per-record provenance falls back to the shared source for the batch.
      const withSource = rec.source_id != null || rec.source ? rec : { ...rec, source: sharedSource };
      try {
        created.push(await createRecordInTx(layer, req.params.layer, withSource, req.user.id, t));
      } catch (e) {
        if (e instanceof HttpError) throw new HttpError(e.status, `record[${i}]: ${e.message}`);
        throw new HttpError(400, `record[${i}]: ${e.message}`);
      }
    }
    await t.commit();
    // Index after commit — non-fatal (reindex can backfill).
    let indexed = 0;
    for (const row of created) if (await indexRecord(req.params.layer, row)) indexed++;
    res.status(201).json({ layer: req.params.layer, created: created.length, indexed, ids: created.map((r) => r.id) });
  } catch (e) {
    await t.rollback();
    sendError(res, e, `bulk ${req.params.layer}`);
  }
});

// ---------------------------------------------------------------------------
// Generic layer CRUD
// ---------------------------------------------------------------------------
router.get('/:layer', ensureDbInitialized, requireAuth, async (req, res) => {
  const layer = getLayer(req, res);
  if (!layer) return;
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const where = {};
    // Simple exact-match filters on any writable field passed as a query param.
    for (const key of layer.writable) {
      if (req.query[key] != null) where[key] = req.query[key];
    }
    if (req.query.q) {
      const nameField = layer.writable.find((f) => ['name', 'product_name', 'failure', 'title', 'chemical_family'].includes(f));
      if (nameField) where[nameField] = { [Op.iLike]: `%${req.query.q}%` };
    }
    const rows = await layer.model.findAndCountAll({
      where, limit, offset, order: [['id', 'DESC']],
      include: [{ model: IklSource, as: 'source', required: false }]
    });
    res.json({ layer: req.params.layer, total: rows.count, items: rows.rows });
  } catch (e) {
    sendError(res, e, `list ${req.params.layer}`);
  }
});

router.get('/:layer/:id', ensureDbInitialized, requireAuth, async (req, res) => {
  const layer = getLayer(req, res);
  if (!layer) return;
  try {
    const row = await layer.model.findByPk(req.params.id, {
      include: [{ model: IklSource, as: 'source', required: false }]
    });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    sendError(res, e, `get ${req.params.layer}`);
  }
});

router.get('/:layer/:id/history', ensureDbInitialized, requireAuth, async (req, res) => {
  const layer = getLayer(req, res);
  if (!layer) return;
  try {
    const rows = await IklRecordHistory.findAll({
      where: { record_type: layer.recordType, record_id: req.params.id },
      order: [['version', 'DESC']]
    });
    res.json({ record_type: layer.recordType, record_id: Number(req.params.id), history: rows });
  } catch (e) {
    sendError(res, e, `history ${req.params.layer}`);
  }
});

router.post('/:layer', ensureDbInitialized, requireAdmin, async (req, res) => {
  const layer = getLayer(req, res);
  if (!layer) return;
  const t = await sequelize.transaction();
  try {
    const created = await createRecordInTx(layer, req.params.layer, req.body, req.user.id, t);
    await t.commit();
    await indexRecord(req.params.layer, created); // best-effort semantic indexing
    res.status(201).json(created);
  } catch (e) {
    await t.rollback();
    sendError(res, e, `create ${req.params.layer}`);
  }
});

router.put('/:layer/:id', ensureDbInitialized, requireAdmin, async (req, res) => {
  const layer = getLayer(req, res);
  if (!layer) return;
  const t = await sequelize.transaction();
  try {
    const row = await layer.model.findByPk(req.params.id, { transaction: t });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ error: 'Not found' });
    }
    // Preserve version history before mutating.
    await IklRecordHistory.create(
      { record_type: layer.recordType, record_id: row.id, version: row.version, change_kind: 'update', snapshot: row.toJSON(), changed_by: req.user.id },
      { transaction: t }
    );
    const updates = pickWritable(layer, req.body || {});
    // Allow re-pointing provenance, but never drop it on a fact-stating layer.
    if (req.body?.source_id != null || req.body?.source) {
      updates.source_id = await resolveSource(req.body, { transaction: t });
    }
    if (layer.sourceRequired && (updates.source_id ?? row.source_id) == null) {
      throw new HttpError(400, `Provenance required: layer '${req.params.layer}' cannot lose its source`);
    }
    if ('confidence' in (req.body || {})) updates.confidence = req.body.confidence;
    if ('is_hypothesis' in (req.body || {})) updates.is_hypothesis = Boolean(req.body.is_hypothesis);
    updates.knowledge_domain = KNOWLEDGE_DOMAIN_EXTERNAL; // guard stays external
    updates.version = row.version + 1;
    updates.updated_at = new Date();
    await row.update(updates, { transaction: t });
    await t.commit();
    await indexRecord(req.params.layer, row); // refresh semantic index
    res.json(row);
  } catch (e) {
    await t.rollback();
    sendError(res, e, `update ${req.params.layer}`);
  }
});

export { router as iklRouter };
