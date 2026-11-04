// BlitzHash preflight: a read-only, offline launch-readiness scan of a local project.
// It never writes to the project, never makes network calls and never prints a full secret.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, basename, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.output', 'dist', 'build', 'out',
  'coverage', '.vercel', '.netlify', '.turbo', '.cache', 'vendor', '.venv', 'venv', '__pycache__', '.expo', 'ios', 'android']);
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.vue', '.svelte', '.astro', '.py',
  '.rb', '.go', '.php', '.java', '.kt', '.cs', '.json', '.yaml', '.yml', '.toml', '.env', '.md', '.html', '.sql', '.sh',
  '.txt', '.ini', '.conf', '']);
const MAX_FILES = 8000;
const MAX_BYTES = 1024 * 1024;

export const SECRET_PATTERNS = [
  { id: 'stripe-live-secret', label: 'Stripe live secret key', re: /\bsk_live_[0-9a-zA-Z]{16,}\b/ },
  { id: 'stripe-restricted', label: 'Stripe restricted key', re: /\brk_live_[0-9a-zA-Z]{16,}\b/ },
  { id: 'stripe-webhook-secret', label: 'Stripe webhook signing secret', re: /\bwhsec_[0-9a-zA-Z]{20,}\b/ },
  { id: 'openai', label: 'OpenAI API key', re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/ },
  { id: 'anthropic', label: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/ },
  { id: 'aws-access-key', label: 'AWS access key ID', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: 'github-token', label: 'GitHub token', re: /\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{30,}\b/ },
  { id: 'private-key', label: 'Private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/ },
  { id: 'google-api', label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'slack-token', label: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/ },
  { id: 'resend', label: 'Resend API key', re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/ },
  { id: 'db-url-password', label: 'Database URL with a password', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/'"]+:[^\s@'"]{6,}@[^\s'"]+/ },
];

const PUBLIC_PREFIX = /\b(NEXT_PUBLIC_|VITE_|EXPO_PUBLIC_|REACT_APP_|PUBLIC_|NUXT_PUBLIC_|GATSBY_)([A-Z0-9_]+)/g;
const SENSITIVE_NAME = /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|PASSWD|STRIPE_SK|SK_LIVE|OPENAI|ANTHROPIC|GEMINI_API|DATABASE_URL|DB_URL|ADMIN_KEY|WEBHOOK_SECRET|AWS_SECRET)/;

export function redact(s) {
  const v = String(s);
  if (v.length <= 8) return '****';
  return v.slice(0, 4) + '…' + '*'.repeat(6) + ` (${v.length} chars)`;
}

function walk(root) {
  const files = [];
  const stack = [root];
  while (stack.length && files.length < MAX_FILES) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) stack.push(full); continue; }
      if (!e.isFile()) continue;
      const ext = extname(e.name).toLowerCase();
      const isEnv = e.name.startsWith('.env');
      if (!isEnv && !TEXT_EXT.has(ext)) continue;
      if (/\.(min\.js|map|lock)$/.test(e.name) || e.name === 'package-lock.json' || e.name === 'pnpm-lock.yaml' || e.name === 'yarn.lock') continue;
      let size = 0;
      try { size = statSync(full).size; } catch { continue; }
      if (size > MAX_BYTES) continue;
      files.push(full);
    }
  }
  return files;
}

function gitTracked(root) {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(out.split('\0').filter(Boolean).map((p) => p.split('/').join(sep)));
  } catch { return null; }
}

