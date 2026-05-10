/**
 * Smoke check for MATRIYA-LITE (`matriya` CLI) — runs without a database.
 *
 * Verifies the help text, an unknown command, and that a data command fails
 * *honestly* (exit 3, clear message) rather than crashing, when no DB env is
 * set. Wire into CI with: npm run check:matriya-lite
 */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'cli', 'matriya.js');

function run(args, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
}

let failures = 0;
function check(name, ok, extra = '') {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

// 1. --help: exit 0, states the principle, lists the commands.
{
  const r = run(['--help']);
  check('help exits 0', r.status === 0, `status=${r.status}`);
  check('help states the principle', /visibility without false authority/i.test(r.stdout));
  check('help lists `reality probe`', /reality probe/.test(r.stdout));
  check(
    'help lists all five core commands',
    ['reality status', 'task list', 'friction by-category', 'debt list', 'review week'].every((c) => r.stdout.includes(c))
  );
}

// 2. unknown command: exit 2, prints usage.
{
  const r = run(['totally-bogus']);
  check('unknown command exits 2', r.status === 2, `status=${r.status}`);
  check('unknown command shows usage', /Usage:\s+matriya/.test(`${r.stdout}${r.stderr}`));
}

// 3. a data command with no DB env: must fail honestly (exit 3), not crash.
{
  const r = run(['reality', 'status'], { POSTGRES_URL: '', POSTGRES_PRISMA_URL: '', SUPABASE_DB_URL: '' });
  check('no-DB data command exits 3 (honest "nothing to show")', r.status === 3, `status=${r.status}`);
  check('no-DB message is explanatory', /nothing to show/i.test(r.stderr));
}

if (failures) {
  console.error(`\nMATRIYA-LITE smoke check: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nMATRIYA-LITE smoke check: all good.');
