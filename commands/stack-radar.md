---
description: What changed in this app's stack recently, and whether you need to act. Read-only first; every change needs your yes.
argument-hint: "[product, optional]"
---

# /stack-radar

Use the `stack-radar` skill (focus on `$ARGUMENTS` if a product was named, otherwise the whole detected stack).

1. Detect the stack from the repo. Do not invent products.
2. Look up official changelogs and advisories. Classify Act now / Plan this month / Awareness only.
3. Propose upgrades or config changes as a dry run. Apply nothing without an explicit "yes".
