#!/usr/bin/env node
// npm run demo: builds a fake risky app and a fixed copy in a temp folder, then scans both.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeDemoApp } from './make-demo-app.mjs';
import { scanProject, formatReport } from '../lib/preflight.mjs';

const base = mkdtempSync(join(tmpdir(), 'bh-demo-'));
try {
  const risky = makeDemoApp(join(base, 'demo-founder-app'));
  const fixed = makeDemoApp(join(base, 'demo-founder-app-fixed'), { fixed: true });
  console.log('$ bh-preflight ./demo-founder-app   (fake app, fake keys)\n');
  console.log(formatReport(scanProject(risky), { color: process.stdout.isTTY, name: 'demo-founder-app' }));
  const r = scanProject(fixed);
  console.log(`\n$ bh-preflight ./demo-founder-app-fixed\n...\nLaunch score: ${r.score}/100 (${r.grade}). ${r.counts.fail} fail, ${r.counts.warn} warn, ${r.counts.pass} pass.`);
} finally { rmSync(base, { recursive: true, force: true }); }