function isClientFile(rel, text) {
  const r = rel.split(sep).join('/');
  if (/^['"]use client['"]/m.test(text)) return true;
  if (/(^|\/)(components|hooks|pages(?!\/api)|public|client|frontend)\//.test(r) && !/(^|\/)(api|server)\//.test(r)) return true;
  if (/(^|\/)src\/(main|App)\.(t|j)sx?$/.test(r)) return true;
  return false;
}

function isEnvExample(name) { return /\.env\.(example|sample|template|dist)$/.test(name); }

// Each check returns { id, title, status: 'pass'|'warn'|'fail', weight, detail, items, fix, skill }
export function scanProject(root, opts = {}) {
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  const files = walk(root);
  const rels = files.map((f) => relative(root, f));
  const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
  const contents = new Map(files.map((f, i) => [rels[i], read(f)]));
  const all = [...contents.entries()];
  const code = all.filter(([r]) => /\.(m?[jt]sx?|c[jt]s|vue|svelte|astro|py|rb|go|php)$/.test(r));
  const tracked = gitTracked(root);
  const gitignore = existsSync(join(root, '.gitignore')) ? read(join(root, '.gitignore')) : '';
  const pkgText = contents.get('package.json') || '';
  let pkg = {};
  try { pkg = JSON.parse(pkgText || '{}'); } catch { pkg = {}; }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const has = (re) => all.some(([, t]) => re.test(t));
  const hasCode = (re) => code.some(([, t]) => re.test(t));
  const checks = [];

  // 1. Hardcoded secrets
  {
    const items = [];
    for (const [rel, text] of all) {
      const name = basename(rel);
      if (isEnvExample(name)) continue;
      const envFile = name.startsWith('.env');
      if (envFile && tracked && !tracked.has(rel)) continue; // local, untracked .env is fine
      if (envFile && !tracked && /(^|\n)\s*\.env/.test(gitignore)) continue;
      for (const p of SECRET_PATTERNS) {
        const m = text.match(p.re);
        if (m) items.push(`${rel}: ${p.label} ${redact(m[0])}`);
      }
    }
    checks.push({
      id: 'secrets', title: 'Hardcoded secrets', weight: 20, skill: 'production-security-review',
      status: items.length ? 'fail' : 'pass', items,
      detail: items.length ? `${items.length} secret-looking value(s) in source. Anyone with the code (or the JS bundle) can use them.` : 'No known secret formats found in source files.',
      fix: 'Move each value to your host\'s environment variables, rotate the key at the provider (it is already exposed), then purge it from git history.',
    });
  }

  // 2. Secrets behind public env prefixes (shipped to the browser)
  {
    const items = new Set();
    for (const [rel, text] of all) {
      if (/\.(md|txt)$/i.test(rel)) continue; // docs that warn about these names are fine
      for (const m of text.matchAll(PUBLIC_PREFIX)) {
        if (SENSITIVE_NAME.test(m[2])) items.add(`${rel}: ${m[1]}${m[2]}`);
      }
    }
    for (const [rel, text] of code) {
      if (isClientFile(rel, text) && /SERVICE_ROLE|service_role/.test(text)) items.add(`${rel}: Supabase service_role key used in client-side code`);
    }
    const list = [...items];
    checks.push({
      id: 'public-env', title: 'Secrets in browser-exposed env vars', weight: 15, skill: 'production-security-review',
      status: list.length ? 'fail' : 'pass', items: list,
      detail: list.length ? 'Variables with NEXT_PUBLIC_/VITE_/EXPO_PUBLIC_-style prefixes are copied into the JavaScript bundle. These names look like secrets.' : 'No secret-looking names behind public prefixes.',
      fix: 'Rename without the public prefix and only read it in server code (API route, server action, edge function). Rotate the key.',
    });
  }

  // 3. .env hygiene
  {
    const items = [];
    const envFiles = rels.filter((r) => basename(r).startsWith('.env') && !isEnvExample(basename(r)));
    if (tracked) for (const r of envFiles) if (tracked.has(r)) items.push(`${r} is committed to git`);
    const ignored = /(^|\n)\s*\/?\.env(\*|\.\*|\.local)?\s*($|\n)/.test(gitignore) || /(^|\n)\s*\*\.env/.test(gitignore);
    if (!ignored) items.push('.gitignore does not ignore .env files');
    checks.push({
      id: 'env-files', title: '.env files kept out of git', weight: 10, skill: 'production-security-review',
      status: items.some((i) => i.includes('committed')) ? 'fail' : items.length ? 'warn' : 'pass', items,
      detail: items.length ? 'Environment files can leak keys through the repo.' : '.env is ignored and none are committed.',
      fix: 'Add `.env*` and `!.env.example` to .gitignore, `git rm --cached` committed env files, rotate anything that was in them.',
    });
  }

  // 4. Security headers
  {
    const headerRe = /(Content-Security-Policy|X-Frame-Options|frame-ancestors|Strict-Transport-Security|X-Content-Type-Options)/i;
    const sources = all.filter(([r, t]) => /(next\.config|vercel\.json|netlify\.toml|_headers|middleware\.|nginx|Caddyfile|server\.|app\.|index\.|hono|wrangler)/i.test(r) && headerRe.test(t)).map(([r]) => r);
    const helmet = 'helmet' in deps || hasCode(/from ['"]helmet['"]|require\(['"]helmet['"]\)|secureHeaders\(/);
    const ok = sources.length > 0 || helmet;
    checks.push({
      id: 'headers', title: 'Security headers (CSP, HSTS, frame, nosniff)', weight: 10, skill: 'production-security-review',
      status: ok ? 'pass' : 'warn', items: ok ? (helmet ? ['helmet / secureHeaders middleware found'] : sources) : [],
      detail: ok ? 'Security headers are configured in code or host config.' : 'No security headers configured in next.config, vercel.json, _headers, middleware or helmet.',
      fix: 'Add a headers block (next.config `headers()`, vercel.json `headers`, Netlify/Cloudflare `_headers`) with CSP, HSTS, X-Frame-Options/frame-ancestors and X-Content-Type-Options.',
    });
  }

  // 5. Rate limiting on auth/API
  {
    const apiFiles = code.filter(([r]) => /(^|[\\/])(api|routes|functions|server)[\\/]/.test(r) || /route\.(t|j)s$/.test(r)).map(([r]) => r);
    const libs = ['@upstash/ratelimit', 'express-rate-limit', 'rate-limiter-flexible', 'hono-rate-limiter', '@nestjs/throttler', 'limiter', 'bottleneck', 'slowapi', 'django-ratelimit'];
    const lib = libs.find((l) => l in deps) || (hasCode(/ratelimit|rateLimit|rate_limit|RateLimiter|throttle\(/) ? 'custom rate limiter' : null);
    const status = lib ? 'pass' : apiFiles.length ? 'fail' : 'warn';
    checks.push({
      id: 'rate-limit', title: 'Rate limits on login and API routes', weight: 10, skill: 'production-security-review',
      status, items: lib ? [`found: ${lib}`] : apiFiles.slice(0, 5),
      detail: lib ? 'A rate limiter is in place.' : apiFiles.length ? `${apiFiles.length} API/server route file(s) and no rate limiter. One script can hammer login, signup or your AI endpoint (and your bill).` : 'No API routes found and no rate limiter; check your backend provider limits.',
      fix: 'Add per-IP and per-user limits on login, signup, password reset and any AI/LLM endpoint (e.g. @upstash/ratelimit, express-rate-limit, or Cloudflare rate limiting rules).',
    });
  }

  // 6. Auth on API routes + webhook signatures
  {
    const routeFiles = code.filter(([r]) => /(^|[\\/])app[\\/].*[\\/]route\.(t|j)s$|(^|[\\/])pages[\\/]api[\\/]|(^|[\\/])api[\\/].*\.(t|j)s$/.test(r));
    const authRe = /(auth\(|getUser|getSession|getServerSession|currentUser|verifyToken|jwtVerify|jwt\.verify|clerk|requireAuth|withAuth|supabase\.auth|createServerClient|headers\.get\(['"]authorization|headers\.authorization|x-api-key|isAdmin|session)/i;
    const open = routeFiles.filter(([r, t]) => !authRe.test(t) && !/webhook|health|status|og|public/i.test(r)).map(([r]) => r);
    const webhookIssues = code.filter(([r, t]) => /webhook/i.test(r) && /stripe/i.test(t) && !/constructEvent|constructEventAsync|verifyHeader|webhooks\.signature/i.test(t)).map(([r]) => `${r}: Stripe webhook without signature verification`);
    const items = [...webhookIssues, ...open.map((r) => `${r}: no auth check found`)];
    const status = webhookIssues.length ? 'fail' : open.length ? 'warn' : 'pass';
    checks.push({
      id: 'auth', title: 'Auth checks and webhook signatures', weight: 15, skill: 'production-security-review',
      status, items,
      detail: status === 'pass' ? (routeFiles.length ? 'API routes reference an auth/session check; webhooks verify signatures.' : 'No API route files found.') : 'Some server routes look reachable without a login, or accept webhooks without checking they really came from Stripe.',
      fix: 'Check the session/user on every non-public route (server side, not just the UI). Verify Stripe webhooks with stripe.webhooks.constructEvent and the raw body.',
    });
  }

  // 7. CORS
  {
    const items = code.filter(([, t]) => /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]|origin:\s*['"]\*['"]|cors\(\s*\)/.test(t)).map(([r]) => `${r}: allows any origin`);
    checks.push({
      id: 'cors', title: 'CORS not open to every site', weight: 5, skill: 'production-security-review',
      status: items.length ? 'warn' : 'pass', items,
      detail: items.length ? 'Any website can call these endpoints from a visitor\'s browser.' : 'No wildcard CORS found.',
      fix: 'Allow only your own domains (and localhost in dev). Never combine * with credentials.',
    });
  }

  // 8. Error monitoring
  {
    const mon = ['@sentry/nextjs', '@sentry/node', '@sentry/react', '@sentry/browser', 'sentry-sdk', '@logtail/node', '@axiomhq/js', 'posthog-node', '@highlight-run/next', 'pino', 'winston', '@opentelemetry/api', 'newrelic', 'dd-trace'].find((m) => m in deps) || (hasCode(/sentry_sdk|Sentry\.init|logtail|opentelemetry/i) ? 'found in code' : null);
    checks.push({
      id: 'monitoring', title: 'Error monitoring / logging', weight: 5, skill: 'launch-readiness-audit',
      status: mon ? 'pass' : 'warn', items: mon ? [`found: ${mon}`] : [],
      detail: mon ? 'Errors are reported somewhere you can see them.' : 'No error monitoring found. Your first users will find bugs before you do.',
      fix: 'Add Sentry (or similar) on client and server, and an uptime check on your main page and one API route.',
    });
  }

  // 9. Backups and restore drill
  {
    const items = all.filter(([r, t]) => /backup|restore|pg_dump|pitr|point-in-time/i.test(r) || /(pg_dump|pg_restore|restore drill|point-in-time recovery|PITR)/i.test(t)).map(([r]) => r).slice(0, 5);
    checks.push({
      id: 'backups', title: 'Backups with a tested restore', weight: 5, skill: 'backup-restore-drill',
      status: items.length ? 'pass' : 'warn', items,
      detail: items.length ? 'Backup/restore scripts or docs exist. Make sure a restore was actually tested.' : 'No backup or restore script/runbook in the repo. A backup you never restored is a guess.',
      fix: 'Write down where backups live and how long they are kept, then restore one into a scratch database and time it (skill: backup-restore-drill).',
    });
  }

  // 10. Production build hygiene
  {
    const items = [];
    if (all.some(([r, t]) => /next\.config/.test(r) && /productionBrowserSourceMaps:\s*true/.test(t))) items.push('next.config: productionBrowserSourceMaps is true (ships readable source)');
    if (!['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock'].some((f) => existsSync(join(root, f))) && pkgText) items.push('no lockfile: every deploy may install different dependency versions');
    const dbg = code.filter(([r, t]) => /console\.log\([^)]*(token|password|secret|apiKey|api_key)/i.test(t)).map(([r]) => `${r}: logs a token/password`);
    items.push(...dbg.slice(0, 5));
    checks.push({
      id: 'build', title: 'Production build hygiene', weight: 5, skill: 'scaling-performance-review',
      status: dbg.length ? 'fail' : items.length ? 'warn' : 'pass', items,
      detail: items.length ? 'Things that leak code or make deploys unpredictable.' : 'Lockfile present, no public source maps, no secret logging found.',
      fix: 'Commit a lockfile, turn off public source maps, and never log tokens or passwords.',
    });
  }

  const max = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight * 0.4 : 0), 0);
  const score = Math.round((got / max) * 100);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const counts = { fail: 0, warn: 0, pass: 0 };
  for (const c of checks) counts[c.status]++;
  return { root, filesScanned: files.length, checks, score, grade, counts };
}

export function formatReport(r, { color = false, name } = {}) {
  const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const tag = { fail: c('31;1', '[FAIL]'), warn: c('33;1', '[WARN]'), pass: c('32;1', '[PASS]') };
  const out = [];
  out.push(c('1', 'BlitzHash preflight: launch-readiness scan'));
  out.push(`Project: ${name || r.root} (${r.filesScanned} files). Read-only and offline: nothing was changed or sent.`);
  out.push('');
  for (const ch of r.checks) {
    out.push(`${tag[ch.status]} ${ch.title}`);
    if (ch.status !== 'pass') {
      out.push(`       ${ch.detail}`);
      for (const i of ch.items.slice(0, 4)) out.push(`         - ${i}`);
      if (ch.items.length > 4) out.push(`         - …and ${ch.items.length - 4} more`);
      out.push(`       Fix: ${ch.fix}`);
      out.push(`       Skill: ${ch.skill}`);
    }
  }
  out.push('');
  out.push(c('1', `Launch score: ${r.score}/100 (${r.grade}). ${r.counts.fail} fail, ${r.counts.warn} warn, ${r.counts.pass} pass.`));
  out.push('Static checks only. A real launch review also needs a live-URL check, load test and restore test.');
  return out.join('\n');
}
