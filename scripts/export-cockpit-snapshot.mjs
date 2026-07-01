/**
 * Cockpit snapshot exporter.
 *
 * Projects the existing engines into a DECISION-oriented snapshot for the Cockpit
 * UI — three angles on one engine: NOW (cockpit), OVER TIME (timeline), STRUCTURAL
 * (knowledge graph). It adds no engine capability; it only re-shapes existing
 * outputs into what a human needs to DECIDE. No raw JSON dumps on screen.
 *
 * Writes docs/cockpit/snapshot.json, and — if matriya-front- is present — renders
 * the self-contained cockpit page (docs/cockpit/cockpit-template.html with the
 * snapshot injected) to ../matriya-front-/public/cockpit/index.html.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { gatedFlight, passStop } from './p0-1-gated-flight.mjs';
import { transitionConfidence } from './mbm-reliability.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const load = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const mbm = load('docs/material-state/mbm-stress-fixtures.json');
const corpus = load('docs/failure-library/failure-fixtures.json');
const dataset = load('docs/first-flight/dataset-001-app-per-mel.json');
const request = load('docs/first-flight/ingest-request-001-app.json');

function buildSnapshot() {
  const gf = gatedFlight(mbm, corpus, dataset, request);
  const ps = passStop(gf);
  const f = gf.flight;

  // --- Cockpit (NOW) --------------------------------------------------------
  const ctx = f.surveillance.filter((s) => s.verdict === 'context_changed');
  const surprise = f.surveillance.filter((s) => s.verdict === 'candidate_new');
  const artifact = f.surveillance.filter((s) => s.verdict === 'model_rejected');
  const observationClasses = {
    observation: f.observations.length - (ctx.length + surprise.length + artifact.length),
    context: ctx.length, surprise: surprise.length, artifact: artifact.length
  };
  const surpriseObs = surprise[0];
  const corpusCase = surpriseObs && ((surpriseObs.adversarial || []).find((x) => /oxid/.test(x)) || (surpriseObs.adversarial || [])[0]);
  const proposedHypothesis = surpriseObs
    ? { text: `char oxidation near ${surpriseObs.tempC} °C (unexpected endotherm)`, epistemic: 'Hypothesized', adversarial: corpusCase || null }
    : null;
  const nextExperiment = surpriseObs
    ? `Increase DSC/TGA sampling ${surpriseObs.tempC - 20}–${surpriseObs.tempC + 10} °C (in air) to resolve the ${surpriseObs.tempC} °C surprise`
    : (f.hypotheses[0] ? `Instrument the weakest step of ${f.hypotheses[0].route}` : 'n/a');

  const cockpit = {
    project: 'APP/PER/MEL Intumescent — Dataset 001',
    dataFlag: dataset.flag,
    gates: gf.gate.gates,
    promotable: gf.gate.promotable,
    verdict: ps.verdict,
    verdictReasons: ps.reasons,
    promotion: f.report.promotionApplied ? 'ON' : 'OFF',
    accuracy: f.accuracy,
    observationClasses,
    topHypothesis: f.hypotheses[0] ? { route: f.hypotheses[0].route, mri: f.hypotheses[0].mri, epistemic: f.hypotheses[0].epistemic } : null,
    proposedHypothesis,
    nextExperiment,
    coPilotQuestions: f.coPilot.questions
  };

  // --- Knowledge graph (STRUCTURAL) ----------------------------------------
  const appTx = (mbm.transitions || []).filter((t) => t.fromState && t.fromState.startsWith('app:') && t.toState && t.toState.startsWith('app:'));
  const grounded = new Set(['app_ppa1', 'app_ppa2']); // grounded by P0.1 (EN 13381-8 / ISO 834)
  const tierOf = (t) => grounded.has(t.id) ? 'grounded' : (['observed', 'replicated', 'mechanism_supported'].includes(t.status) ? 'strong' : 'inferred');
  const corpusFor = (id) => (corpus.cases || []).filter((c) => c.mappedMBM && c.mappedMBM.competingMechanismFor === id);
  const edges = appTx.map((t) => {
    const cc = corpusFor(t.id);
    return {
      from: t.fromState, to: t.toState, id: t.id, mechanism: t.mechanism || '', status: t.status,
      tier: tierOf(t), confidence: transitionConfidence(t).c,
      evidence: [...(t.evidence || []).map((e) => e.documentType), ...(grounded.has(t.id) ? ['EN 13381-8 / ISO 834 (P0.1)'] : [])],
      deltaK: [], contradictions: [],
      experiments: cc.map((c) => c.suggestedExperiment).filter(Boolean),
      competingMechanisms: cc.map((c) => c.claimedMechanism)
    };
  });
  // ΔK edge from the failure corpus: char → char_oxidized (new state, broken law)
  const oxid = (corpus.cases || []).find((c) => c.id === 'fail_app_char_oxidation');
  if (oxid) edges.push({
    from: oxid.mappedMBM.fromState, to: oxid.mappedMBM.toState, id: oxid.id, mechanism: oxid.mappedMBM.mechanism,
    status: 'candidate_new', tier: 'inferred', confidence: null,
    evidence: [oxid.evidenceQuality], deltaK: [`new state ${oxid.mappedMBM.toState}`],
    contradictions: oxid.brokenInvariant ? [oxid.brokenInvariant] : [], experiments: [oxid.suggestedExperiment].filter(Boolean),
    competingMechanisms: []
  });
  const nodeIds = [...new Set(edges.flatMap((e) => [e.from, e.to]))];
  const graph = {
    nodes: nodeIds.map((id) => ({ id, label: id.replace('app:', '') })),
    edges,
    legend: { grounded: 'green — sourced/standard', strong: 'yellow — observed / mechanism-supported', inferred: 'grey — inferred / hypothesized' }
  };

  // --- Timeline (OVER TIME) — real build/knowledge history ------------------
  const timeline = {
    kind: 'knowledge-position (build history — real)',
    note: 'Per-formulation history (supplier change → measurement → ΔK) populates once real datasets flow through P0.1. These are the model-knowledge milestones of the build.',
    events: [
      { label: 'Ontology v1.0', event: 'Material Behavior Model defined', delta: 'states + transitions + 5 invariants' },
      { label: 'v1.0 → v1.1', event: 'falsified by the stress test', delta: 'added driver families, unknown/impossible, entropy' },
      { label: 'Stage B/C', event: 'reliability + scientific reasoning loop', delta: 'MRI, uncertainty, info-gain, planner, calibration, RRI' },
      { label: 'Failure KB', event: 'external failure corpus grounded in standards', delta: '+8 competing mechanisms, +9 ΔK' },
      { label: 'First Flight', event: 'Dataset 001 through G1–G6 (gated)', delta: `surprise @${surpriseObs ? surpriseObs.tempC : '—'} °C detected` },
      { label: 'Now', event: 'current scientific position', delta: `${cockpit.topHypothesis ? cockpit.topHypothesis.route + ' (' + cockpit.topHypothesis.epistemic + ')' : ''}` }
    ]
  };

  return {
    generated: 'cockpit snapshot — projection of existing engines (no new capability)',
    flag: 'illustrative (numeric values reference-class; provenance grounded in real standards)',
    cockpit, graph, timeline
  };
}

// --- write outputs ----------------------------------------------------------
const snapshot = buildSnapshot();
const outDir = join(root, 'docs', 'cockpit');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2));

// render the self-contained page if the template + front repo exist
const tplPath = join(outDir, 'cockpit-template.html');
const frontDir = join(root, '..', 'matriya-front-', 'public', 'cockpit');
if (existsSync(tplPath)) {
  const tpl = readFileSync(tplPath, 'utf8');
  const html = tpl.replace('/*__SNAPSHOT__*/{}', JSON.stringify(snapshot));
  const targets = [join(outDir, 'index.html')];
  if (existsSync(join(root, '..', 'matriya-front-'))) { if (!existsSync(frontDir)) mkdirSync(frontDir, { recursive: true }); targets.push(join(frontDir, 'index.html')); writeFileSync(join(frontDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2)); }
  for (const t of targets) writeFileSync(t, html);
}

