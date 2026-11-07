// Stop hook: run fast tests when Claude says it is done.
// Cross-platform (plain Node). Fails OPEN on any problem except a real test failure.
// Exit 0 = let Claude stop. Exit 2 = block the stop and feed stderr back to Claude.
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import { setTimeout, clearTimeout } from 'node:timers';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const TIMEOUT_MS = Number(process.env.EQFIT_STOP_TIMEOUT_MS || 90_000);
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function allow(msg) {
  if (msg) console.error(`[stop-tests] ${msg}`);
  process.exit(0);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('error', () => allow('could not read hook input; not checking.'));
process.stdin.on('end', run);
// If nothing is piped, do not hang forever.
setTimeout(() => { if (!input) run(); }, 2000).unref();

let started = false;
function run() {
  if (started) return;
  started = true;
  let data = {};
  try { data = input ? JSON.parse(input) : {}; } catch { /* ignore */ }

  // Loop guard: if Claude is already continuing because of this hook, let it stop.
  if (data.stop_hook_active === true) allow();

  if (!existsSync(join(root, 'node_modules'))) {
    allow('node_modules missing, tests NOT run (run `npm ci` after asking the user). This is not a pass.');
  }

  const isWin = process.platform === 'win32';
  const child = spawn('npm', ['test', '--silent'], {
    cwd: root,
    shell: isWin, // npm is npm.cmd on Windows
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWin,
  });

  let out = '';
  const keep = (c) => { out += c; if (out.length > 200_000) out = out.slice(-100_000); };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else process.kill(-child.pid, 'SIGKILL');
    } catch { /* already gone */ }
  }, TIMEOUT_MS);

  child.on('error', () => { clearTimeout(timer); allow('could not start npm; tests NOT run.'); });
  child.on('close', (code) => {
    clearTimeout(timer);
    if (timedOut) allow(`tests timed out after ${TIMEOUT_MS / 1000}s; NOT verified.`);
    if (code === 0) allow();
    const tail = out.trim().split(/\r?\n/).slice(-30).join('\n');
    console.error(`[stop-tests] npm test FAILED (exit ${code}). Fix it before finishing.\n${tail}`);
    process.exit(2);
  });
}
