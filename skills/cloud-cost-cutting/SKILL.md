---
name: cloud-cost-cutting
description: Cut cloud and SaaS bills for an AI-built app (Vercel, Netlify, Supabase, Firebase, Railway, Render, AWS, OpenAI and other AI APIs) without breaking production. Read usage and invoices, find idle projects, oversized plans, function and bandwidth waste and runaway AI spend, add spend caps and alerts, and estimate self-hosting savings. Use when the user says their bill jumped, asks how to reduce hosting or AI costs, or wants spend alerts.
license: MIT
metadata:
  origin: BlitzHash
  pairs-with-ecc: "cost-aware-llm-pipeline, deployment-patterns"
---

# Cloud cost cutting

Most surprise bills come from a few things: a second project nobody uses, functions that run far more than needed, uncached bandwidth, a plan tier bought "just in case", and AI calls with no limits. Find them from real usage data, not guesses.

## When to use

- A bill jumped, a free tier ran out, or the user wants to know what the app will cost at 10x users.

## Steps

1. **Collect usage (read-only).** Ask the user to export or show usage and invoices for each provider (Vercel Usage, Supabase Usage, AWS Cost Explorer, AI provider usage pages). Use read-only CLI commands where they exist (`vercel` usage pages, `aws ce get-cost-and-usage` with a read-only role). Never ask for billing-admin keys.
2. **Inventory.** List every project, database, bucket, function and environment with its monthly cost. Flag anything with no traffic in 30 days.
3. **Find the waste.**
   - Idle or duplicate projects and preview environments that never sleep.
   - Function invocations caused by polling, chatty clients, missing caching or cron jobs that run too often.
   - Bandwidth and image optimization charges that a CDN cache or static assets would remove.
   - Plan tiers above what the usage needs, and paid add-ons nobody uses.
   - AI spend: no per-user limits, no max tokens, the most expensive model used for simple tasks, no caching of repeated prompts.
4. **Add brakes first.** Before any optimization, propose spend caps and billing alerts on every provider, and rate limits on AI endpoints. These are the cheapest insurance.
5. **Estimate self-hosting only where it pays.** For steady workloads, compare the managed bill with a VPS plus your time (see `self-hosting-migration`). Include backups, monitoring and upgrades in the estimate. Do not recommend self-hosting for spiky or tiny workloads.
6. **Plan the changes.** For each saving: monthly amount (from the user's data), risk, effort and rollback. Downgrades and deletions are applied by the user in the provider dashboard or by you only after an explicit "yes" per item. Never delete a project, database or bucket without a fresh backup and a second confirmation.

## Output format

A table: item, current monthly cost, proposed change, estimated monthly saving, risk (low/med/high), effort. Totals at the bottom, clearly marked as estimates from the user's own data.

## Safety rules (always)

1. **Read-only first.** Start with the read-only steps. Do not edit files, run migrations, change DNS or touch a dashboard until the user has seen the findings.
2. **Dry run before any change.** For every fix, show the exact diff, command or API request first (use the tool's `--dry-run` or plan mode when it has one). Change nothing yet.
3. **Confirm before changes.** Apply only after the user replies with an explicit "yes" to that specific plan. One approval covers one plan, not the rest of the session.
4. **Scoped tokens from the user's own environment only.** Read credentials from environment variables or a git-ignored `.env`. Never ask the user to paste a key into chat, never print or log a secret (show at most the first 4 characters), never commit one, and never ask for broader permissions than the step needs.
5. **No destructive shortcuts.** No `rm -rf`, `DROP`, `git push --force`, deleting cloud resources or rotating live keys without a separate, explicit confirmation and a written rollback step.
6. **Say what you could not check.** A static review is not a penetration test or a load test. List the gaps instead of implying the app is safe.

## Pairs with ECC

With [ECC](https://github.com/affaan-m/ECC), use `cost-aware-llm-pipeline` to route AI calls to cheaper models and add budgets in code. ECC also has its own token-cost tooling for your coding agent; this skill is about the app's production bills.

Need a senior team to check this for you? Free assessment at https://blitzhash.com
