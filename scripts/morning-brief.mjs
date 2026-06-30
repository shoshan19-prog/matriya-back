#!/usr/bin/env node
/**
 * Morning Brief — דוח בוקר על בריאות מערכת MATRIYA.
 *
 * אוסף במכה אחת את מצב המערכת מתוך ה-endpoints הקיימים ומפיק סיכום קריא בעברית:
 *   - GET /health                         → סטטוס, מסד וקטורי, latency p50/p99, שגיאות
 *   - GET /admin/recovery/violations      → violations פעילים (שערים נעולים)
 *   - GET /admin/reports/value-summary    → ריצות מחקר, hard stops, recoveries, סוגי violations
 *
 * שימוש (כשהשרת רץ):
 *   node scripts/morning-brief.mjs                # הדפסה ל-stdout
 *   node scripts/morning-brief.mjs --out brief.md # שמירה גם כקובץ Markdown
 *   node scripts/morning-brief.mjs --json         # פלט JSON גולמי (לאוטומציה / לשליחה במייל)
 *
 * משתני סביבה:
 *   BASE_URL        (ברירת מחדל http://localhost:8000)
 *   ADMIN_USERNAME  (ברירת מחדל admin)
 *   ADMIN_PASSWORD  (ברירת מחדל admin123)
 *
 * קודי יציאה: 0 = הכל תקין · 1 = שגיאת ריצה · 2 = נמצאו התראות (violations פעילים / לא בריא)
 */
import http from 'http';
import https from 'https';
import { writeFileSync } from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;

// ספי התראה (ניתן לכוונון דרך סביבה)
const P99_WARN_MS = parseInt(process.env.BRIEF_P99_WARN_MS, 10) || 3000;
const ERROR_RATE_WARN = parseFloat(process.env.BRIEF_ERROR_RATE_WARN) || 0.05;

