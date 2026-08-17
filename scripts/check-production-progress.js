/**
 * Production Progress monitor — record + renderer checks.
 * Run: node scripts/check-production-progress.js
 */
import assert from 'node:assert/strict';
import { loadProgressRecord, validateProgressRecord, renderProgressPage } from '../lib/productionProgress.js';

// 1) The canonical record loads and satisfies the binding schema.
const record = loadProgressRecord();
assert.ok(record.sessions.length >= 1);

// 2) Schema violations are refused (a session may not omit the no-change flag).
assert.throws(() => validateProgressRecord({ sessions: [{ id: 'x', date: 'y', title: 't', attention_now: 'a' }] }), /no_production_change/);
assert.throws(() => validateProgressRecord({ sessions: [] }), /non-empty/);
assert.throws(
  () => validateProgressRecord({ sessions: [{ id: 'x', date: 'y', title: 't', attention_now: 'a', no_production_change: false, capability_delta: [{ name: 'n', before: 'b', now: 'n', stage: 'WRITTEN', evidence: 'e', impact: 'i' }] }] }),
  /bad stage/
);

// 3) Renderer: gate self-test passing upgrades the comparison capability to
//    LIVE VERIFIED; DB down leaves World Knowledge at DEPLOYED (never LIVE).
const html = renderProgressPage(record, {
  deploy_sha: 'test123',
  served_at: '2026-08-17T00:00:00Z',
  gate_selftest: { ok: true, relation: 'NOT_COMPARABLE' },
  world_status: { ok: false, error: 'no db in test' },
});
assert.ok(html.includes('MATRIYA · Production Progress'));
assert.ok(html.includes('ATTENTION NOW'));
assert.ok(html.includes('LIVE VERIFIED'), 'gate self-test pass must surface LIVE VERIFIED');
assert.ok(html.includes('DEPLOYED'), 'DB-dependent capability must stay DEPLOYED when DB is unverified');
assert.ok(html.includes('NOT_COMPARABLE'));
assert.ok(!html.includes('undefined'));

// 4) A failing gate self-test must surface as a regression, never as LIVE.
const htmlBad = renderProgressPage(record, {
  deploy_sha: 'test123', served_at: 'now',
  gate_selftest: { ok: false, relation: 'error: boom' },
  world_status: { ok: false, error: 'no db' },
});
assert.ok(htmlBad.includes('self-test'), 'failure must be visible');
assert.ok(!htmlBad.includes('class="stage s-LIVE_VERIFIED"'), 'nothing may claim LIVE_VERIFIED when self-tests fail');
assert.ok(html.includes('class="stage s-LIVE_VERIFIED"'), 'passing self-test must actually render a LIVE_VERIFIED pill');

// 5) NO PRODUCTION CHANGE sessions render the explicit banner.
const npc = { sessions: [{ id: 'n', date: 'd', title: 't', attention_now: 'a', no_production_change: true, capability_delta: [], merged_to_main: [], regressions: [], open_decisions: [] }] };
assert.ok(renderProgressPage(npc, { gate_selftest: { ok: true, relation: 'NOT_COMPARABLE' }, world_status: { ok: false, error: 'x' } }).includes('NO PRODUCTION CHANGE'));

console.log('check-production-progress: OK');
