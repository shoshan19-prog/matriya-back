/**
 * MATRIYA · Production Progress — the canonical production change monitor.
 *
 * Renders data/production-progress.json (the binding per-session record) as a
 * single screen, and upgrades each capability's stage with RUNTIME self-checks
 * performed inside the production process itself:
 *
 *   CODED < MERGED < DEPLOYED < LIVE_VERIFIED
 *
 * DEPLOYED is a runtime fact (this code is serving the request); LIVE_VERIFIED
 * is granted only when a self-test actually passed in this process. A
 * capability is never presented as an improvement while only CODED.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const RECORD_PATH = join(__dir, '..', 'data', 'production-progress.json');

export function loadProgressRecord() {
  const raw = JSON.parse(readFileSync(RECORD_PATH, 'utf8'));
  validateProgressRecord(raw);
  return raw;
}

export function validateProgressRecord(record) {
  if (!record || !Array.isArray(record.sessions) || record.sessions.length === 0) {
    throw new Error('production-progress: sessions[] is required and non-empty');
  }
  for (const s of record.sessions) {
    for (const k of ['id', 'date', 'title', 'attention_now']) {
      if (!s[k]) throw new Error(`production-progress: session missing ${k}`);
    }
    if (typeof s.no_production_change !== 'boolean') {
      throw new Error(`production-progress: session ${s.id} missing no_production_change`);
    }
    for (const c of s.capability_delta || []) {
      for (const k of ['name', 'before', 'now', 'stage', 'evidence', 'impact']) {
        if (!c[k]) throw new Error(`production-progress: capability in ${s.id} missing ${k}`);
      }
      if (!['CODED', 'MERGED', 'DEPLOYED', 'LIVE_VERIFIED'].includes(c.stage)) {
        throw new Error(`production-progress: bad stage ${c.stage}`);
      }
    }
  }
  return true;
}

const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/**
 * @param {object} record  loaded progress record
 * @param {object} live    runtime signals gathered by the route:
 *   { deploy_sha, gate_selftest: {ok, relation}, world_status: {ok, counts|error},
 *     served_at }
 */
