---
description: Run a BlitzHash launch-readiness check on this project (read-only scan + prioritized fix plan). Nothing is changed.
argument-hint: "[project folder, default .]"
---

# /launch-check

Use the `launch-readiness-audit` skill on `$ARGUMENTS` (or the current project if empty).

1. Run `bh-preflight` (read-only, offline) and show the score.
2. Ask the questions a scan cannot answer (staging, backups restored, spend caps, dashboard access).
3. Return the report: Fix before launch, Fix this month, Nice to have, Not checked.
4. Do not change any file. Offer the first fix as a dry run and wait for "yes".
