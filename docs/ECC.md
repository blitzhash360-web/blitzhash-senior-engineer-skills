# How this pack relates to ECC

[ECC](https://github.com/affaan-m/ECC) by Affaan Mustafa is an MIT-licensed agent harness system: hundreds of skills, agents, commands, rules and hooks for Claude Code, Codex, Cursor, Qoder, Antigravity and more.

This pack is **built on ECC and for ECC users**. It is an independent BlitzHash project, not part of ECC and not affiliated with or endorsed by its author.

## What we add

ECC covers engineering practice in depth (code review, TDD, security patterns, language packs). Founders who build with Lovable, Bolt, Replit, Cursor or v0 also need a senior engineer's production pass in plain English: what to fix before launch, what will cost money, what breaks under load, and whether backups really work. That is what these seven skills do. Where ECC already has the deeper tool, our skills hand off to it by name:

| BlitzHash skill | Hands off to ECC |
|---|---|
| `launch-readiness-audit` | `security-review`, `deployment-patterns`, `verification-loop`, `security-reviewer` agent |
| `production-security-review` | `security-review`, `security-scan`, `security-reviewer` agent |
| `scaling-performance-review` | `postgres-patterns`, `database-migrations`, `backend-patterns`, `performance-optimizer` and `database-reviewer` agents |
| `cloud-cost-cutting` | `cost-aware-llm-pipeline` |
| `cloudflare-hardening` | `deployment-patterns`, `security-review` |
| `self-hosting-migration` | `docker-patterns`, `deployment-patterns`, `database-migrations` |
| `backup-restore-drill` | `database-migrations`, `postgres-patterns`, `deployment-patterns` |

## Installing both

ECC: follow [ECC's install guide](https://github.com/affaan-m/ECC#install-ecc) (one install method per tool; do not stack methods). Or let our installer run ECC's official command for you:

```bash
./install.sh --target claude --with-ecc --dry-run   # shows: npx -y ecc-universal@2.2.3 install --profile minimal --target claude
```

Our files use different names from ECC's, live in the same standard folders, and our installer never overwrites a file it did not create.

## What we do not include

No ECC files are copied into this repository, so there are no vendored ECC notices to carry. If that ever changes, the copied files will keep ECC's MIT copyright notice.
