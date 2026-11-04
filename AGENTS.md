# AGENTS.md: BlitzHash Senior Engineer Skills

Instructions for AI coding agents (Claude Code, Cursor, Codex, Qoder, Antigravity, Windsurf, Copilot and others) working on this repo or using its skills on a user's project.

## What this repo is

Production skills, agents and slash commands for founders who build apps with AI tools, built on [ECC](https://github.com/affaan-m/ECC) and meant to be installed alongside it. Plus `bh-preflight`, a read-only, offline launch-readiness scanner.

| Task | Skill | Command |
|---|---|---|
| Is my app ready to launch? What first? | `skills/launch-readiness-audit` | `/launch-check` |
| Leaked keys, auth, headers, CORS, rate limits | `skills/production-security-review` | `/security-check` |
| Slow pages, timeouts, launch spike | `skills/scaling-performance-review` | |
| Bills too high, spend alerts | `skills/cloud-cost-cutting` | `/cost-check` |
| Protect the site at the edge | `skills/cloudflare-hardening` | |
| Move to a VPS / Docker | `skills/self-hosting-migration` | |
| Prove backups work | `skills/backup-restore-drill` | `/backup-drill` |

## Non-negotiable safety rules

1. Read-only first. Show findings before proposing changes.
2. Every change is a dry run first: show the exact diff, command or API request.
3. Apply only after the user says an explicit "yes" to that plan.
4. Credentials only from the user's environment or a git-ignored `.env`, scoped to the task. Never ask for keys in chat, never print or commit them.
5. No destructive commands without a separate confirmation and a rollback step.
6. Never claim an app is secure or ready; say what was checked and what was not.

## Working on the code

- Node 18.17+, no dependencies. `npm test` runs the scanner tests, the validator tests and the installer end-to-end tests in temp folders.
- `npm run validate` checks every `SKILL.md` (frontmatter, required sections, safety wording, banned claims, secret-shaped strings).
- Never add real keys, even fake ones in a real provider format, to the repo. Test fixtures build fake keys at runtime (`examples/make-demo-app.mjs`).
- Do not copy ECC files into this repo. Reference ECC skills by name and link to ECC.
