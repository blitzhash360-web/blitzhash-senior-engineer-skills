---
name: launch-readiness-audit
description: Senior-engineer launch-readiness review for an app built with Lovable, Bolt, Replit, Cursor or v0. Runs the offline bh-preflight scan, then walks security, auth, rate limits, monitoring, backups, scaling and cost, and returns a prioritized fix list with a score. Use when the user asks "is my app ready to launch", "production ready", "before I charge customers", "launch checklist" or "what should I fix first".
license: MIT
metadata:
  origin: BlitzHash
  pairs-with-ecc: "security-review, deployment-patterns, verification-loop, security-reviewer agent"
---

# Launch-readiness audit

The first thing a senior engineer does before real users arrive: find the problems that hurt the most (leaked keys, open data, no brakes on the bill, no way back after a bad deploy) and fix them in the right order.

## When to use

- The user is about to launch, take payments or onboard their first real customers.
- The app was generated or mostly written by an AI tool and nobody has reviewed it end to end.
- The user asks what to fix first.

## Steps

1. **Map the app (read-only).** Identify framework, hosting (Vercel, Netlify, Cloudflare, Railway, a VPS), database and auth (Supabase, Firebase, Neon, Clerk), payments (Stripe) and AI providers. List environment variable NAMES only, never values.
2. **Run the preflight scan (read-only, offline).** From the project root:

   ```bash
   npx -y github:blitzhash360-web/blitzhash-senior-engineer-skills .
   # or, in a clone: node bin/bh-preflight.mjs /path/to/project
   ```

   It only reads files and prints a score out of 100 with a fix and a follow-up skill for each finding. Secrets are redacted.
3. **Go deeper where the scan points.** Hand each area to its skill: `production-security-review` (secrets, auth, headers, rate limits), `scaling-performance-review`, `cloud-cost-cutting`, `cloudflare-hardening`, `backup-restore-drill`, `self-hosting-migration`.
4. **Ask about what a scan cannot see.** Ask the user, do not guess: Is there a staging environment? Who can access the production dashboards? Has a backup ever been restored? Is there a spend cap or billing alert on every provider? What happens if the AI provider is down?
5. **Write the report.** Group findings as **Fix before launch** (data exposure, leaked keys, missing auth, unverified webhooks), **Fix this month** (rate limits, monitoring, backups, headers) and **Nice to have**. One line of plain English per finding: what is wrong, why it matters to the business, the fix, and effort (S/M/L).
6. **Fix one item at a time, dry run first.** For each item the user picks, show the exact diff or command, wait for "yes", apply, then re-run step 2 and report the score change.

## Output format

```text
Launch score: 34/100 (F), after the 3 approved fixes: 78/100 (B)
FIX BEFORE LAUNCH
1. Stripe live key hardcoded in lib/stripe.ts. Anyone with the code can charge or refund. Move it to env vars and rotate it. (S)
...
NOT CHECKED: live URL headers, load test, restore test.
```

## Safety rules (always)

1. **Read-only first.** Start with the read-only steps. Do not edit files, run migrations, change DNS or touch a dashboard until the user has seen the findings.
2. **Dry run before any change.** For every fix, show the exact diff, command or API request first (use the tool's `--dry-run` or plan mode when it has one). Change nothing yet.
3. **Confirm before changes.** Apply only after the user replies with an explicit "yes" to that specific plan. One approval covers one plan, not the rest of the session.
4. **Scoped tokens from the user's own environment only.** Read credentials from environment variables or a git-ignored `.env`. Never ask the user to paste a key into chat, never print or log a secret (show at most the first 4 characters), never commit one, and never ask for broader permissions than the step needs.
5. **No destructive shortcuts.** No `rm -rf`, `DROP`, `git push --force`, deleting cloud resources or rotating live keys without a separate, explicit confirmation and a written rollback step.
6. **Say what you could not check.** A static review is not a penetration test or a load test. List the gaps instead of implying the app is safe.

## Pairs with ECC

If [ECC](https://github.com/affaan-m/ECC) is installed, use its `security-review` skill and `security-reviewer` agent for line-level code review, `deployment-patterns` for CI/CD and rollback, and `verification-loop` before you call a fix done. This skill decides what matters for the launch; the ECC skills help do the engineering.

Need a senior team to check this for you? Free assessment at https://blitzhash.com
