/**
 * KRL ↔ Retrieval Router — an AUTHORITY contract, not a technology split.
 *
 *   KRL       identifies semantic intent (entities, relations).
 *   Retrieval executes data operations (lookup, filter, rank, aggregate).
 *
 * The router classifies a query's intent into four lanes and dispatches:
 *   Relation    → KRL
 *   Aggregation → Retrieval (ragService / SQL / RAG)
 *   Hybrid      → KRL → Retrieval   (identify the relation, THEN aggregate)
 *   Ambiguous   → REVIEW / Clarification
 *
 * LAW-KRL-BOUNDARY-001 (enforced by assertLawKRLBoundary):
 *   KRL may identify entities, relations, and semantic intent.
 *   KRL must NEVER execute aggregation, ranking, filtering, or statistics.
 *   Those operations belong to the Retrieval layer.
 *
 * The Guard detects aggregation by OPERATION CONCEPT (bilingual triggers), not a
 * fixed regex — so "מוביל בכמות" (leads in quantity) is caught as TOP/COUNT even
 * without the word "highest". Heuristic-by-design (documented); a future embedding
 * classifier can replace the trigger sets without changing the contract.
 */
// Aggregation operation concepts → bilingual lexical triggers (lowercased match).
export const AGG_OPS = {
  MAX: ['highest', 'maximum', 'max ', 'largest', 'greatest', 'הגבוה ביותר', 'הכי גבוה', 'המקסימלי', 'הגדול ביותר', 'הכי הרבה'],
  MIN: ['lowest', 'minimum', 'min ', 'smallest', 'least', 'הנמוך ביותר', 'הכי נמוך', 'המינימלי', 'הכי מעט'],
  AVG: ['average', 'mean ', 'avg', 'ממוצע'],
  COUNT: ['how many', 'count', 'number of', 'כמה', 'כמות', 'מספר'],
  TOP: ['top ', 'leading', 'leader', 'the most', 'used the most', 'מוביל', 'מובילים', 'הכי'],
  RANK: ['rank', 'ranking', 'דרג', 'דירוג'],
  ORDER: ['order by', 'sort', 'sorted', 'מיין', 'לפי סדר', 'לפי אחוז', 'לפי כמות'],
  FILTER: ['filter', 'only ', 'more than', 'above ', 'below ', 'סנן', 'רק ', 'מעל', 'מתחת', 'יותר מ']
};
// Relation triggers (a query about how entities connect).
const REL_TRIGGERS = ['באיז', 'איזה פרויקט', 'אילו', 'באילו', 'השתמשו', 'משתמש', 'מכיל', 'מופיע', 'קשור', 'הקשר בין', 'קשר בין', 'which project', 'in which project', 'used in', 'used the', 'contains', 'appears in', 'related to', 'connected', 'which supplier'];
// Entity typing for "relational grouping" (aggregating a CONTAINER by a MATERIAL/2nd
// entity ⇒ a relation is involved ⇒ Hybrid, not pure aggregation).
const CONTAINERS = ['project', 'projects', 'supplier', 'suppliers', 'product', 'products', 'formulation', 'פרויקט', 'פרויקטים', 'ספק', 'ספקים', 'מוצר', 'מוצרים', 'פורמולציה'];
const MATERIALS = ['app', 'silicate', 'char', 'ppa', 'melamine', 'pentaerythritol', 'intumescent'];
const GROUPING = [' by ', 'לפי'];
// Operations KRL is forbidden to perform (LAW-KRL-BOUNDARY-001).
export const KRL_FORBIDDEN = [...Object.keys(AGG_OPS), 'aggregate', 'rank', 'filter', 'statistics'];

const norm = (q) => ` ${String(q || '').toLowerCase()} `;
export function detectAggregation(query) {
  const s = norm(query);
  return Object.entries(AGG_OPS).filter(([, triggers]) => triggers.some((t) => s.includes(t))).map(([op]) => op);
}
export function detectRelation(query) {
  const s = norm(query);
  return REL_TRIGGERS.some((t) => s.includes(t));
}

