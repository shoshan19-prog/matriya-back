// Law graph — in-memory DoD simulation (no DB needed).
// Mirrors the endpoint logic against an in-memory store so the full lifecycle
// is provable here:  establish (K) -> check (C) -> structured breakdown (B) ->
// one decisive experiment (N) -> persisted as law history.
//
//   run:  node scripts/law-graph-demo.mjs
//
import { establishLaw, classifyExperiment, evaluateBreakdownFromEvidence, predict } from '../lawEngine.js';

// reproducible Fresco-style data (same hidden truth as the frontend MVP)
function mulberry32(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd = mulberry32(42); const noise = (k=2)=>(rnd()*2-1)*k;
let id=0; const dry=[], humid=[];
for (const h of [40,50,58,64,70,74]) for (const a of [20,28,34,40]) dry.push({id:`E${++id}`,app_pct:a,humidity_pct:h,ttf_days:+(0.9*a+8+noise()).toFixed(1)});
for (const h of [84,90,96]) for (const a of [20,28,34,40]) humid.push({id:`E${++id}`,app_pct:a,humidity_pct:h,ttf_days:+(12+noise()).toFixed(1)});

// in-memory store + helpers mirroring the router
const store = { laws: [], domains: [], evidence: [], breakdowns: [], gaps: [] };
const lawCoef = (l)=>({a:l.a,b:l.b,x_key:l.x_key,y_key:l.y_key,tolerance:l.tolerance,noise_std:l.noise_std,features:l.features});
function reevaluate(law){
  const rows = store.evidence.filter(e=>e.law_id===law.id);
  const { breakdown, recommendation } = evaluateBreakdownFromEvidence(lawCoef(law), rows);
  if (!breakdown) return {};
  if (store.breakdowns.some(b=>b.law_id===law.id&&b.feature===breakdown.feature&&Math.abs(b.threshold-breakdown.threshold)<1e-6&&b.status==='open')) return {duplicate:true};
  const event = { id:`B${store.breakdowns.length+1}`, law_id:law.id, status:'open', ...breakdown };
  store.breakdowns.push(event); law.status='broken';
  let gap=null;
  if (recommendation){ gap={ id:`G${store.gaps.length+1}`, law_id:law.id, breakdown_event_id:event.id, recommended_experiment:recommendation.experiment, rationale:recommendation.rationale, status:'open' }; store.gaps.push(gap); }
  return { breakdown:event, recommendation:gap };
}

// --- K: POST /laws (establish on the dry evidence we have so far) ---------
const est = establishLaw(dry, 'app_pct', 'ttf_days', ['humidity_pct','app_pct']);
const law = { id:'L1', name:'ttf~app', a:est.a, b:est.b, x_key:'app_pct', y_key:'ttf_days', tolerance:est.tolerance, noise_std:est.noise_std, features:est.features, status:'active', version:1 };
store.laws.push(law);
est.domains.forEach(d=>store.domains.push({law_id:law.id,...d}));
est.inliers.forEach(e=>store.evidence.push({law_id:law.id, experiment:e, kind:'explained', residual:+(e.ttf_days-(est.a*e.app_pct+est.b)).toFixed(3)}));
const appDom = store.domains.find(d=>d.feature==='app_pct');
console.log('K — established law:', `ttf_days ≈ ${law.a.toFixed(2)}·app + ${law.b.toFixed(1)}`, `| domain app ∈ [${appDom.min_value}, ${appDom.max_value}] (invariant-over: humidity)`, `| seeded ${est.inliers.length} evidence`);

// --- C/B/N: POST /laws/check, feeding the humid experiments one by one ----
console.log('\nC — streaming new (humid) experiments through /laws/check:');
let firstBreakdown=null;
for (const exp of humid){
  const domains = store.domains.filter(d=>d.law_id===law.id);
  const c = classifyExperiment(lawCoef(law), domains, exp);
  store.evidence.push({law_id:law.id, experiment:exp, kind:c.label, residual:c.residual});
  let note='';
  if (c.label==='contradiction'){ const r=reevaluate(law); if(r.breakdown&&!r.duplicate){ note=` -> 🔥 BREAKDOWN ${r.breakdown.feature}≥${r.breakdown.threshold}`; if(!firstBreakdown) firstBreakdown=r; } }
  console.log(`  ${exp.id} hum=${exp.humidity_pct} app=${exp.app_pct} ttf=${exp.ttf_days} -> ${c.label} (resid ${c.residual})${note}`);
}

// --- GET /laws/gaps ------------------------------------------------------
console.log('\nN — GET /laws/gaps (what to run next):');
for (const g of store.gaps.filter(g=>g.status==='open'))
  console.log(`  🧪 ${JSON.stringify(g.recommended_experiment)}\n     ${g.rationale}`);

// --- GET /laws/:id/history ----------------------------------------------
const ev = store.evidence.filter(e=>e.law_id===law.id);
console.log('\nL — GET /laws/L1/history:');
console.log(`  law status: ${law.status} (was active, now broken by evidence)`);
console.log(`  evidence: explained=${ev.filter(e=>e.kind==='explained').length} contradiction=${ev.filter(e=>e.kind==='contradiction').length} out_of_domain=${ev.filter(e=>e.kind==='out_of_domain').length}`);
console.log(`  breakdown_events: ${store.breakdowns.length}  gap_recommendations: ${store.gaps.length}`);

const dryMaxHumidity = Math.max(...dry.map(e=>e.humidity_pct));   // 74
const humidMinHumidity = Math.min(...humid.map(e=>e.humidity_pct)); // 84
const recHum = store.gaps[0]?.recommended_experiment.humidity_pct;
const okDoD = law.status==='broken' && store.breakdowns.length===1 && store.gaps.length===1
  && recHum > dryMaxHumidity && recHum < humidMinHumidity;  // decisive experiment sits in the unexplored gap

// --- L: POST /laws/L1/resolve-breakdown -> birth the successor ----------
function resolveBreakdown(parent, event, confirming=[]){
  const { feature, threshold } = event;
  confirming.forEach(exp=>{ const dom=store.domains.filter(d=>d.law_id===parent.id); const c=classifyExperiment(lawCoef(parent),dom,exp); store.evidence.push({law_id:parent.id,experiment:exp,kind:c.label,residual:c.residual}); });
  store.gaps.filter(g=>g.law_id===parent.id&&g.breakdown_event_id===event.id&&g.status==='open').forEach(g=>g.status='run');
  const validExps = store.evidence.filter(e=>e.law_id===parent.id).map(e=>e.experiment).filter(x=>x[feature]<threshold);
  const est = establishLaw(validExps, parent.x_key, parent.y_key, parent.features);
  const child = { id:'L2', name:`${parent.name} | ${feature} < ${threshold}`, x_key:parent.x_key, y_key:parent.y_key, a:est.a, b:est.b, tolerance:est.tolerance, noise_std:est.noise_std, features:parent.features, status:'active', version:parent.version+1, parent_law_id:parent.id };
  store.laws.push(child);
  est.domains.forEach(d=>store.domains.push({law_id:child.id,...d}));
  store.domains.push({law_id:child.id, feature, min_value:Math.min(...validExps.map(x=>x[feature])), max_value:threshold});
  est.inliers.forEach(e=>store.evidence.push({law_id:child.id, experiment:e, kind:'explained', residual:+(e[parent.y_key]-predict(est,e[parent.x_key])).toFixed(3)}));
  parent.status='superseded'; event.status='resolved'; event.resolved_by_law_id=child.id;
  return child;
}
console.log('\nL — POST /laws/L1/resolve-breakdown (decisive experiment confirmed the boundary):');
const decisive = { id:'E_decisive', app_pct:40, humidity_pct:78, ttf_days:43.5 }; // just below boundary: law still holds
const child = resolveBreakdown(law, store.breakdowns[0], [decisive]);
const childHumDom = store.domains.find(d=>d.law_id===child.id&&d.feature==='humidity_pct');
console.log(`  ↳ successor ${child.id}: ${child.name}`);
console.log(`     relation ttf ≈ ${child.a.toFixed(2)}·app + ${child.b.toFixed(1)} | domain humidity ∈ [${childHumDom.min_value}, ${childHumDom.max_value}] | v${child.version} parent=${child.parent_law_id}`);
console.log(`     parent L1 -> ${law.status};  breakdown -> ${store.breakdowns[0].status} (resolved_by ${store.breakdowns[0].resolved_by_law_id})`);
console.log('\n  GET /laws/L2/history -> lineage:');
console.log(`     parent: { id:${child.parent_law_id}, status:${law.status} }`);
console.log(`     L1 (${law.status}, v${law.version})  →  L2 (${child.status}, v${child.version}, humidity<${store.breakdowns[0].threshold})`);

const okL = child.parent_law_id==='L1' && law.status==='superseded' && store.breakdowns[0].status==='resolved'
  && childHumDom.max_value===store.breakdowns[0].threshold && store.breakdowns[0].resolved_by_law_id==='L2';
console.log('\nDoD-L:', okL
  ? '✓ breakdown confirmed -> child law w/ parent_law_id -> new domain saved -> parent superseded -> breakdown resolved -> lineage parent→child'
  : '✗ FAILED');
console.log('\nDoD:', okDoD
  ? '✓ experiment in -> checked vs law -> classified -> breakdown -> ONE decisive experiment -> saved as law history'
  : '✗ FAILED');
process.exit(okDoD && okL ? 0 : 1);
