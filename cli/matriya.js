#!/usr/bin/env node
/**
 * MATRIYA-LITE — the `matriya` CLI ("M-lite.1").
 *
 * Five read-only views plus a probe. The whole point: surface where to look —
 * what is still unverified, where things are stuck, where friction piled up,
 * what debt is parked — without pretending to know what any of it means, or
 * what to do about it. Visibility without false authority. It never writes.
 *
 *   matriya reality status        what is still UNVERIFIED in the universe
 *   matriya reality probe         map of the dark areas (no evidence)
 *   matriya task list --blocked   where things are stuck
 *   matriya friction by-category  where friction accumulated
 *   matriya debt list --open      what open debt is parked
 *   matriya review week           last 7d, in numbers + where to look
 *
 *   --json   emit JSON      -h / --help   this text
 */

const USAGE = `MATRIYA-LITE — visibility without false authority (נראות בלי סמכות מדומה)

Usage:  matriya <command> [options]

Commands:
  reality status            What is still UNVERIFIED in the universe (the K→C→B→N→L pass).
  reality probe             A map of the dark areas — where the system has no evidence to show you.
  task list [--blocked]     Where things are stuck. --blocked = hard-blocked (open violation) only.
  friction by-category      Where friction accumulated — violations grouped by the rule that fired.
  debt list [--open|--all]  What open debt is parked. --open is the default; --all also shows resolved.
  review week               The last 7 days, in numbers, plus where the system suggests you look.

Options:
  --json                    Emit JSON instead of text.
  -h, --help                Show this help.

Every output is an indicator, not a verdict: the system shows where to look,
it does not decide what it means or what to do. The reading is yours.
`;

function has(args, ...names) {
  return names.some((n) => args.includes(n));
}

/** database.js prints a couple of INFO lines via console.log on import; mute during load so our stdout stays clean. */
async function loadModules() {
  const original = console.log;
  console.log = () => {};
  try {
    const [rs, rp, tl, fc, dl, rw, src] = await Promise.all([
      import('./commands/realityStatus.js'),
      import('./commands/realityProbe.js'),
      import('./commands/taskList.js'),
      import('./commands/frictionByCategory.js'),
      import('./commands/debtList.js'),
      import('./commands/reviewWeek.js'),
      import('./lib/source.js')
    ]);
    return {
      realityStatus: rs.realityStatus,
      realityProbe: rp.realityProbe,
      taskList: tl.taskList,
      frictionByCategory: fc.frictionByCategory,
      debtList: dl.debtList,
      reviewWeek: rw.reviewWeek,
      DataUnavailable: src.DataUnavailable
    };
  } finally {
    console.log = original;
  }
}

const ALIASES = {
  reality: 'reality status',
  status: 'reality status',
  probe: 'reality probe',
  task: 'task list',
  tasks: 'task list',
  friction: 'friction by-category',
  debt: 'debt list',
  review: 'review week'
};
const KNOWN = new Set([
  'reality status',
  'reality probe',
  'task list',
  'friction by-category',
  'debt list',
  'review week'
]);

function resolveCommand(positional) {
  const two = positional.slice(0, 2).join(' ');
  if (KNOWN.has(two)) return two;
  const one = positional[0] || '';
  if (ALIASES[one]) return ALIASES[one];
  return null;
}

async function main(argv) {
  const args = argv.slice(2);
  if (!args.length || has(args, '-h', '--help', 'help')) {
    process.stdout.write(USAGE);
    return 0;
  }
  const json = has(args, '--json');
  const positional = args.filter((a) => !a.startsWith('-'));
  const cmd = resolveCommand(positional);
  if (!cmd) {
    process.stderr.write(`matriya: unknown command "${positional.join(' ') || args.join(' ')}"\n\n${USAGE}`);
    return 2;
  }

  const m = await loadModules();
  let out;
  try {
    switch (cmd) {
      case 'reality status':
        out = await m.realityStatus({ json });
        break;
      case 'reality probe':
        out = await m.realityProbe({ json });
        break;
      case 'task list':
        out = await m.taskList({ json, blockedOnly: has(args, '--blocked') });
        break;
      case 'friction by-category':
        out = await m.frictionByCategory({ json });
        break;
      case 'debt list':
        out = await m.debtList({ json, includeResolved: has(args, '--all') });
        break;
      case 'review week':
        out = await m.reviewWeek({ json });
        break;
    }
  } catch (err) {
    if (err instanceof m.DataUnavailable) {
      process.stderr.write(
        `matriya: nothing to show — ${err.message}.\n` +
          `That is the honest answer, not a hidden failure. Configure the DB the API uses and retry.\n`
      );
      return 3;
    }
    throw err;
  }
  process.stdout.write(out.endsWith('\n') ? out : `${out}\n`);
  return 0;
}

main(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`matriya: ${err && err.stack ? err.stack : err}\n`);
    process.exitCode = 1;
  });
