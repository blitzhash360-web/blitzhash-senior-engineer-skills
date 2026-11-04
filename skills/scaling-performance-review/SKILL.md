---
name: scaling-performance-review
description: Find what breaks first when an AI-built app gets real traffic. N+1 queries, missing indexes, unbounded selects, no pagination, heavy client bundles, no caching, synchronous AI calls, cold starts and connection limits. Measures before changing anything. Use when the user says the app is slow, expects a launch spike, asks "will it scale", or sees timeouts or database CPU alerts.
license: MIT
metadata:
  origin: BlitzHash
  pairs-with-ecc: "postgres-patterns, database-migrations, backend-patterns, performance-optimizer agent, database-reviewer agent"
---

# Scaling and performance review

Apps that work for the founder and five friends usually fail in the same places: the database, the AI calls and the bundle. Measure first, then fix the biggest bottleneck only.

## When to use

- Before a launch, a Product Hunt day, a paid campaign or a big customer onboarding.
- The app is slow, times out, or the database or functions bill jumped.

## Steps

1. **Measure (read-only).** Collect a baseline before touching anything:
   - Page speed: Lighthouse or PageSpeed Insights on the 3 most important pages (record LCP, INP, CLS).
   - API: time the 5 most used endpoints (`curl -w "%{time_total}\n" -o /dev/null -s URL`).
   - Database: slow query log or `pg_stat_statements` (Supabase: Reports, Query performance). Read-only queries only.
2. **Database.** Look for `select('*')` without `limit`, queries inside loops (N+1), filters and joins on columns without an index, and missing pagination on lists. Propose indexes as a migration file the user reviews; never run DDL on production directly.
3. **Connections.** Serverless functions plus Postgres need a pooler (Supabase pooler / PgBouncer, port 6543 in transaction mode). Check the connection string the app uses.
4. **AI calls.** Stream responses, set timeouts, cap max tokens, cache repeated prompts, and move long jobs to a queue instead of holding a request open.
5. **Frontend.** Large client bundles, unoptimized images, everything rendered client-side, no CDN caching for static assets. Check `next build` output or the bundle analyzer.
6. **Caching.** Cache public, rarely changing responses (CDN, `Cache-Control`, ISR). Never cache pages with user data.
7. **Load check (only with permission, only on staging).** A short test with `k6` or `autocannon` against a staging URL the user owns, starting low (for example 10 virtual users for 60 seconds). Never load test production or third-party APIs.
8. **Fix the top bottleneck, then re-measure.** Show the diff or migration, wait for "yes", apply, and report before and after numbers.

## Output format

Baseline numbers, the top 3 bottlenecks with evidence, the proposed fix for each, expected impact, and the re-measured numbers after approved fixes.

## Safety rules (always)

1. **Read-only first.** Start with the read-only steps. Do not edit files, run migrations, change DNS or touch a dashboard until the user has seen the findings.
2. **Dry run before any change.** For every fix, show the exact diff, command or API request first (use the tool's `--dry-run` or plan mode when it has one). Change nothing yet.
3. **Confirm before changes.** Apply only after the user replies with an explicit "yes" to that specific plan. One approval covers one plan, not the rest of the session.
4. **Scoped tokens from the user's own environment only.** Read credentials from environment variables or a git-ignored `.env`. Never ask the user to paste a key into chat, never print or log a secret (show at most the first 4 characters), never commit one, and never ask for broader permissions than the step needs.
5. **No destructive shortcuts.** No `rm -rf`, `DROP`, `git push --force`, deleting cloud resources or rotating live keys without a separate, explicit confirmation and a written rollback step.
6. **Say what you could not check.** A static review is not a penetration test or a load test. List the gaps instead of implying the app is safe.

## Pairs with ECC

With [ECC](https://github.com/affaan-m/ECC), use the `performance-optimizer` and `database-reviewer` agents for code-level work, and the `postgres-patterns` and `database-migrations` skills to write safe migrations.

Need a senior team to check this for you? Free assessment at https://blitzhash.com
