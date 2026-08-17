/**
 * Dual-Provenance POC — minimal proof that MATRIYA can hold two ISOLATED
 * knowledge provenances (Fresco internal vs. World external) and compare a
 * single claim across them WITHOUT ever pooling the two into one bucket.
 *
 * Scope (deliberately minimal):
 *   - No web/search API, no new retrieval engine, no extra models.
 *   - Pure logic over an extended evidence contract.
 *   - The "world" side is supplied by ONE manual, frozen fixture.
 *
 * The only thing this proves: the data model CAN represent "this is Fresco"
 * vs "this is external" as distinct provenance, and produce a comparison with
 * full provenance on both sides. That is the structural blocker we are breaking.
 */

/** The only two provenance classes. A claim without one is illegal. */
export const SOURCE_CLASSES = Object.freeze(['fresco_internal', 'world_external']);

/** Comparison outcomes. */
export const RELATION = Object.freeze({
  AGREE: 'AGREE',
  CONFLICT: 'CONFLICT',
  FRESCO_ONLY: 'FRESCO_ONLY', // world side missing == a Knowledge Gap
  WORLD_ONLY: 'WORLD_ONLY',
});

/**
 * The extended evidence contract — the minimal unit the user approved.
 * @typedef {Object} Claim
 * @property {'fresco_internal'|'world_external'} source_class  MANDATORY provenance
 * @property {string} source_id   Stable id of the source (file, frozen ref, ...)
 * @property {string} subject     e.g. "INT-TFX-001 (APP:PER:MEL)"
 * @property {string} metric      e.g. "Expansion Ratio"
 * @property {number|[number,number]} value  scalar OR [min,max] range
 * @property {string} [unit]      e.g. "ratio (x)"
 * @property {string} [context]   free-text provenance context
 */

/** Validate a claim carries mandatory, well-formed provenance. Throws if not. */
export function assertClaim(claim) {
  if (!claim || typeof claim !== 'object') throw new Error('claim must be an object');
  if (!SOURCE_CLASSES.includes(claim.source_class)) {
    throw new Error(
      `claim.source_class must be one of ${SOURCE_CLASSES.join('|')} (got ${JSON.stringify(claim.source_class)})`
    );
  }
  if (typeof claim.source_id !== 'string' || claim.source_id.trim() === '') {
    throw new Error('claim.source_id is required (non-empty string)');
  }
  if (!claim.subject || !claim.metric) throw new Error('claim.subject and claim.metric are required');
  if (claim.value == null) throw new Error('claim.value is required');
  return claim;
}

/** Normalize a scalar or [min,max] into a sorted [lo,hi] interval. */
function toInterval(value) {
  if (Array.isArray(value)) {
    const [a, b] = value;
    return [Math.min(a, b), Math.max(a, b)];
  }
  return [value, value];
}

function intervalsOverlap([aLo, aHi], [bLo, bHi], eps) {
  return aLo <= bHi + eps && bLo <= aHi + eps;
}

function projectSide(claim) {
  if (!claim) return null;
  return {
    source_class: claim.source_class,
    source_id: claim.source_id,
    value: claim.value,
    unit: claim.unit ?? '',
    context: claim.context ?? '',
  };
}

/**
 * Compare exactly ONE Fresco claim against ONE World claim, keeping the two
 * provenances isolated. Either side may be null (missing).
 *
 * ISOLATION INVARIANT (the "don't mix provenance" rule): when both sides are
 * present they MUST have different source_class AND different source_id. Any
 * attempt to compare two same-provenance claims is refused — that would be
 * pooling, which is exactly what the current system does wrong.
 *
 * @param {Claim|null} frescoClaim  must be source_class 'fresco_internal'
 * @param {Claim|null} worldClaim   must be source_class 'world_external'
 * @returns {{subject:string, metric:string, fresco:object|null, world:object|null,
 *            relation:string, provenance:Array<{source_class:string,source_id:string}>}}
 */
export function compareClaims(frescoClaim, worldClaim, { eps = 1e-6 } = {}) {
  if (frescoClaim != null) {
    assertClaim(frescoClaim);
    if (frescoClaim.source_class !== 'fresco_internal') {
      throw new Error(`fresco side must be fresco_internal (got ${frescoClaim.source_class})`);
    }
  }
  if (worldClaim != null) {
    assertClaim(worldClaim);
    if (worldClaim.source_class !== 'world_external') {
      throw new Error(`world side must be world_external (got ${worldClaim.source_class})`);
    }
  }
  if (frescoClaim == null && worldClaim == null) {
    throw new Error('at least one side is required');
  }

  // Isolation guard — refuse to pool same-provenance claims.
  if (frescoClaim && worldClaim) {
    if (frescoClaim.source_class === worldClaim.source_class) {
      throw new Error('provenance mix refused: both claims share the same source_class');
    }
    if (frescoClaim.source_id === worldClaim.source_id) {
      throw new Error('provenance mix refused: both claims share the same source_id');
    }
  }

  let relation;
  if (frescoClaim && !worldClaim) {
    relation = RELATION.FRESCO_ONLY;
  } else if (!frescoClaim && worldClaim) {
    relation = RELATION.WORLD_ONLY;
  } else {
    const overlap = intervalsOverlap(toInterval(frescoClaim.value), toInterval(worldClaim.value), eps);
    relation = overlap ? RELATION.AGREE : RELATION.CONFLICT;
  }

  return {
    subject: (frescoClaim || worldClaim).subject,
    metric: (frescoClaim || worldClaim).metric,
    fresco: projectSide(frescoClaim),
    world: projectSide(worldClaim),
    relation,
    // Full provenance — every source that fed the row, kept distinct. Never merged.
    provenance: [frescoClaim, worldClaim]
      .filter(Boolean)
      .map((c) => ({ source_class: c.source_class, source_id: c.source_id })),
  };
}

/** Pretty one-line rendering of a comparison, for the demo board. */
export function renderComparison(cmp) {
  const f = cmp.fresco ? `${JSON.stringify(cmp.fresco.value)} [${cmp.fresco.source_id}]` : '—';
  const w = cmp.world ? `${JSON.stringify(cmp.world.value)} [${cmp.world.source_id}]` : '—';
  return `${cmp.metric} | Fresco=${f}  vs  World=${w}  ->  ${cmp.relation}`;
}
