/**
 * Verify Ask Matriya can answer from a specific Excel file.
 *
 * Usage:
 *   set MATRIYA_TEST_API_URL=http://127.0.0.1:8003
 *   set MATRIYA_TEST_JWT=<optional existing token>
 *   node scripts/verify-ask-matriya-excel-file.mjs
 */
import assert from 'node:assert/strict';

const base = (process.env.MATRIYA_TEST_API_URL || 'http://127.0.0.1:8003').replace(/\/$/, '');
const providedToken = String(process.env.MATRIYA_TEST_JWT || '').trim();
const targetFilename = 'צבעים סיליקטים (1).xlsx';
const question = `מה הכמות של PAW-E בקובץ ${targetFilename}?`;

async function getToken() {
  if (providedToken) return providedToken;
  const nonce = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const username = `ask_excel_${nonce}`;
  const email = `${username}@example.com`;
  const password = `T3st!${nonce}`;
  const signupRes = await fetch(`${base}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      password,
      full_name: 'Ask Excel Verify User'
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

function isNoRelevantReply(reply) {
  return /אין מידע רלוונטי במסמכים שנבחרו|לא כולל מידע|No relevant information|cannot answer/i.test(String(reply || ''));
}

function hasTargetFileInSources(sources) {
  const arr = Array.isArray(sources) ? sources : [];
  return arr.some((s) => String(s?.filename || s?.document_name || '').includes(targetFilename));
}

async function run() {
  console.log('=== verify ask-matriya excel file answer ===');
  console.log(`API: ${base}`);
  console.log(`file: ${targetFilename}`);
  const token = await getToken();

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
  assert.equal(isNoRelevantReply(data.reply), false, `got no-relevant style reply: ${raw}`);
  assert.ok(
    hasTargetFileInSources(data.sources),
    `expected sources to include ${targetFilename}. sources=${JSON.stringify(data.sources || [], null, 2)}`
  );

  console.log('PASS: Ask Matriya answered from the target Excel file.');
  console.log(`mode=${data.mode || '(none)'}`);
  console.log(`reply=${String(data.reply || '').slice(0, 240)}...`);
}

run().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});

