/**
 * Verify Ask Matriya can answer project/material ownership questions.
 *
 * Usage:
 *   set MATRIYA_TEST_API_URL=http://127.0.0.1:8000
 *   set MATRIYA_TEST_JWT=<optional existing token>
 *   node scripts/verify-ask-matriya-project-materials.mjs
 *
 * If MATRIYA_TEST_JWT is missing, the script auto-signs up a temp user.
 */
import assert from 'node:assert/strict';

const base = (process.env.MATRIYA_TEST_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const providedToken = String(process.env.MATRIYA_TEST_JWT || '').trim();

async function getToken() {
  if (providedToken) return providedToken;
  const nonce = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const username = `ask_meta_${nonce}`;
  const email = `${username}@example.com`;
  const password = `T3st!${nonce}`;
  const signupRes = await fetch(`${base}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      password,
      full_name: 'Ask Metadata Test User'
    })
  });
  const text = await signupRes.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch (_) {}
  if (!signupRes.ok || !payload?.access_token) {
    throw new Error(`failed to signup temp user: HTTP ${signupRes.status} ${text}`);
  }
  return String(payload.access_token);
}

function hasNoRelevantMessage(reply) {
  const text = String(reply || '').trim();
  return /אין מידע רלוונטי במסמכים שנבחרו|no relevant information was found in the selected documents/i.test(text);
}

function looksLikeProjectMaterialAnswer(data) {
  if (!data || typeof data !== 'object') return false;
  const mode = String(data.mode || '').toLowerCase();
  if (mode === 'all_files_project_metadata') return true;

  const sources = Array.isArray(data.sources) ? data.sources : [];
  if (sources.some((s) => /project metadata/i.test(String(s?.filename || '')))) return true;

  const reply = String(data.reply || '').toLowerCase();
  if (reply.includes('material') && reply.includes('project')) return true;
  if (reply.includes('חומר') && reply.includes('פרויקט')) return true;
  if (reply.includes('all projects') || reply.includes('כל הפרויקטים')) return true;
  return false;
}

async function run() {
  console.log('=== verify ask-matriya project/material ownership ===');
  console.log(`API: ${base}`);
  const token = await getToken();

  const question = 'what materials belong to which project?';
  const res = await fetch(`${base}/ask-matriya`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: question,
      all_files: true
    })
  });
  const raw = await res.text();
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (_) {
    throw new Error(`non-JSON response: HTTP ${res.status} ${raw}`);
  }

  assert.equal(res.status, 200, `expected HTTP 200, got ${res.status}: ${raw}`);
  assert.ok(String(data.reply || '').trim().length > 0, `expected non-empty reply: ${raw}`);
  assert.equal(hasNoRelevantMessage(data.reply), false, `got "no relevant info" reply: ${raw}`);
  assert.ok(
    looksLikeProjectMaterialAnswer(data),
    `reply did not look project/material-grounded. response=${JSON.stringify(data, null, 2)}`
  );

  console.log('PASS: Ask Matriya answered project/material ownership question.');
  console.log(`mode=${data.mode || '(none)'}`);
  if (Array.isArray(data.sources)) {
    console.log(`sources=${data.sources.length}`);
  }
}

run().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});

