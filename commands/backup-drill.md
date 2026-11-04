---
description: Prove your backups work. Inventory what is backed up, restore into a scratch database, time it, write the runbook.
argument-hint: "[database name, optional]"
---

# /backup-drill

Use the `backup-restore-drill` skill (target: `$ARGUMENTS`, or the main database).

1. Inventory data stores, backup location, frequency and retention (read-only).
2. Show the dump and restore commands; run them only after "yes", and only restore into a scratch database, never production.
3. Verify row counts, then show the runbook text before writing `docs/backup-restore.md`.
