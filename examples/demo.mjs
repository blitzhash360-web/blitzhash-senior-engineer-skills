#!/usr/bin/env node
// npm run demo (or bh-preflight --demo): builds a fake risky app and a fixed copy in a temp folder, then scans both.
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeDemoApp } from './make-demo-app.mjs';
import { scanProject, formatReport } from '../lib/preflight.mjs';

export function runDemo(out = console.log, color = process.stdout.isTTY) {
  const base = mkdtempSync(join(tmpdir(), 'bh-demo-'));
  try {
    const risky = makeDemoApp(join(base, 'demo-founder-app'));
    const fixed = makeDemoApp(join(base, 'demo-founder-app-fixed'), { fixed: true });
    out('$ bh-preflight ./demo-founder-app   (fake app, fake keys)\n');
    out(formatReport(scanProject(risky), { color, name: 'demo-founder-app' }));
    const r = scanProject(fixed);
    out(`\n$ bh-preflight ./demo-founder-app-fixed\n...\nLaunch score: ${r.score}/100 (${r.grade}). ${r.counts.fail} fail, ${r.counts.warn} warn, ${r.counts.pass} pass.`);
  } finally { rmSync(base, { recursive: true, force: true }); }
}

const isEntry = (() => {
  try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (isEntry) runDemo();
