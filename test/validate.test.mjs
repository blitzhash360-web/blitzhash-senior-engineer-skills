import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (root) => spawnSync(process.execPath, [join(ROOT, 'scripts/validate-skills.mjs')], { env: { ...process.env, BH_ROOT: root }, encoding: 'utf8' });

function copy() {
  const d = mkdtempSync(join(tmpdir(), 'bh-val-'));
  for (const p of ['skills', 'agents', 'commands', 'README.md']) cpSync(join(ROOT, p), join(d, p), { recursive: true });
  return d;
}

test('repo skills, agents and commands validate', () => {
  const r = run(ROOT);
  assert.equal(r.status, 0, r.stderr);
});

test('validator rejects broken skills', () => {
  const cases = [
    [(t) => t.replace(/^name: .*$/m, 'name: Wrong_Name'), /must equal folder name/],
    [(t) => t.replace(/^description: /m, 'description: Oops: '), /contains ": "/],
    [(t) => t.replace(/explicit "yes"/g, 'ok'), /explicit confirmation/],
    [(t) => t.replace('## Safety rules (always)', '## Notes'), /missing section "## Safety rules"/],
    [(t) => t + '\nWe offer ' + '24' + '/7 support.\n', /banned claim/],
    [(t) => t.replace('origin: BlitzHash', 'origin: ECC'), /metadata.origin must be BlitzHash/],
  ];
  for (const [mutate, expected] of cases) {
    const d = copy();
    try {
      const f = join(d, 'skills/launch-readiness-audit/SKILL.md');
      writeFileSync(f, mutate(readFileSync(f, 'utf8')));
      const r = run(d);
      assert.equal(r.status, 1, `expected failure for ${expected}`);
      assert.match(r.stderr, expected);
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
});
