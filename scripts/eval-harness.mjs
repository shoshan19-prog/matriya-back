#!/usr/bin/env node
/**
 * Eval Harness — בדיקת רגרסיה לאיכות תשובות MATRIYA.
 *
 * מריץ סט שאלות מוגדר מראש מול GET /search, מסווג כל תשובה (grounded / insufficient /
 * locked / error), משווה לציפייה שהוגדרה ב-eval-cases.json, ומשווה ל-baseline של ריצה
 * קודמת כדי לזהות *רגרסיות* (תשובה שהיתה מעוגנת והפכה לחסרת-עדות, או להפך).
 *
 * זה מאחד את רוח הבדיקות הקיימות (check:retrieval-threshold, check:answer-binding,
 * controlled-comparison) ל"כפתור" אחד עם דוח קריא.
 *
 * שימוש (כשהשרת רץ):
 *   node scripts/eval-harness.mjs                      # מריץ ומשווה ל-baseline
 *   node scripts/eval-harness.mjs --update-baseline    # שומר את התוצאות כ-baseline חדש
 *   node scripts/eval-harness.mjs --cases path.json    # קובץ cases מותאם
 *   node scripts/eval-harness.mjs --json               # פלט JSON גולמי
 *
 * משתני סביבה:
 *   BASE_URL  (ברירת מחדל http://localhost:8000)
 *
 * קודי יציאה: 0 = הכל עבר ואין רגרסיות · 1 = שגיאת ריצה · 2 = כשלים / רגרסיות נמצאו
 */
import http from 'http';
import https from 'https';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const updateBaseline = args.includes('--update-baseline');
const casesIdx = args.indexOf('--cases');
const casesPath = casesIdx >= 0 ? args[casesIdx + 1] : join(here, 'eval-cases.json');
const baselinePath = join(here, 'eval-baseline.json');

function request(method, path, options = {}) {
  const url = new URL(path, BASE_URL);
  const isHttps = url.protocol === 'https:';
  const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;
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
    req.setTimeout(30000, () => req.destroy(new Error(`Timeout calling ${path}`)));
    if (body) req.write(body);
    req.end();
  });
}

/** ממפה תשובת /search לקטגוריה אחת מנורמלת. */
function classify({ status, json }) {
  if (json?.research_gate_locked || status === 409) return 'locked';
  if (status === 200) {
    const hasAnswer = !!json?.answer;
    const hasSources = Array.isArray(json?.sources) && json.sources.length > 0;
    if (hasAnswer && hasSources) return 'grounded';
    return 'insufficient'; // 200 ללא מקורות = לא באמת מעוגן
  }
  if (status === 422 || json?.error === 'INSUFFICIENT_EVIDENCE' || json?.status === 'INSUFFICIENT_EVIDENCE') {
    return 'insufficient';
  }
  return 'error';
}

async function runCase(c) {
  const q = encodeURIComponent(c.query);
  const sid = c.session_id ? `&session_id=${encodeURIComponent(c.session_id)}` : '';
  const path = `/search?query=${q}&generate_answer=true&flow=document${sid}`;
  let resp;
  try {
    resp = await request('GET', path);
  } catch (e) {
    return { name: c.name, query: c.query, expect: c.expect, actual: 'error', http: 0, sources: 0, detail: e.message };
  }
  const actual = classify(resp);
  return {
    name: c.name,
    query: c.query,
    expect: c.expect || null,
    actual,
    http: resp.status,
    sources: Array.isArray(resp.json?.sources) ? resp.json.sources.length : 0
  };
}

function loadCases() {
  if (!existsSync(casesPath)) throw new Error(`Cases file not found: ${casesPath}`);
  const parsed = JSON.parse(readFileSync(casesPath, 'utf8'));
  const cases = Array.isArray(parsed) ? parsed : parsed.cases;
  if (!Array.isArray(cases) || !cases.length) throw new Error('No cases found in cases file.');
  return cases.filter((c) => c && c.query);
}

function loadBaseline() {
  if (!existsSync(baselinePath)) return null;
  try { return JSON.parse(readFileSync(baselinePath, 'utf8')); } catch { return null; }
}

function render(report) {
  const L = [];
  L.push('# ✅ MATRIYA — Eval Harness');
  L.push('');
  L.push(`נבדקו ${report.total} cases · עברו ${report.passed} · נכשלו ${report.failed} · רגרסיות ${report.regressions}`);
  L.push('');
  L.push('| case | ציפייה | בפועל | מקורות | תוצאה | שינוי מ-baseline |');
  L.push('|------|--------|-------|--------|-------|------------------|');
  for (const r of report.results) {
    const passIcon = r.expect ? (r.pass ? '✅' : '❌') : '➖';
    let drift = '—';
    if (r.baseline && r.baseline !== r.actual) drift = `⚠️ ${r.baseline} → ${r.actual}`;
    else if (r.baseline) drift = 'יציב';
    L.push(`| ${r.name} | ${r.expect || '—'} | ${r.actual} | ${r.sources} | ${passIcon} | ${drift} |`);
  }
  L.push('');
  if (report.regressions > 0) {
    L.push('## ⚠️ רגרסיות');
    report.results.filter((r) => r.regression).forEach((r) =>
      L.push(`- **${r.name}**: ${r.baseline} → ${r.actual} (שאלה: "${r.query}")`));
    L.push('');
  }
  return L.join('\n');
}

async function main() {
  let cases;
  try { cases = loadCases(); } catch (e) { console.error(`[eval-harness] ${e.message}`); process.exit(1); }

  const baseline = loadBaseline();
  const baselineMap = new Map((baseline?.results || []).map((r) => [r.name, r.actual]));

  const results = [];
  for (const c of cases) {
    const r = await runCase(c);
    r.pass = r.expect ? r.actual === r.expect : true;
    r.baseline = baselineMap.get(r.name) || null;
    r.regression = !!(r.baseline && r.baseline !== r.actual);
    results.push(r);
  }

  const anyError = results.some((r) => r.actual === 'error');
  if (anyError && results.every((r) => r.actual === 'error')) {
    console.error('[eval-harness] כל ה-cases החזירו error — כנראה השרת לא רץ. הריצו `npm run dev`.');
    process.exit(1);
  }

  const report = {
    base_url: BASE_URL,
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    regressions: results.filter((r) => r.regression).length,
    results
  };

  if (wantJson) console.log(JSON.stringify(report, null, 2));
  else console.log(render(report));

  if (updateBaseline) {
    writeFileSync(baselinePath, JSON.stringify(
      { results: results.map((r) => ({ name: r.name, actual: r.actual, sources: r.sources })) },
      null, 2
    ) + '\n', 'utf8');
    console.log(`[eval-harness] baseline עודכן: ${baselinePath}`);
  }

  process.exit(report.failed === 0 && report.regressions === 0 ? 0 : 2);
}

main();
