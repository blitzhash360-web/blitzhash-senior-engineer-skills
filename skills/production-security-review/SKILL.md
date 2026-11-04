---
name: production-security-review
description: Founder-focused security review of an AI-built web app. Leaked secrets and keys, secrets behind NEXT_PUBLIC_/VITE_ prefixes, Supabase service_role misuse, auth on API routes, Stripe webhook signatures, security headers, CORS and rate limits. Read-only scan first, fixes as reviewed diffs. Use when the user asks about security, leaked API keys, "is my app safe", auth, headers, CORS or rate limiting.
license: MIT
metadata:
  origin: BlitzHash
  pairs-with-ecc: "security-review, security-scan, security-reviewer agent"
---

# Production security review

The five problems we see most in apps built with Lovable, Bolt, Replit, Cursor and v0: keys in the code, secrets shipped to the browser, API routes with no login check, payment webhooks nobody verifies, and no limits on how often anyone can call anything.

## When to use

- Before launch, before taking payments, or after an AI tool generated a large chunk of backend code.
- The user suspects a leaked key, saw strange usage on an AI or Stripe bill, or got a security report.

## Steps

1. **Scan (read-only).** Run `bh-preflight` on the project (see `launch-readiness-audit`) and read the secrets, public-env, `.env`, headers, rate-limit, auth and CORS results.
2. **Secrets.**
   - Search for key formats (Stripe `sk_live_`, OpenAI `sk-`, AWS `AKIA`, private key blocks, database URLs with passwords) in source AND git history: `git log --all -G "sk_live_|AKIA|BEGIN .*PRIVATE KEY" --oneline --name-only` (lists commits and files without printing the values).
   - Any variable with a public prefix (`NEXT_PUBLIC_`, `VITE_`, `EXPO_PUBLIC_`, `REACT_APP_`) is in the browser bundle. Service role keys, secret keys and AI provider keys must never use one.
   - A key that was ever committed or shipped is compromised: the fix is **rotate at the provider**, then move it to the host's env vars. Plan the rotation with the user; do not rotate live keys yourself.
3. **Auth and data access.**
   - Every non-public API route must check the session server-side. UI-only checks do not count.
   - Supabase: the service role key belongs only in server code. Tables need RLS with policies that use `auth.uid()`; `USING (true)` is not a policy. For a full RLS check, point the user to [supabase-rls-check](https://github.com/blitzhash360-web/supabase-rls-check).
   - Test with two accounts: can user A read or edit user B's records by changing an ID?
4. **Webhooks.** Stripe (and similar) webhooks must verify the signature with the raw body (`stripe.webhooks.constructEvent`) and be idempotent (store processed event IDs).
5. **Headers and CORS.** Production responses should send `Strict-Transport-Security`, `Content-Security-Policy` (start with `frame-ancestors 'none'` if a full CSP is too much), `X-Content-Type-Options: nosniff` and a `Referrer-Policy`. CORS allows only your own origins. Check the live site with `curl -sI https://yourdomain` (read-only).
6. **Rate limits.** Limit login, signup, password reset, OTP, contact forms and every AI/LLM endpoint per IP and per user. At the edge, `cloudflare-hardening` can add them without code.
7. **Propose fixes as diffs.** Order: leaked keys, data exposure, auth, webhooks, rate limits, headers. Show each diff, wait for "yes", apply, re-run the scan.

## Output format

A table: severity (critical/high/medium), finding, where (file:line), business impact in one sentence, fix, and whether it needs a key rotation.

## Safety rules (always)

1. **Read-only first.** Start with the read-only steps. Do not edit files, run migrations, change DNS or touch a dashboard until the user has seen the findings.
2. **Dry run before any change.** For every fix, show the exact diff, command or API request first (use the tool's `--dry-run` or plan mode when it has one). Change nothing yet.
3. **Confirm before changes.** Apply only after the user replies with an explicit "yes" to that specific plan. One approval covers one plan, not the rest of the session.
4. **Scoped tokens from the user's own environment only.** Read credentials from environment variables or a git-ignored `.env`. Never ask the user to paste a key into chat, never print or log a secret (show at most the first 4 characters), never commit one, and never ask for broader permissions than the step needs.
5. **No destructive shortcuts.** No `rm -rf`, `DROP`, `git push --force`, deleting cloud resources or rotating live keys without a separate, explicit confirmation and a written rollback step.
6. **Say what you could not check.** A static review is not a penetration test or a load test. List the gaps instead of implying the app is safe.

## Pairs with ECC

With [ECC](https://github.com/affaan-m/ECC) installed, run its `security-reviewer` agent on the changed files after each fix and use the `security-review` checklist for input validation, XSS and SSRF patterns. ECC covers secure coding in depth; this skill focuses on what founders ship by accident.

Need a senior team to check this for you? Free assessment at https://blitzhash.com
