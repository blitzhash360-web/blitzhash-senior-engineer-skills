---
name: cloudflare-hardening
description: Put an AI-built app safely behind Cloudflare. SSL Full (strict), Always Use HTTPS, minimum TLS, WAF custom rules for .env/.git probes, rate limiting on login and API, Turnstile on forms, bot protection, DNSSEC and hiding the origin IP. Read-only audit first, every change as a dry run with a scoped token. Use when the user asks to protect the site from bots or attacks, set up Cloudflare, rate limit at the edge or hide the server IP.
license: MIT
metadata:
  origin: BlitzHash
  pairs-with-ecc: "deployment-patterns, security-review"
---

# Cloudflare hardening

Cloudflare in front of an app is only protective once a few settings and rules are right. Many AI-built apps keep the defaults (Flexible SSL, no rules, origin IP visible in DNS).

## When to use

- The domain is on Cloudflare (or the user wants it to be) and the app is going live.
- Bots are probing the site, signups are spammed, or someone is hammering login or an AI endpoint.

## Steps

1. **Scoped, read-only token.** The user creates a Cloudflare API token with **Zone Read + DNS Read + Zone Settings Read** for one zone only and puts it in `CLOUDFLARE_API_TOKEN` in their environment or a git-ignored `.env`.
2. **Audit (read-only).** Use BlitzHash's [Production Skills for Cloudflare](https://github.com/blitzhash360-web/blitzhash-cloudflare-production-skills):

   ```bash
   npx -y github:blitzhash360-web/blitzhash-cloudflare-production-skills audit --zone yourdomain.com
   ```

   It checks SSL mode, Always Use HTTPS, TLS version, WAF and rate-limit rules, bot protection, DNSSEC, DNS-only records exposing the origin IP, and dangling CNAMEs, and returns a score out of 100.
3. **Plan fixes in this order.** (a) SSL/TLS Full (strict) with a valid origin certificate, Always Use HTTPS, minimum TLS 1.2; (b) WAF rule blocking `/.env`, `/.git/` and similar probes; (c) rate limits on login, signup and AI routes; (d) Turnstile on public forms with server-side verification; (e) proxy (orange cloud) records that reveal the origin, then lock the origin firewall to Cloudflare IP ranges or use Cloudflare Tunnel; (f) DNSSEC.
4. **Dry run every write.** Each write command prints the exact API request and changes nothing without `--apply`. Show it, wait for "yes", then run it with `--apply --yes`. The write token needs only the permission for that change (for example Zone WAF Edit).
5. **Settings changed in the dashboard** (SSL mode, DNSSEC) are walked through step by step with the user; do not ask for a broader token to do them.
6. **Re-audit** and report the score change and anything still open.

## Safety rules (always)

1. **Read-only first.** Start with the read-only steps. Do not edit files, run migrations, change DNS or touch a dashboard until the user has seen the findings.
2. **Dry run before any change.** For every fix, show the exact diff, command or API request first (use the tool's `--dry-run` or plan mode when it has one). Change nothing yet.
3. **Confirm before changes.** Apply only after the user replies with an explicit "yes" to that specific plan. One approval covers one plan, not the rest of the session.
4. **Scoped tokens from the user's own environment only.** Read credentials from environment variables or a git-ignored `.env`. Never ask the user to paste a key into chat, never print or log a secret (show at most the first 4 characters), never commit one, and never ask for broader permissions than the step needs.
5. **No destructive shortcuts.** No `rm -rf`, `DROP`, `git push --force`, deleting cloud resources or rotating live keys without a separate, explicit confirmation and a written rollback step.
6. **Say what you could not check.** A static review is not a penetration test or a load test. List the gaps instead of implying the app is safe.

## Pairs with ECC

[ECC](https://github.com/affaan-m/ECC) has no Cloudflare-specific skill; pair this with its `deployment-patterns` skill for the deploy side and `security-review` for the app code behind the edge.

Need a senior team to check this for you? Free assessment at https://blitzhash.com
