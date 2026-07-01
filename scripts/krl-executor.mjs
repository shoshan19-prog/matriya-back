/**
 * KRL Router — Executor (wires the routing plan to the real layers).
 *
 * classifyIntent() decides WHO owns the query; the executor RUNS the plan through
 * injected layer adapters — the same dependency-injection pattern as G7's
 * runSearch(input, ctx), so it is testable here (stub adapters) and connects to the
 * real ragService in production (lazy adapter) without pulling heavy deps into tests.
 *
 *   ctx = {
 *     krl:       { identifyRelations(query) -> { entities, relations } },
 *     retrieval: { search(query, ctx), aggregate(query, ops, ctx) }   // ragService / SQL
 *   }
 *
 * LAW-KRL-BOUNDARY-001 is enforced at RUNTIME too (defense in depth): even a
 * tampered plan cannot make the KRL adapter aggregate — the executor refuses, and
 * the KRL adapter has no aggregate capability by construction.
 *
 *   Relation    → krl
 *   Aggregation → retrieval.aggregate
 *   Hybrid      → krl → retrieval.aggregate (relation context feeds the aggregation)
 *   Ambiguous   → REVIEW (clarify; nothing is executed)
 */
import { classifyIntent, assertLawKRLBoundary } from './krl-router.mjs';

export async function executePlan(plan, query, ctx) {
  const { krl, retrieval } = ctx;
  const steps = [];
  let relationContext = null;
  for (const step of plan) {
    if (step.layer === 'KRL') {
      const law = assertLawKRLBoundary([step]); // runtime guard
      if (!law.ok) throw new Error('LAW-KRL-BOUNDARY-001 violation at runtime: ' + law.violations[0]);
      const result = await krl.identifyRelations(query);
      relationContext = result;
      steps.push({ layer: 'KRL', op: step.op, result });
    } else if (step.layer === 'Retrieval') {
      const result = step.op === 'aggregate'
        ? await retrieval.aggregate(query, step.aggregationOps || [], { relationContext })
        : await retrieval.search(query, { relationContext });
      steps.push({ layer: 'Retrieval', op: step.op, result });
    } else {
      steps.push({ layer: 'REVIEW', op: 'clarify', result: { clarify: true, message: 'intent unclear — clarify whether you want a relation or an aggregation' } });
    }
  }
  const last = steps[steps.length - 1];
  return { steps, answer: last ? last.result : null, boundaryEnforced: true };
}

export async function route(query, ctx) {
  const c = classifyIntent(query);
  const run = await executePlan(c.plan, query, ctx);
  return { query, intent: c.intent, aggregationOps: c.aggregationOps, plan: c.plan, ...run };
}

/**
 * Production Retrieval adapter backed by ragService (LAZY import — never loaded by
 * the tests, so the sandbox's heavy deps stay out of the unit suite).
 * `aggregate` requires the structured/SQL layer, which is not wired yet.
 */
export async function retrievalFromRagService() {
  const mod = await import('./ragService.js');
  const svc = mod.default || mod.ragService || mod;
  return {
    search: async (query, _c) => (typeof svc.search === 'function' ? svc.search(query) : svc),
    aggregate: async (_query, ops) => { throw new Error(`structured/SQL aggregation layer not wired yet (ops: ${ops.join(',')}) — Retrieval.search (RAG) is available; aggregate needs the SQL layer.`); }
  };
}

// --- direct run: executor wiring + runtime-LAW bite tests -------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  // Stub adapters that RECORD calls (no heavy deps, deterministic).
  const calls = { krl: [], search: [], aggregate: [] };
  const ctx = {
    krl: { identifyRelations: (q) => { calls.krl.push(q); return { entities: ['APP', 'Project'], relations: [['APP', 'used_in', 'Project']] }; } },
    retrieval: {
      search: (q) => { calls.search.push(q); return { hits: ['Project A', 'Project B'] }; },
      aggregate: (q, ops, c) => { calls.aggregate.push({ q, ops, hadRelation: !!(c && c.relationContext) }); return { op: ops[0], value: 'Project A', usedRelation: !!(c && c.relationContext) }; }
    }
  };

  console.log('KRL Executor — wiring the plan to injected layers\n');

  // 1) Relation → only KRL is called
  const r1 = await route('באיזה פרויקטים השתמשו ב-APP?', ctx);
  console.log(`  relation:   intent=${r1.intent}  steps=${r1.steps.map((s) => s.layer).join('→')}`);
  assert(r1.intent === 'relation' && calls.krl.length === 1 && calls.aggregate.length === 0, 'relation query runs KRL only (no aggregation)');

  // 2) Aggregation → only Retrieval.aggregate is called (KRL not called)
  const before = calls.krl.length;
  const r2 = await route('מה אחוז ה-APP הגבוה ביותר?', ctx);
  console.log(`  aggregation:intent=${r2.intent}  steps=${r2.steps.map((s) => s.layer + ':' + s.op).join('→')}  op=${r2.answer.op}`);
  assert(r2.intent === 'aggregation' && calls.aggregate.length === 1 && calls.krl.length === before, 'aggregation query runs Retrieval.aggregate only (KRL untouched)');
  assert(r2.answer.op === 'MAX', 'aggregation op (MAX) reached the Retrieval layer');

  // 3) Hybrid → KRL THEN Retrieval, and the relation context feeds the aggregation
  const r3 = await route('באיזה פרויקט היה אחוז ה-APP הגבוה ביותר?', ctx);
  console.log(`  hybrid:     intent=${r3.intent}  steps=${r3.steps.map((s) => s.layer).join('→')}  usedRelation=${r3.answer.usedRelation}`);
  assert(r3.intent === 'hybrid' && r3.steps[0].layer === 'KRL' && r3.steps[1].layer === 'Retrieval', 'hybrid runs KRL → Retrieval in order');
  assert(r3.answer.usedRelation === true, 'hybrid feeds the KRL relation context into the aggregation');

  // 4) Ambiguous → REVIEW, nothing executed
  const k0 = calls.krl.length, a0 = calls.aggregate.length;
  const r4 = await route('APP?', ctx);
  console.log(`  ambiguous:  intent=${r4.intent}  → ${r4.answer.clarify ? 'clarify' : 'executed'}`);
  assert(r4.intent === 'ambiguous' && r4.answer.clarify === true && calls.krl.length === k0 && calls.aggregate.length === a0, 'ambiguous asks for clarification; neither layer is executed');

  // KRL NEVER received an aggregation across the whole run
  assert(calls.aggregate.length >= 1, 'aggregation happened on the Retrieval layer');
  // (structurally, the KRL adapter has no aggregate method — it cannot aggregate.)
  assert(typeof ctx.krl.aggregate === 'undefined', 'the KRL adapter has no aggregate capability by construction');

  // BITE: a tampered plan that puts aggregation on KRL is refused at RUNTIME
  let threw = false;
  try { await executePlan([{ layer: 'KRL', op: 'MAX', aggregationOps: ['MAX'] }], 'x', ctx); } catch (e) { threw = /LAW-KRL-BOUNDARY-001/.test(e.message); }
  assert(threw, 'runtime LAW: a tampered plan (KRL performing MAX) is refused by the executor');

  console.log('');
  if (fails) { console.error(`KRL Executor FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('KRL Executor PASSED — plan wired to injected layers; relation/aggregation/hybrid/ambiguous execute correctly; KRL never aggregates; runtime LAW enforced.');
}
