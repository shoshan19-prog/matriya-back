import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseEnvPort(envPath) {
  if (!existsSync(envPath)) return null;
  try {
    const txt = readFileSync(envPath, 'utf8');
    const line = txt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith('API_PORT='));
    if (!line) return null;
    const v = Number(line.slice('API_PORT='.length).trim());
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function resolvePort() {
  const fromEnv = Number(process.env.API_PORT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  const fromDotEnv = parseEnvPort(path.resolve(process.cwd(), '.env'));
  if (Number.isFinite(fromDotEnv) && fromDotEnv > 0) return fromDotEnv;
  return 8000;
}

function runCmd(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += String(d)));
    p.stderr.on('data', (d) => (stderr += String(d)));
    p.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    p.on('error', () => resolve({ code: 1, stdout: '', stderr: '' }));
  });
}

async function killPortWindows(port) {
  const out = await runCmd('netstat', ['-ano', '-p', 'tcp']);
  if (out.code !== 0) return;
  const lines = out.stdout.split(/\r?\n/);
  const pids = new Set();
  for (const line of lines) {
    if (!line.includes(`:${port}`) || !/LISTENING/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[parts.length - 1]);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }
  for (const pid of pids) {
    await runCmd('taskkill', ['/PID', String(pid), '/F']);
  }
}

async function killPortUnix(port) {
  const out = await runCmd('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']);
  if (out.code !== 0) return;
  const pids = out.stdout
    .split(/\r?\n/)
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // ignore
    }
  }
}

async function freePort(port) {
  if (process.platform === 'win32') return killPortWindows(port);
  return killPortUnix(port);
}

async function killChildTree(childPid) {
  if (!Number.isFinite(childPid) || childPid <= 0) return;
  if (process.platform === 'win32') {
    await runCmd('taskkill', ['/PID', String(childPid), '/T', '/F']);
    return;
  }
  try {
    process.kill(-childPid, 'SIGKILL');
  } catch {
    try {
      process.kill(childPid, 'SIGKILL');
    } catch {
      // ignore
    }
  }
}

async function main() {
  const port = resolvePort();
  await freePort(port);
  const child = spawn(process.execPath, ['--watch', 'server.js'], { stdio: 'inherit', detached: process.platform !== 'win32' });
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await killChildTree(child.pid);
    process.exit(0);
  };
  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

main();
