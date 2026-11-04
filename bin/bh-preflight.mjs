#!/usr/bin/env node
// bh-preflight: read-only, offline launch-readiness scan of a local project folder.
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanProject, formatReport } from '../lib/preflight.mjs';

const HELP = `bh-preflight: read-only launch-readiness scan of a local project (BlitzHash Senior Engineer Skills)

Usage: bh-preflight [dir] [--json] [--fail-under N] [--no-color]

  dir            Project folder to scan (default: current folder)
  --json         Print machine-readable JSON
  --fail-under N Exit 1 if the score is below N (for CI)
  --no-color     Plain output

Checks: hardcoded secrets, secrets behind NEXT_PUBLIC_/VITE_ prefixes, .env in git,
security headers, rate limits, auth on API routes, Stripe webhook signatures, CORS,
error monitoring, backup/restore runbook, build hygiene.
It only reads files. It never writes, never uses the network, and redacts any secret it finds.`;

export async function main(argv, io = { out: console.log, isTTY: process.stdout.isTTY }) {
  const args = [...argv];
  if (args.includes('-h') || args.includes('--help')) { io.out(HELP); return 0; }
  const json = args.includes('--json');
  const noColor = args.includes('--no-color') || !!process.env.NO_COLOR;
  let failUnder = null;
  const fu = args.indexOf('--fail-under');
  if (fu >= 0) { failUnder = Number(args[fu + 1]); args.splice(fu, 2); if (Number.isNaN(failUnder)) throw new Error('--fail-under needs a number'); }
  const pos = args.filter((a) => !a.startsWith('--'));
  const dir = resolve(pos[0] || '.');
  const r = scanProject(dir);
  if (json) io.out(JSON.stringify(r, null, 2));
  else io.out(formatReport(r, { color: io.isTTY && !noColor, name: basename(dir) }));
  if (failUnder != null && r.score < failUnder) return 1;
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`bh-preflight: ${e.message}`); process.exit(2); });
}