function request(method, path, options = {}) {
  const url = new URL(path, BASE_URL);
  const isHttps = url.protocol === 'https:';
  const body = options.body !== undefined
    ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    : undefined;
  const headers = { ...(body && { 'Content-Type': 'application/json' }), ...options.headers };
  if (body && headers['Content-Type']) headers['Content-Length'] = Buffer.byteLength(body);

  return new Promise((resolve, reject) => {
    const req = (isHttps ? https : http).request(
      url,
      { method, headers, rejectUnauthorized: false },
      (res) => {
        let data = '';
        res.on('data', (ch) => (data += ch));
        res.on('end', () => {
          let json = {};
          try { json = data ? JSON.parse(data) : {}; } catch { json = { _raw: data }; }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error(`Timeout calling ${path}`)));
    if (body) req.write(body);
    req.end();
  });
}

async function login() {
  const { status, json } = await request('POST', '/auth/login', {
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  });
  if (status >= 400 || !json.access_token) {
    throw new Error(`Admin login failed (HTTP ${status}). Set ADMIN_USERNAME/ADMIN_PASSWORD.`);
  }
  return json.access_token;
}

async function collect() {
  const health = await request('GET', '/health').catch((e) => ({ status: 0, json: { error: e.message } }));

  let token = null;
  let loginError = null;
  try { token = await login(); } catch (e) { loginError = e.message; }

  const auth = token ? { headers: { Authorization: `Bearer ${token}` } } : null;

  let violations = { status: 0, json: { violations: [], count: 0 } };
  let valueSummary = { status: 0, json: {} };
  if (auth) {
    violations = await request('GET', '/admin/recovery/violations?active_only=true&limit=50', auth)
      .catch((e) => ({ status: 0, json: { error: e.message, violations: [] } }));
    valueSummary = await request('GET', '/admin/reports/value-summary', auth)
      .catch((e) => ({ status: 0, json: { error: e.message } }));
  }

  return { health, violations, valueSummary, loginError };
}

function buildModel({ health, violations, valueSummary, loginError }) {
  const h = health.json || {};
  const m = h.metrics || {};
  const totalReq = m.total_requests ?? 0;
  const totalErr = m.total_errors ?? 0;
  const errorRate = totalReq > 0 ? totalErr / totalReq : 0;

  const activeViolations = violations.json?.violations || [];
  const v = valueSummary.json || {};

  const alerts = [];
  if (health.status !== 200 || h.status !== 'healthy') {
    alerts.push(`מצב /health אינו תקין (HTTP ${health.status}, status="${h.status || 'unknown'}")`);
  }
  if (loginError) alerts.push(`לא ניתן להתחבר כאדמין — חלק מהנתונים חסר (${loginError})`);
  if (activeViolations.length > 0) alerts.push(`${activeViolations.length} שער/ים נעול/ים (violations פעילים)`);
  if (errorRate > ERROR_RATE_WARN) alerts.push(`שיעור שגיאות גבוה: ${(errorRate * 100).toFixed(1)}%`);
  if (typeof m.latency_p99_ms === 'number' && m.latency_p99_ms > P99_WARN_MS) {
    alerts.push(`latency p99 גבוה: ${m.latency_p99_ms}ms (סף ${P99_WARN_MS}ms)`);
  }

  return {
    healthy: alerts.length === 0,
    health: {
      status: h.status || 'unknown',
      http: health.status,
      documents: h.vector_db?.document_count ?? h.vector_db?.count ?? null,
      collection: h.collection_name ?? null,
      total_requests: totalReq,
      total_errors: totalErr,
      error_rate: errorRate,
      latency_p50_ms: m.latency_p50_ms ?? null,
      latency_p99_ms: m.latency_p99_ms ?? null
    },
    active_violations: activeViolations.map((x) => ({
      id: x.id, session_id: x.session_id, reason: x.reason || x.type, created_at: x.created_at
    })),
    research: {
      runs_total: v.runs?.total ?? 0,
      runs_successful: v.runs?.successful ?? 0,
      runs_stopped: v.runs?.stopped_by_violation ?? 0,
      recoveries: v.recoveries?.total_resolved ?? 0,
      violations_by_reason: v.violations_by_reason || {}
    },
    alerts
  };
}

function fmtMs(x) { return x === null || x === undefined ? '—' : `${x}ms`; }

function render(model) {
  const L = [];
  L.push('# ☀️ MATRIYA — דוח בוקר');
  L.push('');
  L.push(model.healthy ? '**מצב כללי: ✅ תקין**' : `**מצב כללי: ⚠️ דורש תשומת לב (${model.alerts.length} התראות)**`);
  L.push('');

  if (model.alerts.length) {
    L.push('## ⚠️ התראות');
    model.alerts.forEach((a) => L.push(`- ${a}`));
    L.push('');
  }

  const hs = model.health;
  L.push('## 🩺 בריאות המערכת');
  L.push(`- סטטוס: ${hs.status} (HTTP ${hs.http})`);
  L.push(`- מסמכים במסד הווקטורי: ${hs.documents ?? '—'}${hs.collection ? ` (collection: ${hs.collection})` : ''}`);
  L.push(`- בקשות: ${hs.total_requests} · שגיאות: ${hs.total_errors} (${(hs.error_rate * 100).toFixed(1)}%)`);
  L.push(`- latency: p50 ${fmtMs(hs.latency_p50_ms)} · p99 ${fmtMs(hs.latency_p99_ms)}`);
  L.push('');

  L.push('## 🔒 שערים נעולים (violations פעילים)');
  if (!model.active_violations.length) {
    L.push('- אין — כל השערים פתוחים ✅');
  } else {
    model.active_violations.forEach((x) =>
      L.push(`- \`${x.reason}\` · session ${x.session_id} · id ${x.id}${x.created_at ? ` · ${x.created_at}` : ''}`));
  }
  L.push('');

  const r = model.research;
  L.push('## 🔬 ריצות מחקר (Governance)');
  L.push(`- ריצות: ${r.runs_total} · בהצלחה: ${r.runs_successful} · נעצרו ב-Hard Stop: ${r.runs_stopped}`);
  L.push(`- שחרורים (Recovery): ${r.recoveries}`);
  const reasons = Object.entries(r.violations_by_reason);
  if (reasons.length) {
    L.push('- Violations לפי סוג:');
    reasons.forEach(([k, val]) => L.push(`  - ${k}: ${val}`));
  }
  L.push('');
  return L.join('\n');
}

async function main() {
  let data;
  try {
    data = await collect();
  } catch (e) {
    console.error(`[morning-brief] נכשל: ${e.message}`);
    console.error('[morning-brief] ודאו שהשרת רץ (npm run dev) וש-BASE_URL נכון.');
    process.exit(1);
  }

  const model = buildModel(data);

  if (wantJson) {
    console.log(JSON.stringify(model, null, 2));
  } else {
    const text = render(model);
    console.log(text);
    if (outFile) {
      writeFileSync(outFile, text + '\n', 'utf8');
      console.log(`\n[morning-brief] נשמר אל ${outFile}`);
    }
  }

  process.exit(model.healthy ? 0 : 2);
}

main();
