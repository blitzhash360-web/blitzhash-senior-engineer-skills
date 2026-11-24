---
name: stack-radar
description: Monthly "do I need to act?" digest of security advisories, breaking changes and pricing or plan changes across the user's founder stack (Next.js, Supabase, Vercel, Cloudflare, Stripe, Lovable, Bolt, Firebase, Clerk, OpenAI). Use when the user asks what changed in their stack this month, whether they need to upgrade, or if a new advisory affects their app.
license: MIT
metadata:
  origin: BlitzHash
  pairs-with-ecc: "security-review, verification-loop"
---

# Stack radar

A short, plain-English digest of what changed in *this* app's stack, and whether the founder needs to do anything. Not a general tech newsletter.

## When to use

- The user asks "what changed this month", "do I need to upgrade", "is there a new Next.js / Supabase / Stripe advisory", or wants a stack catch-up before launch.
- During a launch-readiness or security review, as a last pass on known recent changes.

## Steps

1. **Detect the stack (read-only).** From package files, lockfiles and config, list the products actually in use. Stick to the founder set when present: Next.js, React, Supabase, Vercel, Cloudflare, Stripe, Firebase, Clerk, Auth.js, OpenAI, Anthropic, Lovable, Bolt, plus anything else clearly depended on. Do not invent a product that is not in the repo.
2. **Look up official sources only.** For each product, use the vendor's official changelog, advisory, blog or status page, and well-known security advisories (for example GitHub Advisories or the project's GitHub releases). Prefer the last 30–45 days, plus any older item that is still unpatched in this repo. Quote dates and links. Do not guess at unpublished pricing.
3. **Classify each item as:** **Act now** (a known vulnerability or a breaking change that already affects this repo), **Plan this month** (a deprecation, a plan or pricing change, or an upgrade that can wait), **Awareness only** (nice to know, no action in this repo), or **Not in your stack**. One sentence of why, in plain English.
4. **Check the repo before you recommend a change.** If you say "upgrade Next.js", name the current version in the lockfile and the version you are pointing at. Dry-run the upgrade plan; apply nothing yet.
5. **Write the digest**, then wait for an explicit "yes" before changing dependencies, flags, or cloud settings. One approval covers one plan.

## Output format

```text
Stack radar: 3 May–3 Jun (example dates)
ACT NOW
1. Next.js x.y.z in this repo is below the patched release. Official advisory: <link>. Plan: upgrade to a.b.c, run the test suite, deploy staging first. (M)
PLAN THIS MONTH
1. Supabase is deprecating <thing> on <date>. You use it in <file>. Link: <url>.
AWARENESS ONLY
1. Vercel pricing page changed for a plan you do not use.
NOT CHECKED: dashboard-only settings, bills we could not see, anything behind a login we do not have.
```

## Safety rules (always)

1. **Read-only first.** Do not bump dependencies, change Cloudflare or Vercel settings, or edit production config until the user has seen the digest.
2. **Dry run before any change.** For every upgrade or flag flip, show the exact command or diff first.
3. **Confirm before changes.** Apply only after the user replies with an explicit "yes" to that specific plan. One approval covers one plan, not the rest of the session.
4. **Scoped tokens from the user's own environment only.** If a source needs a token, read it from the environment. Never ask the user to paste a key into chat, never print a secret (show at most the first 4 characters), never commit one, and never ask for broader permissions than the step needs.
5. **No panic, no invention.** If you cannot confirm a claim from an official or advisory source, say you could not check it. Do not treat a social post as an advisory.
6. **No destructive shortcuts.** No `rm -rf`, forced lockfile rewrites, or production deploys without a separate, explicit confirmation and a rollback step.

## Pairs with ECC

If [ECC](https://github.com/affaan-m/ECC) is installed, use its `security-review` skill after an "Act now" advisory, and `verification-loop` after an approved upgrade. This skill decides whether the founder needs to act; ECC helps do the engineering.

Need a senior team to check this for you? Free assessment at https://blitzhash.com
