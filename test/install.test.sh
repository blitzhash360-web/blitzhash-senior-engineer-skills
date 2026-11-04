#!/usr/bin/env bash
# shellcheck disable=SC2016
# End-to-end tests for install.sh in throwaway folders. Never touches your real home or projects.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export HOME="$TMP/home"; mkdir -p "$HOME"
PASS=0
ok() { PASS=$((PASS+1)); echo "ok $PASS - $*"; }
fail() { echo "not ok - $*" >&2; exit 1; }
N_SKILLS=$(find "$ROOT/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')

# 1. dry run writes nothing, for every target
for t in claude cursor codex qoder antigravity agents-md all; do
  P="$TMP/dry-$t"; mkdir -p "$P"
  out="$("$ROOT/install.sh" --target "$t" --project "$P" --dry-run)"
  echo "$out" | grep -q "DRY RUN: nothing was written" || fail "dry run message ($t)"
  [ -z "$(ls -A "$P")" ] || fail "dry run wrote files ($t)"
done
ok "dry run writes nothing for every target"

# 2. non-interactive without --yes refuses
P="$TMP/refuse"; mkdir -p "$P"
if "$ROOT/install.sh" --target claude --project "$P" < /dev/null > /dev/null 2>&1; then fail "should refuse without --yes"; fi
[ -z "$(ls -A "$P")" ] || fail "refused install still wrote files"
ok "refuses to write in a non-interactive shell without --yes"

# 3. real install, every target
P="$TMP/app"; mkdir -p "$P"; printf '# My project\n\nExisting agent notes.\n' > "$P/AGENTS.md"
"$ROOT/install.sh" --target all --project "$P" --yes > "$TMP/install.log"
for d in .claude/skills .cursor/skills .agents/skills .qoder/skills; do
  n=$(find "$P/$d" -name SKILL.md | wc -l | tr -d ' ')
  [ "$n" = "$N_SKILLS" ] || fail "$d has $n skills, want $N_SKILLS"
done
for f in .claude/agents/launch-readiness-lead.md .claude/commands/launch-check.md .cursor/agents/launch-readiness-lead.md \
         .cursor/commands/launch-check.md .cursor/rules/blitzhash-senior-engineer.mdc .qoder/agents/launch-readiness-lead.md \
         .qoder/commands/launch-check.md .agents/agents/launch-readiness-lead.md .agents/workflows/launch-check.md; do
  [ -f "$P/$f" ] || fail "missing $f"
done
cmp -s "$ROOT/skills/launch-readiness-audit/SKILL.md" "$P/.claude/skills/launch-readiness-audit/SKILL.md" || fail "copied skill differs"
grep -q "Existing agent notes." "$P/AGENTS.md" || fail "AGENTS.md lost existing content"
[ "$(grep -c "BEGIN blitzhash-senior-engineer-skills" "$P/AGENTS.md")" = 1 ] || fail "AGENTS.md block count"
ok "installs skills, agents, commands, rules and AGENTS.md block for all targets"

# 4. idempotent
out="$("$ROOT/install.sh" --target all --project "$P" --yes)"
echo "$out" | grep -q "Already up to date." || fail "second run not idempotent"
[ "$(grep -c "BEGIN blitzhash-senior-engineer-skills" "$P/AGENTS.md")" = 1 ] || fail "AGENTS.md block duplicated"
ok "second run is a no-op"

# 5. does not overwrite a file it did not install
P2="$TMP/conflict"; mkdir -p "$P2/.claude/skills/launch-readiness-audit"
echo "user's own skill" > "$P2/.claude/skills/launch-readiness-audit/SKILL.md"
out="$("$ROOT/install.sh" --target claude --project "$P2" --yes)"
echo "$out" | grep -q "conflict" || fail "conflict not reported"
grep -q "user's own skill" "$P2/.claude/skills/launch-readiness-audit/SKILL.md" || fail "overwrote user file"
ok "leaves files it does not own untouched"

# 6. updates its own files and the AGENTS.md block
echo "<!-- stale -->" >> "$P/.claude/skills/backup-restore-drill/SKILL.md"
sed -i.bak 's/^- `backup-restore-drill`.*/- old line/' "$P/AGENTS.md" && rm -f "$P/AGENTS.md.bak"
out="$("$ROOT/install.sh" --target claude,codex --project "$P" --yes)"
echo "$out" | grep -q "update" || fail "update not planned"
cmp -s "$ROOT/skills/backup-restore-drill/SKILL.md" "$P/.claude/skills/backup-restore-drill/SKILL.md" || fail "own file not updated"
grep -q '^- `backup-restore-drill`' "$P/AGENTS.md" || fail "AGENTS.md block not refreshed"
grep -q "Existing agent notes." "$P/AGENTS.md" || fail "AGENTS.md refresh lost content"
ok "updates its own files and refreshes the AGENTS.md block"

# 7. --with-ecc dry run prints ECC's official installer, runs nothing
out="$("$ROOT/install.sh" --target claude,cursor,qoder --project "$TMP/dry-claude" --with-ecc --dry-run)"
echo "$out" | grep -q "npx -y ecc-universal@2.2.3 install --profile minimal --target claude" || fail "ECC claude command"
echo "$out" | grep -q "npx -y ecc-universal@2.2.3 install --profile minimal --target cursor" || fail "ECC cursor command"
echo "$out" | grep -q "no ECC installer target for 'qoder'" || fail "qoder ECC note"
ok "--with-ecc dry run shows ECC's own installer commands"

# 8. global install into (fake) HOME
"$ROOT/install.sh" --target claude,codex,cursor,qoder --global --yes > /dev/null
[ -f "$HOME/.claude/skills/cloud-cost-cutting/SKILL.md" ] || fail "global claude"
[ -f "$HOME/.agents/skills/cloud-cost-cutting/SKILL.md" ] || fail "global codex skills"
[ -f "$HOME/.codex/prompts/launch-check.md" ] || fail "global codex prompts"
[ -f "$HOME/.qoder/skills/cloud-cost-cutting/SKILL.md" ] || fail "global qoder"
[ ! -e "$HOME/.cursor/rules" ] || fail "global cursor should not write rules"
ok "global install for Claude Code, Codex, Cursor and Qoder"

# 9. uninstall removes only our files
echo "keep me" > "$P/.claude/skills/my-own.md"
"$ROOT/install.sh" --target all --project "$P" --uninstall --dry-run | grep -q "DRY RUN: nothing was removed" || fail "uninstall dry run"
"$ROOT/install.sh" --target all --project "$P" --uninstall --yes > /dev/null
[ -z "$(find "$P" -name SKILL.md)" ] || fail "skills left after uninstall"
[ -f "$P/.claude/skills/my-own.md" ] || fail "uninstall removed a user file"
grep -q "BEGIN blitzhash" "$P/AGENTS.md" && fail "AGENTS.md block left"
grep -q "Existing agent notes." "$P/AGENTS.md" || fail "uninstall damaged AGENTS.md"
ok "uninstall removes only what it installed"

# 10. bad input
if "$ROOT/install.sh" --target vim --dry-run > /dev/null 2>&1; then fail "accepted unknown target"; fi
ok "rejects unknown targets"
echo "# $PASS install tests passed"