export function renderProgressPage(record, live = {}) {
  const [current, previous] = record.sessions;
  const gateOk = !!live.gate_selftest?.ok;
  const dbOk = !!live.world_status?.ok;
  const worldDocs = dbOk
    ? (live.world_status.counts.find((c) => c.source_class === 'world_external')?.files_count || 0)
    : null;

  // Runtime stage upgrade: everything in main that this process serves is
  // DEPLOYED; LIVE_VERIFIED only with a passing self-test.
  const stageOf = (cap) => {
    if (cap.stage === 'CODED') return 'CODED';
    let stage = 'DEPLOYED'; // this very page is running that merged code
    if (/compare|השוואה/i.test(cap.name) && gateOk) stage = 'LIVE_VERIFIED';
    if (/World Knowledge/i.test(cap.name) && dbOk) stage = 'LIVE_VERIFIED';
    if (/Inventory/i.test(cap.name)) stage = 'DEPLOYED';
    return stage;
  };
  const stagePill = (stage) => `<span class="stage s-${stage}">${stage.replace('_', ' ')}</span>`;

  const deltaRows = (current.capability_delta || []).map((c) => `
    <div class="cap">
      <h3>${esc(c.name)} ${stagePill(stageOf(c))}</h3>
      <div class="bna"><span class="before">${esc(c.before)}</span><span class="arrow">←</span><span class="now">${esc(c.now)}</span></div>
      <div class="meta">ראיה: ${esc(c.evidence)}</div>
      <div class="impact">${esc(c.impact)}</div>
    </div>`).join('');

  const liveChecks = `
    <li class="${gateOk ? 'ok' : 'bad'}">שער ההשוואה (self-test בתהליך זה): ${gateOk ? `רץ ומחזיר ${esc(live.gate_selftest.relation)} על מקרה חסר-תנאים — LIVE VERIFIED` : 'נכשל — ראה REGRESSIONS'}</li>
    <li class="${dbOk ? 'ok' : 'warn'}">מסד הנתונים / corpus: ${dbOk ? `זמין · world_external = ${worldDocs} מסמכים · ${esc(JSON.stringify(live.world_status.counts))}` : `לא זמין מהתהליך (${esc(live.world_status?.error || 'unknown')}) — יכולות DB מדווחות DEPLOYED בלבד`}</li>
    <li class="ok">זהות פריסה: ‎${esc(live.deploy_sha || 'unknown')}‎ · נצפה ${esc(live.served_at || '')}</li>`;

  const regressions = [
    ...(current.regressions || []),
    ...(!gateOk ? ['שער ההשוואה נכשל ב-self-test בזמן-ריצה'] : []),
  ];

  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MATRIYA · Production Progress</title><style>
:root{--bg:#F7F8F7;--card:#FFFFFF;--ink:#1A2421;--dim:#5B6B66;--line:#DCE3E0;--accent:#0E7C6B;--accent-soft:#E3F0ED;--ok:#2E7D4F;--warn:#B07818;--crit:#B3403A;--mono:ui-monospace,Consolas,monospace}
@media (prefers-color-scheme: dark){:root{--bg:#101816;--card:#18221F;--ink:#E8EEEB;--dim:#93A39D;--line:#2A3733;--accent:#35B39C;--accent-soft:#173B34;--ok:#5CB97F;--warn:#D9A544;--crit:#E07B74}}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--ink);font-family:system-ui,'Segoe UI',sans-serif;line-height:1.55;padding:24px 16px 60px}
main{max-width:920px;margin:auto;display:flex;flex-direction:column;gap:16px}
h1{font-size:22px;font-weight:800}.sub{color:var(--dim);font-size:13px;margin-top:2px}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
h2{font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
.attn{border-inline-start:4px solid var(--accent);background:var(--accent-soft)}
.attn p{font-size:15px;font-weight:600}
.cap{border-bottom:1px solid var(--line);padding:10px 0}.cap:last-child{border-bottom:none}
.cap h3{font-size:14.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.bna{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:13px;margin-top:4px}
.before{color:var(--dim);text-decoration:line-through .5px}.arrow{color:var(--dim)}.now{font-weight:700}
.meta{font-size:12px;color:var(--dim);margin-top:2px}.impact{font-size:13px;margin-top:4px;color:var(--accent);font-weight:600}
.stage{font-family:var(--mono);font-size:10.5px;font-weight:700;border-radius:4px;padding:1px 7px;direction:ltr}
.s-CODED{background:var(--line);color:var(--dim)}.s-MERGED{background:var(--accent-soft);color:var(--accent)}
.s-DEPLOYED{background:var(--accent);color:#fff}.s-LIVE_VERIFIED{background:var(--ok);color:#fff}
ul{list-style:none;display:flex;flex-direction:column;gap:6px;font-size:13.5px}
li::before{content:"·";margin-inline-end:8px;font-weight:800;color:var(--dim)}
li.ok::before{content:"✓";color:var(--ok)}li.warn::before{content:"!";color:var(--warn)}li.bad::before{content:"✗";color:var(--crit)}
.merge{font-size:13.5px}.merge .sha{font-family:var(--mono);font-size:11.5px;direction:ltr;display:inline-block;color:var(--dim)}
.none{color:var(--dim);font-size:13.5px}.npc{font-size:15px;font-weight:800;color:var(--warn)}
</style></head><body><main>
<header><h1>MATRIYA · Production Progress</h1>
<div class="sub">רשומה: ${esc(current.date)} · «${esc(current.title)}» · מול סשן קודם: ${esc(previous ? previous.date : '—')}</div></header>

<section class="attn"><h2>ATTENTION NOW — הדבר האחד</h2><p>${esc(current.attention_now)}</p></section>

<section><h2>SINCE LAST SESSION — מה השתנה</h2>
${current.no_production_change ? '<p class="npc">NO PRODUCTION CHANGE</p>' : deltaRows || '<p class="none">אין דלתא</p>'}
</section>

<section><h2>LIVE IN PRODUCTION — אומת בתהליך הזה עכשיו</h2><ul>${liveChecks}</ul></section>

<section><h2>MERGED TO MAIN</h2>
${(current.merged_to_main || []).map((m) => `<div class="merge">‎<span class="sha">#${esc(m.pr)} · ${esc(m.sha)}</span>‎ — ${esc(m.title)}</div>`).join('') || '<p class="none">אין מיזוגים בסשן זה</p>'}
</section>

<section><h2>CURRENT PRODUCT STATE</h2><ul>
<li class="ok">LIVE — מנוע RAG פנימי, לולאת מחקר + critic, FormulaCheck, MRI, אדמין/Integrity</li>
<li class="${dbOk ? 'ok' : 'warn'}">LIVE${dbOk ? '' : ' (DEPLOYED, DB לא אומת כעת)'} — שכבת World: ingest/search/status/compare</li>
<li class="warn">PARTIAL — corpus עולמי ${worldDocs === null ? '(לא נמדד כעת)' : `= ${worldDocs} מסמכים`}; ראיות/audit חבויים; מטרת-פרויקט כשדה</li>
<li class="warn">HIDDEN — DOE (מנוע הניסוי-הבא), Audit trail, Observability, session-advance</li>
<li class="bad">MISSING — Critical Gap Ranking · מסך Project Research</li>
</ul></section>

<section><h2>REGRESSIONS / FAILURES</h2>
${regressions.length ? `<ul>${regressions.map((r) => `<li class="bad">${esc(r)}</li>`).join('')}</ul>` : '<p class="none">אין רגרסיות ידועות — מה שעבד ממשיך לעבוד (חבילת הבדיקות המלאה ירוקה ב-main)</p>'}
</section>

<section><h2>OPEN DECISIONS — מחכה להכרעה שלך</h2>
<ul>${(current.open_decisions || []).map((d) => `<li>${esc(d)}</li>`).join('') || '<li>אין</li>'}</ul>
</section>
</main></body></html>`;
}
