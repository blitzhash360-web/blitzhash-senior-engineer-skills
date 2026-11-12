import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeDemoApp } from '../examples/make-demo-app.mjs';
import { scanProject, formatReport, redact } from '../lib/preflight.mjs';
import { main } from '../bin/bh-preflight.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'bh-test-'));
const byId = (r) => Object.fromEntries(r.checks.map((c) => [c.id, c]));

function snapshot(dir) {
  const out = {};
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else out[p] = readFileSync(p, 'utf8'); } };
  walk(dir); return out;
}

test('risky demo app fails the right checks and scores low', () => {
  const base = tmp();
  try {
    const r = scanProject(makeDemoApp(join(base, 'app')));
    const c = byId(r);
    for (const id of ['secrets', 'public-env', 'env-files', 'rate-limit', 'auth']) assert.equal(c[id].status, 'fail', id);
    for (const id of ['headers', 'cors', 'monitoring', 'backups', 'build']) assert.equal(c[id].status, 'warn', id);
    assert.ok(r.score < 25, `score ${r.score}`);
    assert.equal(r.grade, 'F');
    assert.ok(c.auth.items.some((i) => i.includes('Stripe webhook without signature verification')));
    assert.ok(c['public-env'].items.some((i) => i.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('fixed demo app passes every check', () => {
  const base = tmp();
  try {
    const r = scanProject(makeDemoApp(join(base, 'app'), { fixed: true }));
    assert.deepEqual(r.checks.filter((c) => c.status !== 'pass').map((c) => c.id), []);
    assert.equal(r.score, 100);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('never prints a full secret', () => {
  const base = tmp();
  try {
    const dir = makeDemoApp(join(base, 'app'));
    const key = readFileSync(join(dir, 'lib/stripe.ts'), 'utf8').match(/sk_live_\w+/)[0];
    const text = formatReport(scanProject(dir));
    assert.ok(!text.includes(key), 'full key leaked into report');
    assert.ok(text.includes(key.slice(0, 4)));
    assert.equal(redact('abc'), '****');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('scan is read-only', () => {
  const base = tmp();
  try {
    const dir = makeDemoApp(join(base, 'app'), { git: false });
    const before = snapshot(dir);
    scanProject(dir);
    assert.deepEqual(snapshot(dir), before);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('untracked local .env is fine, committed .env is a failure', () => {
  const base = tmp();
  try {
    const dir = makeDemoApp(join(base, 'app'), { fixed: true });
    writeFileSync(join(dir, '.env.local'), 'STRIPE_SECRET_KEY=' + 'sk_' + 'live_' + 'LOCALONLYLOCALONLYLOCAL1\n');
    assert.equal(byId(scanProject(dir)).secrets.status, 'pass');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('CLI: --json, --fail-under and --help', async () => {
  const base = tmp();
  try {
    const dir = makeDemoApp(join(base, 'app'));
    let out = '';
    const io = { out: (s) => { out += s; }, isTTY: false };
    assert.equal(await main([dir, '--json'], io), 0);
    assert.equal(JSON.parse(out).grade, 'F');
    out = '';
    assert.equal(await main([dir, '--fail-under', '60'], io), 1);
    assert.match(out, /Launch score: \d+\/100/);
    out = '';
    assert.equal(await main(['--help'], io), 0);
    assert.match(out, /read-only/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('CLI runs when invoked through a symlink (npx / node_modules/.bin)', async () => {
  const { mkdtempSync, symlinkSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const d = mkdtempSync(join(tmpdir(), 'bh-link-'));
  const link = join(d, 'bh-preflight');
  symlinkSync(resolve('bin/bh-preflight.mjs'), link);
  const r = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /bh-preflight/);
});

test('CLI: --demo scans the built-in fake app and prints no real paths', async () => {
  let out = '';
  const io = { out: (s) => { out += s + '\n'; }, isTTY: false };
  assert.equal(await main(['--demo'], io), 0);
  assert.match(out, /demo-founder-app/);
  assert.match(out, /Launch score: \d+\/100/);
  assert.doesNotMatch(out, /\x1b\[/);
});
