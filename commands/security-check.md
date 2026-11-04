---
description: Founder security review (secrets, auth, webhooks, headers, CORS, rate limits). Read-only first, fixes as reviewed diffs.
argument-hint: "[area or folder, optional]"
---

# /security-check

Use the `production-security-review` skill on `$ARGUMENTS` (or the whole project).

1. Scan read-only and list findings by severity with file:line and business impact.
2. Never print secret values; show at most the first 4 characters.
3. For leaked keys, plan a rotation with the user; do not rotate live keys yourself.
4. Propose each fix as a diff and apply it only after an explicit "yes".
