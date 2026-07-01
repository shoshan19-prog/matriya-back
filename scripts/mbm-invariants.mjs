/**
 * MBM Invariant Suite — auto-checks all 5 world-model invariants.
 *
 * The ontology declares that every transition must respect 5 universal laws
 * (or declare an Exception with justification). This module MAKES THAT
 * CHECKABLE: given a Material Behavior Model document it returns a verdict per
 * invariant, listing any transition that violates one without an exception.
 *
 * Operational definitions (necessarily heuristic — the point is structural
 * physical consistency, not full thermodynamics):
 *   1. conservation_of_mass  — a transition whose resultingProperties assert a
 *      mass change (`mass ↓` / `mass ↑`) crosses the system boundary and MUST
 *      declare a conservation_of_mass exception (accounting for the other phase).
 *   2. entropy_monotonicity  — a spontaneous transition (irreversible +
 *      observed/replicated/mechanism_supported) that produces ORDERING
 *      (network / crystallisation / `entropy ↓` / `order … ↑`) must have
 *      accounted for energy (an `energy.sign`) OR declare an exception —
 *      local order needs a thermodynamic driver.
 *   3. causality             — the irreversible-transition graph must be ACYCLIC
 *      (a material cannot irreversibly return to an ancestor state; effect
 *      cannot precede cause). Reversible/conditional edges are excluded.
 *   4. equivalence           — (a) no two distinct state ids may share the same
 *      (material, state) identity; (b) any transition whose endpoints are the
 *      same identity must be reversible.
 *   5. continuity            — a real transition (not unknown/impossible) must be
 *      either a phase change (from.phase ≠ to.phase) OR carry a mechanism (a
 *      described pathway) OR declare an exception — no unexplained jumps.
 *
 * Usage: import { checkInvariants } from './mbm-invariants.mjs'
 *        node scripts/mbm-invariants.mjs   (runs against the stress fixtures)
 */

const SPONTANEOUS = new Set(['observed', 'replicated', 'mechanism_supported']);
const REAL = (t) => t.status !== 'unknown' && t.status !== 'impossible';
const hasException = (t, inv) => (t.invariantExceptions || []).some((x) => x.invariant === inv);
const props = (t) => (t.resultingProperties || []).join(' ; ');
const MASS_RE = /mass\s*[↓↑]/;
const ORDERING_RE = /network|crystall|entropy\s*↓|order\w*\s*↑/i;

export function checkInvariants(doc) {
  const transitions = doc.transitions || [];
  const stateById = Object.fromEntries((doc.states || []).map((s) => [s.id, s]));
  const identity = (id) => { const s = stateById[id]; return s ? `${s.material}::${s.state}` : null; };
  const results = [];

  // 1. conservation_of_mass
  {
    const v = transitions
      .filter((t) => MASS_RE.test(props(t)) && !hasException(t, 'conservation_of_mass'))
      .map((t) => `${t.id}: asserts a mass change without a conservation_of_mass exception`);
    results.push({ invariant: 'conservation_of_mass', ok: v.length === 0, violations: v });
  }

  // 2. entropy_monotonicity
  {
    const v = transitions
      .filter((t) => SPONTANEOUS.has(t.status) && t.reversibility === 'irreversible'
        && ORDERING_RE.test(props(t)) && !(t.energy && t.energy.sign) && !hasException(t, 'entropy_monotonicity'))
      .map((t) => `${t.id}: spontaneous ordering without energy accounting or an entropy_monotonicity exception`);
    results.push({ invariant: 'entropy_monotonicity', ok: v.length === 0, violations: v });
  }

  // 3. causality — no cycles among irreversible edges
  {
    const adj = {};
    for (const t of transitions) {
      if (!REAL(t) || t.reversibility !== 'irreversible' || t.toState == null) continue;
      (adj[t.fromState] ||= []).push(t.toState);
    }
    const WHITE = 0, GREY = 1, BLACK = 2;
    const color = {};
    const cycles = [];
    const dfs = (u, path) => {
      color[u] = GREY;
      for (const w of adj[u] || []) {
        if (color[w] === GREY) { cycles.push([...path, u, w].join(' → ')); }
        else if ((color[w] || WHITE) === WHITE) dfs(w, [...path, u]);
      }
      color[u] = BLACK;
    };
    for (const n of Object.keys(adj)) if ((color[n] || WHITE) === WHITE) dfs(n, []);
    results.push({ invariant: 'causality', ok: cycles.length === 0, violations: cycles.map((c) => `irreversible cycle: ${c}`) });
  }

  // 4. equivalence
  {
    const v = [];
    const seen = {};
    for (const s of doc.states || []) {
      const key = `${s.material}::${s.state}`;
      if (seen[key]) v.push(`duplicate identity '${key}' across state ids '${seen[key]}' and '${s.id}' (should be merged)`);
      else seen[key] = s.id;
    }
    for (const t of transitions) {
      if (t.toState == null) continue;
      const a = identity(t.fromState), b = identity(t.toState);
      if (a && b && a === b && t.reversibility !== 'reversible') {
        v.push(`${t.id}: endpoints share identity '${a}' but transition is not reversible`);
      }
    }
    results.push({ invariant: 'equivalence', ok: v.length === 0, violations: v });
  }

  // 5. continuity
  {
    const v = transitions.filter((t) => {
      if (!REAL(t)) return false;
      const from = stateById[t.fromState], to = t.toState ? stateById[t.toState] : null;
      const phaseChange = from && to && from.phase && to.phase && from.phase !== to.phase;
      const hasMechanism = t.mechanism != null && String(t.mechanism).trim() !== '';
      return !(phaseChange || hasMechanism || hasException(t, 'continuity'));
    }).map((t) => `${t.id}: discontinuous jump with no phase change, mechanism, or exception`);
    results.push({ invariant: 'continuity', ok: v.length === 0, violations: v });
  }

  return { results, allOk: results.every((r) => r.ok) };
}

// --- direct run --------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));
  const { results, allOk } = checkInvariants(doc);
  console.log('MBM Invariant Suite — all 5 invariants auto-checked\n');
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.invariant}${r.ok ? '' : '\n      - ' + r.violations.join('\n      - ')}`);
  }
  console.log('');
  if (!allOk) { console.error('MBM Invariant Suite FAILED'); process.exit(1); }
  console.log('MBM Invariant Suite PASSED — no transition violates an invariant without a declared exception.');
}