export function classifyIntent(query) {
  const s = norm(query);
  const aggregationOps = detectAggregation(query);
  const hasAgg = aggregationOps.length > 0;
  // relational grouping: aggregating a CONTAINER by a MATERIAL / grouping connector
  const container = CONTAINERS.some((c) => s.includes(c));
  const material = MATERIALS.some((m) => s.includes(m));
  const grouping = GROUPING.some((g) => s.includes(g));
  const relationalGrouping = container && (material || grouping);
  const hasRel = detectRelation(query) || (hasAgg && relationalGrouping);
  let intent, plan;
  if (hasRel && hasAgg) {
    intent = 'hybrid';
    plan = [{ layer: 'KRL', op: 'identify_relations' }, { layer: 'Retrieval', op: 'aggregate', aggregationOps }];
  } else if (hasAgg) {
    intent = 'aggregation';
    plan = [{ layer: 'Retrieval', op: 'aggregate', aggregationOps }];
  } else if (hasRel) {
    intent = 'relation';
    plan = [{ layer: 'KRL', op: 'identify_relations' }];
  } else {
    intent = 'ambiguous';
    plan = [{ layer: 'REVIEW', op: 'clarify' }];
  }
  return { query, intent, relation: hasRel, aggregationOps, plan };
}

/**
 * Enforce LAW-KRL-BOUNDARY-001: no KRL step may carry an aggregation/ranking/
 * filtering/statistical operation.
 */
export function assertLawKRLBoundary(plan) {
  const violations = [];
  for (const step of plan) {
    if (step.layer !== 'KRL') continue;
    const opForbidden = KRL_FORBIDDEN.map((x) => x.toLowerCase()).includes(String(step.op).toLowerCase());
    const carriesAgg = Array.isArray(step.aggregationOps) && step.aggregationOps.length > 0;
    if (opForbidden || carriesAgg) violations.push(`KRL step '${step.op}' performs a Retrieval-only operation${carriesAgg ? ' (' + step.aggregationOps.join(',') + ')' : ''}`);
  }
  return { ok: violations.length === 0, violations };
}

// --- direct run: 4-group boundary suite + LAW bite test ---------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const corpus = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'krl', 'boundary-questions.json'), 'utf8'));

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };
  const EXPECT = { pure_relation: 'relation', pure_aggregation: 'aggregation', hybrid: 'hybrid', ambiguous: 'ambiguous' };

  console.log('KRL ↔ Retrieval Router — authority contract (4 boundary groups)\n');
  for (const [group, { questions }] of Object.entries(corpus.groups)) {
    const want = EXPECT[group];
    let ok = 0;
    for (const q of questions) {
      const r = classifyIntent(q);
      if (r.intent === want) ok++; else console.log(`    ✗ [${group}] "${q}" → ${r.intent} (want ${want})`);
      // LAW must hold for EVERY produced plan
      assert(assertLawKRLBoundary(r.plan).ok, `LAW holds for "${q}"`);
    }
    console.log(`  ${group.padEnd(18)} ${ok}/${questions.length} → ${want}`);
    assert(ok === questions.length, `${group}: all classified as ${want}`);
  }

  // spotlight: the two contrasting examples from the discussion
  assert(classifyIntent('באיזה פרויקטים השתמשו ב-APP?').intent === 'relation', 'relation intent: "which projects used APP" → KRL');
  assert(classifyIntent('מה אחוז ה-APP הגבוה ביותר?').intent === 'aggregation', 'aggregation intent: "highest APP %" → Retrieval');
  assert(classifyIntent('באיזה פרויקט היה אחוז ה-APP הגבוה ביותר?').intent === 'hybrid', 'hybrid intent: "which project had the highest APP %" → KRL → Retrieval');
  // intent-Guard (not regex): catches "מוביל בכמות" with no "highest"
  const leads = classifyIntent('איזה פרויקט מוביל בכמות APP?');
  assert(leads.aggregationOps.length > 0, 'intent-Guard catches "מוביל בכמות" as an aggregation concept (no "highest")');

  // BITE: a plan that puts aggregation on KRL must be caught by the LAW.
  const badPlan = [{ layer: 'KRL', op: 'MAX', aggregationOps: ['MAX'] }];
  const law = assertLawKRLBoundary(badPlan);
  assert(law.ok === false && law.violations.length === 1, 'LAW-KRL-BOUNDARY-001 bites: KRL performing MAX is rejected');
  // and no router-produced plan ever routes aggregation to KRL
  const allPlans = Object.values(corpus.groups).flatMap((g) => g.questions).map((q) => classifyIntent(q).plan);
  assert(allPlans.every((p) => assertLawKRLBoundary(p).ok), 'no router plan violates the KRL boundary');
  // purity
  assert(JSON.stringify(classifyIntent('top 5 materials by usage')) === JSON.stringify(classifyIntent('top 5 materials by usage')), 'classifyIntent is pure');

  console.log('');
  if (fails) { console.error(`KRL Router boundary suite FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('KRL Router PASSED — Relation/Aggregation/Hybrid/Ambiguous routed correctly; intent-Guard catches semantic aggregation; LAW-KRL-BOUNDARY-001 enforced.');
}
