# Safety model

These skills are written for people who may not read every line their agent runs. So the rules are strict and the same in every skill.

## The six rules every skill follows

1. **Read-only first.** Each skill starts with steps that only read: files, configs, usage exports, `curl -I` on the user's own URL, read-only database counts.
2. **Dry run before any change.** The agent shows the exact diff, command or API request first, using the tool's own dry-run or plan mode when it has one.
3. **Confirm before changes.** Nothing is applied until the user replies with an explicit "yes" to that specific plan.
4. **Scoped tokens from the user's own environment.** Keys come from environment variables or a git-ignored `.env`, with the smallest permission the step needs. The agent never asks for a key in chat, never prints one (at most the first 4 characters) and never commits one.
5. **No destructive shortcuts.** Deletes, `DROP`, force pushes and live key rotation need a separate confirmation and a written rollback step.
6. **Honest limits.** A static review is not a penetration test or a load test. The report lists what was not checked.

`npm run validate` fails the build if a skill is missing these rules.

## bh-preflight

- Reads files only. No writes, no network calls, no telemetry.
- Skips `node_modules`, build output and files over 1 MB.
- Secrets it finds are redacted (first 4 characters and the length).
- Untracked, git-ignored `.env` files are not reported as leaks.

## install.sh

- `--dry-run` lists every file and destination and writes nothing.
- Without `--yes`, it asks you to type `yes`; in a non-interactive shell it refuses to write.
- It never overwrites a file it did not install (tracked in a small manifest) unless you pass `--force`.
- `--uninstall` removes only the files in that manifest and its own block in `AGENTS.md`.
- `--with-ecc` runs ECC's own official installer (`npx ecc-universal@<version> install --profile minimal --target <tool>`). It is opt-in and shown in the dry run first.
