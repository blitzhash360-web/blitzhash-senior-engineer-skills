---
name: backup-restore-drill
description: Prove the app's data can be recovered. Find what is backed up (database, file storage, auth users, env config), how often and for how long, then restore a backup into a scratch database and time it. Writes a short recovery runbook. Use when the user asks about backups, disaster recovery, point-in-time recovery, "what if the database is deleted", or before launch.
license: MIT
metadata:
  origin: BlitzHash
  pairs-with-ecc: "database-migrations, postgres-patterns, deployment-patterns"
---

# Backup and restore drill

A backup that was never restored is a guess. This skill turns "Supabase has backups, I think" into a tested, timed recovery with a written runbook.

## When to use

- Before launch, before a risky migration, after any data-loss scare, or when nobody can say how long a restore takes.

## Steps

1. **Inventory (read-only).** For each data store write down: what it holds, where backups live, frequency, retention, and who can restore. Cover the database, file storage buckets, auth users, environment variables and secrets (names only), and third-party data (Stripe is the source of truth for payments).
2. **Check the provider plan.** Many free and starter plans keep daily backups for a few days only and have no point-in-time recovery. Confirm in the dashboard; do not assume.
3. **Take a fresh logical backup (read-only on production).** With a read-only or backup role from the user's environment:

   ```bash
   pg_dump "$DATABASE_URL" --format=custom --no-owner --file=backup-$(date +%F).dump
   ```

   Store it outside the repo (it contains user data) and never commit it.
4. **Restore into a scratch database, never production.** A local Docker Postgres or a new empty project:

   ```bash
   docker run -d --name bh-restore -e POSTGRES_PASSWORD=restore-test -p 55432:5432 postgres:16
   time PGPASSWORD=restore-test pg_restore --no-owner -h localhost -p 55432 -U postgres -d postgres backup-$(date +%F).dump
   ```

   Show the commands and get a "yes" before running them.
5. **Verify.** Compare row counts of the main tables with production (read-only counts), open a few records, and check that file storage objects are covered too.
6. **Write the runbook.** `docs/backup-restore.md`: where backups are, how to restore, how long it took, who is allowed to do it, and when the next drill is due (monthly or before major releases). Show the file content and get a "yes" before writing it.
7. **Clean up.** Remove the scratch container and local dump after the user confirms (`docker rm -f bh-restore`).

## Output format

Inventory table, restore duration, verification results, gaps (for example "storage bucket not backed up", "only 7 days retention"), and the runbook path.

## Safety rules (always)

1. **Read-only first.** Start with the read-only steps. Do not edit files, run migrations, change DNS or touch a dashboard until the user has seen the findings.
2. **Dry run before any change.** For every fix, show the exact diff, command or API request first (use the tool's `--dry-run` or plan mode when it has one). Change nothing yet.
3. **Confirm before changes.** Apply only after the user replies with an explicit "yes" to that specific plan. One approval covers one plan, not the rest of the session.
4. **Scoped tokens from the user's own environment only.** Read credentials from environment variables or a git-ignored `.env`. Never ask the user to paste a key into chat, never print or log a secret (show at most the first 4 characters), never commit one, and never ask for broader permissions than the step needs.
5. **No destructive shortcuts.** No `rm -rf`, `DROP`, `git push --force`, deleting cloud resources or rotating live keys without a separate, explicit confirmation and a written rollback step.
6. **Say what you could not check.** A static review is not a penetration test or a load test. List the gaps instead of implying the app is safe.

## Pairs with ECC

With [ECC](https://github.com/affaan-m/ECC), use `database-migrations` and `postgres-patterns` before schema changes, and `deployment-patterns` to add a backup step to release checklists.

Need a senior team to check this for you? Free assessment at https://blitzhash.com