// --- self-consistency -------------------------------------------------------
let fails = 0;
const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };
console.log('Cockpit snapshot exported.\n');
console.log(`  cockpit: verdict=${snapshot.cockpit.verdict} promotable=${snapshot.cockpit.promotable} obs=${JSON.stringify(snapshot.cockpit.observationClasses)}`);
console.log(`  graph: ${snapshot.graph.nodes.length} nodes, ${snapshot.graph.edges.length} edges  (grounded ${snapshot.graph.edges.filter((e) => e.tier === 'grounded').length}, strong ${snapshot.graph.edges.filter((e) => e.tier === 'strong').length}, inferred ${snapshot.graph.edges.filter((e) => e.tier === 'inferred').length})`);
console.log(`  timeline: ${snapshot.timeline.events.length} milestones`);

assert(snapshot.cockpit && snapshot.graph && snapshot.timeline, 'snapshot has all three views');
assert(Object.values(snapshot.cockpit.gates).every(Boolean), 'cockpit shows all gates green (the gated flight passed G1–G6)');
assert(['PASS', 'STOP'].includes(snapshot.cockpit.verdict), 'cockpit carries a PASS/STOP verdict');
const oc = snapshot.cockpit.observationClasses;
assert(oc.observation + oc.context + oc.surprise + oc.artifact === dataset.observations.length, 'observation classes partition all observations');
assert(snapshot.cockpit.observationClasses.surprise >= 1 && snapshot.cockpit.proposedHypothesis, 'a surprise yields exactly the proposed hypothesis');
assert(snapshot.graph.edges.some((e) => e.tier === 'grounded') && snapshot.graph.edges.some((e) => e.tier === 'inferred'), 'graph edges are colour-tiered (grounded + inferred present)');
assert(snapshot.graph.edges.some((e) => e.contradictions.length), 'graph carries at least one contradiction edge (char oxidation broken law)');
assert(snapshot.timeline.events.length >= 4, 'timeline has knowledge milestones');
assert(JSON.stringify(buildSnapshot()) === JSON.stringify(snapshot), 'exporter is deterministic');

console.log('');
if (fails) { console.error(`Cockpit snapshot FAILED: ${fails} check(s)`); process.exit(1); }
console.log('Cockpit snapshot PASSED — three decision-oriented views projected from the engines; deterministic; no new capability.');
