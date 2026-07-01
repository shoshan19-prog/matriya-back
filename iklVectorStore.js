/**
 * Semantic search for the Industrial Knowledge Library.
 *
 * Reuses the existing SupabaseVectorStore (same embedding model / pgvector
 * plumbing as Fresco's RAG) but points it at a SEPARATE collection table
 * (`ikl_embeddings`). IKL vectors therefore never mix into Fresco's
 * `rag_documents` collection — the separation rule holds at the vector layer too.
 *
 * Each IKL record is indexed under a deterministic id `"<record_type>:<id>"`,
 * so re-indexing upserts instead of duplicating. Metadata carries
 * { layer, record_type, record_id } for filtering and hydration.
 */
import SupabaseVectorStore from './vectorStoreSupabase.js';
import settings from './config.js';
import logger from './logger.js';
import { IKL_LAYERS } from './iklModels.js';

const IKL_COLLECTION = process.env.IKL_COLLECTION_NAME || 'ikl_embeddings';

let store = null;

export function getIklVectorStore() {
  if (store) return store;
  const dbUrl = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!dbUrl) throw new Error('POSTGRES_URL is required for the IKL vector store');
  store = new SupabaseVectorStore(dbUrl, IKL_COLLECTION, settings.EMBEDDING_MODEL);
  logger.info(`IKL vector store using collection '${IKL_COLLECTION}'`);
  return store;
}

/** Build a compact text representation of a record from its writable fields. */
export function recordToText(layerKey, record) {
  const layer = IKL_LAYERS[layerKey];
  const data = typeof record.toJSON === 'function' ? record.toJSON() : record;
  const parts = [layerKey];
  for (const field of layer ? layer.writable : Object.keys(data)) {
    const v = data[field];
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v.length) parts.push(`${field}: ${v.filter((x) => x != null).join(', ')}`);
    } else if (typeof v === 'object') {
      const flat = Object.entries(v)
        .filter(([, val]) => val != null && val !== '')
        .map(([k, val]) => `${k}=${typeof val === 'object' ? JSON.stringify(val) : val}`)
        .join('; ');
      if (flat) parts.push(`${field}: ${flat}`);
    } else if (String(v).trim()) {
      parts.push(`${field}: ${v}`);
    }
  }
  return parts.join('\n');
}

export function vectorIdFor(recordType, id) {
  return `${recordType}:${id}`;
}

/**
 * Index (upsert) one record's text into the IKL vector store. Best-effort:
 * returns false on failure instead of throwing, so a write is never blocked by
 * an embedding hiccup (backfill via /ikl/reindex).
 */
export async function indexRecord(layerKey, record) {
  const layer = IKL_LAYERS[layerKey];
  if (!layer) return false;
  try {
    const text = recordToText(layerKey, record);
    if (!text || !text.trim()) return false;
    const meta = { layer: layerKey, record_type: layer.recordType, record_id: record.id };
    await getIklVectorStore().addDocuments([text], [meta], [vectorIdFor(layer.recordType, record.id)]);
    return true;
  } catch (e) {
    logger.warn(`IKL index failed for ${layerKey}#${record.id}: ${e.message}`);
    return false;
  }
}
