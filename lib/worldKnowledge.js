/**
 * World Knowledge — provenance layer (live).
 *
 * Adds the second evidence class to MATRIYA: world_external documents live in
 * the SAME vector store as Fresco documents but are hard-separated by the
 * `source_class` metadata dimension. Isolation rules (LAW):
 *
 *   1. Every world chunk carries source_class='world_external' + source_id +
 *      citation. A world document without provenance is refused at ingest.
 *   2. Fresco surfaces (search / ask-matriya / file lists / cloud sync) NEVER
 *      see world chunks: default retrieval is fresco-scoped via
 *      exclude_source_class, and the file-enumeration queries exclude world.
 *   3. World retrieval is explicit only (/world/search), and every returned
 *      row carries its provenance.
 *
 * Contract reuse: source classes match the proven Dual-Provenance POC
 * (poc/dualProvenance.js) — fresco_internal | world_external.
 */

export const WORLD_SOURCE_CLASS = 'world_external';
export const FRESCO_SOURCE_CLASS = 'fresco_internal';

/**
 * Build (and validate) the metadata block for a world-external ingest.
 * Throws if mandatory provenance is missing — a world document may not enter
 * the store anonymous.
 *
 * @param {{source_id: string, citation_title: string, citation_year?: string|number,
 *          citation_doi?: string, citation_url?: string, citation_authors?: string,
 *          license?: string}} fields
 */
export function buildWorldMetadata(fields = {}) {
  const sourceId = typeof fields.source_id === 'string' ? fields.source_id.trim() : '';
  const title = typeof fields.citation_title === 'string' ? fields.citation_title.trim() : '';
  if (!sourceId) throw new Error('world ingest requires source_id (stable identifier of the external source)');
  if (!title) throw new Error('world ingest requires citation_title (what is this source)');

  const citation = { title };
  for (const [k, key] of [
    ['citation_authors', 'authors'],
    ['citation_year', 'year'],
    ['citation_doi', 'doi'],
    ['citation_url', 'url'],
    ['license', 'license'],
  ]) {
    const v = fields[k];
    if (v != null && String(v).trim() !== '') citation[key] = String(v).trim();
  }

  return {
    source_class: WORLD_SOURCE_CLASS,
    source_id: sourceId,
    citation,
  };
}

/**
 * Default Fresco scoping for retrieval filters: unless the caller explicitly
 * asked for a source_class, exclude world chunks. Keeps every pre-existing
 * call site fresco-only without touching it.
 */
export function frescoScopeFilter(filterMetadata = null) {
  const f = filterMetadata && typeof filterMetadata === 'object' ? { ...filterMetadata } : {};
  if (f.source_class != null) return f; // explicit scope wins
  if (f.exclude_source_class != null) return f;
  f.exclude_source_class = WORLD_SOURCE_CLASS;
  return f;
}

/** Explicit world-only scoping for retrieval filters. */
export function worldScopeFilter(filterMetadata = null) {
  const f = filterMetadata && typeof filterMetadata === 'object' ? { ...filterMetadata } : {};
  f.source_class = WORLD_SOURCE_CLASS;
  delete f.exclude_source_class;
  return f;
}

/**
 * Delta-delete scope for a (re-)ingest: an ingest may only replace chunks of
 * ITS OWN provenance class. A world ingest of "X.pdf" must never delete the
 * Fresco chunks of "X.pdf", and vice versa.
 */
export function deltaScopeForIngest(extraMetadata = null) {
  if (extraMetadata && extraMetadata.source_class === WORLD_SOURCE_CLASS) {
    return { source_class: WORLD_SOURCE_CLASS };
  }
  return { exclude_source_class: WORLD_SOURCE_CLASS };
}

/** Provenance projection for a retrieved world row (metadata → response). */
export function provenanceOf(metadata = {}) {
  return {
    source_class: metadata.source_class || null,
    source_id: metadata.source_id || null,
    citation: metadata.citation || null,
    filename: metadata.filename || null,
  };
}
