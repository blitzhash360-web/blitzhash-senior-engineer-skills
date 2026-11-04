#!/usr/bin/env bash
# BlitzHash Senior Engineer Skills installer (built on ECC, for ECC users and anyone else).
# Copies skills/agents/commands into the folders each AI coding tool reads.
# Dry run shows every file first; nothing is written until you confirm.
set -euo pipefail

VERSION="1.0.0"
PACK="blitzhash-senior-engineer-skills"
ECC_VERSION="${ECC_VERSION:-2.2.3}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGETS_ALL="claude cursor codex qoder antigravity agents-md"
BEGIN_MARK="<!-- BEGIN $PACK -->"
END_MARK="<!-- END $PACK -->"

usage() {
  cat <<USAGE
BlitzHash Senior Engineer Skills installer v$VERSION

Usage: ./install.sh --target <tool>[,<tool>...] [options]

Targets:
  claude        Claude Code   .claude/skills, .claude/agents, .claude/commands
  cursor        Cursor        .cursor/skills, .cursor/agents, .cursor/commands, .cursor/rules
  codex         Codex         .agents/skills + AGENTS.md block (global: ~/.agents/skills, ~/.codex/prompts)
  qoder         Qoder         .qoder/skills, .qoder/agents, .qoder/commands
  antigravity   Antigravity   .agents/skills, .agents/agents, .agents/workflows (project only)
  agents-md     Any IDE that reads AGENTS.md (Windsurf, Zed, Copilot, Jules, ...): .agents/skills + AGENTS.md block
  all           Every target above

Options:
  --project DIR   Project to install into (default: current folder)
  --global        Install for your user (~/.claude, ~/.cursor, ~/.agents, ~/.qoder) instead of one project
  --dry-run       Show exactly what would be written, write nothing
  --yes           Skip the confirmation prompt (needed in non-interactive shells)
  --force         Overwrite files that exist but were not installed by this pack
  --with-ecc      Also run ECC's official installer (npx ecc-universal@$ECC_VERSION install --profile minimal)
  --uninstall     Remove only the files this pack installed (uses the manifest)
  -h, --help      Show this help

Examples:
  ./install.sh --target cursor --dry-run
  ./install.sh --target claude,codex --project ~/code/my-app
  ./install.sh --target all --global --dry-run
USAGE
}

die() { echo "install.sh: $*" >&2; exit 2; }

TARGETS=""; PROJECT="$PWD"; GLOBAL=0; DRY=0; YES=0; FORCE=0; WITH_ECC=0; UNINSTALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --target|-t) [ $# -ge 2 ] || die "--target needs a value"; TARGETS="$2"; shift 2 ;;
    --target=*) TARGETS="${1#*=}"; shift ;;
    --project) [ $# -ge 2 ] || die "--project needs a folder"; PROJECT="$2"; shift 2 ;;
    --project=*) PROJECT="${1#*=}"; shift ;;
    --global) GLOBAL=1; shift ;;
    --dry-run|-n) DRY=1; shift ;;
    --yes|-y) YES=1; shift ;;
    --force) FORCE=1; shift ;;
    --with-ecc) WITH_ECC=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
done
[ -n "$TARGETS" ] || { usage; die "choose a --target"; }
[ "$TARGETS" = "all" ] && TARGETS="$TARGETS_ALL"
TARGETS="$(echo "$TARGETS" | tr ',' ' ')"
for t in $TARGETS; do
  case " $TARGETS_ALL " in *" $t "*) ;; *) die "unknown target: $t" ;; esac
done
[ -d "$SRC/skills" ] || die "run this from a clone of $PACK (skills/ not found next to install.sh)"

if [ "$GLOBAL" = 1 ]; then BASE="${HOME:?}"; SCOPE="global (~)"; else
  [ -d "$PROJECT" ] || die "project folder not found: $PROJECT"
  BASE="$(cd "$PROJECT" && pwd)"; SCOPE="project ($BASE)"
fi

# ---- plan -------------------------------------------------------------------
# Each plan line: action<TAB>src<TAB>dest<TAB>manifest
PLAN_FILE="$(mktemp)"; trap 'rm -f "$PLAN_FILE"' EXIT
SKILLS="$(for d in "$SRC"/skills/*/; do basename "$d"; done)"
AGENTS="$(cd "$SRC/agents" && ls -- *.md)"
COMMANDS="$(cd "$SRC/commands" && ls -- *.md)"

in_manifest() { [ -f "$1" ] && grep -qxF "$2" "$1"; }

plan_copy() { # src dest manifest
  local src="$1" dest="$2" man="$3" state
  if [ ! -e "$dest" ]; then state="new"
  elif cmp -s "$src" "$dest"; then state="same"
  elif in_manifest "$man" "$dest"; then state="update"
  elif [ "$FORCE" = 1 ]; then state="overwrite"
  else state="conflict"; fi
  printf '%s\t%s\t%s\t%s\n' "$state" "$src" "$dest" "$man" >> "$PLAN_FILE"
}

plan_skills() { # root manifest
  local s
  for s in $SKILLS; do plan_copy "$SRC/skills/$s/SKILL.md" "$1/$s/SKILL.md" "$2"; done
}
plan_dir_md() { # srcdir names destdir manifest
  local n
  for n in $2; do plan_copy "$SRC/$1/$n" "$3/$n" "$4"; done
}
plan_agents_block() { # AGENTS.md path, skills dir label, manifest
  local f="$1"
  if [ -f "$f" ] && grep -qF "$BEGIN_MARK" "$f"; then
    if agents_block "$2" | cmp -s - <(sed -n "/$BEGIN_MARK/,/$END_MARK/p" "$f"); then
      printf 'same\t(AGENTS.md block)\t%s\t%s\n' "$f" "$3" >> "$PLAN_FILE"
    else printf 'update\t(AGENTS.md block)\t%s\t%s\n' "$f" "$3" >> "$PLAN_FILE"; fi
  else printf 'append\t(AGENTS.md block)\t%s\t%s\n' "$f" "$3" >> "$PLAN_FILE"; fi
}

agents_block() { # skills dir label
  local s d
  echo "$BEGIN_MARK"
  echo "## BlitzHash Senior Engineer Skills (production checks)"
  echo ""
  echo "Skills in \`$1/\` (read the SKILL.md before acting). Built on ECC: https://github.com/affaan-m/ECC"
  echo ""
  for s in $SKILLS; do
    d="$(sed -n 's/^description: //p' "$SRC/skills/$s/SKILL.md" | head -n1 | cut -d. -f1)"
    echo "- \`$s\`: $d."
  done
  echo ""
  echo "Rules: read-only first; dry run every change; apply only after the user says yes; credentials only from the user's environment, scoped, never printed or committed."
  echo "$END_MARK"
}

for t in $TARGETS; do
  case "$t" in
    claude)
      R="$BASE/.claude"; M="$R/.$PACK.manifest"
      plan_skills "$R/skills" "$M"; plan_dir_md agents "$AGENTS" "$R/agents" "$M"; plan_dir_md commands "$COMMANDS" "$R/commands" "$M" ;;
    cursor)
      R="$BASE/.cursor"; M="$R/.$PACK.manifest"
      plan_skills "$R/skills" "$M"; plan_dir_md agents "$AGENTS" "$R/agents" "$M"; plan_dir_md commands "$COMMANDS" "$R/commands" "$M"
      [ "$GLOBAL" = 1 ] || plan_copy "$SRC/integrations/cursor/blitzhash-senior-engineer.mdc" "$R/rules/blitzhash-senior-engineer.mdc" "$M" ;;
    codex)
      if [ "$GLOBAL" = 1 ]; then
        M="$BASE/.agents/.$PACK.manifest"
        plan_skills "$BASE/.agents/skills" "$M"; plan_dir_md commands "$COMMANDS" "$BASE/.codex/prompts" "$M"
      else
        M="$BASE/.agents/.$PACK.manifest"
        plan_skills "$BASE/.agents/skills" "$M"; plan_agents_block "$BASE/AGENTS.md" ".agents/skills" "$M"
      fi ;;
    qoder)
      R="$BASE/.qoder"; M="$R/.$PACK.manifest"
      plan_skills "$R/skills" "$M"; plan_dir_md agents "$AGENTS" "$R/agents" "$M"; plan_dir_md commands "$COMMANDS" "$R/commands" "$M" ;;
    antigravity)
      if [ "$GLOBAL" = 1 ]; then echo "note: antigravity is installed per project (.agents/); skipped for --global" >&2; continue; fi
      R="$BASE/.agents"; M="$R/.$PACK.manifest"
      plan_skills "$R/skills" "$M"; plan_dir_md agents "$AGENTS" "$R/agents" "$M"; plan_dir_md commands "$COMMANDS" "$R/workflows" "$M" ;;
    agents-md)
      if [ "$GLOBAL" = 1 ]; then echo "note: agents-md is installed per project; skipped for --global" >&2; continue; fi
      M="$BASE/.agents/.$PACK.manifest"
      plan_skills "$BASE/.agents/skills" "$M"; plan_agents_block "$BASE/AGENTS.md" ".agents/skills" "$M" ;;
  esac
done
# Targets can share folders (.agents/skills): keep the first plan line per destination.
awk -F'\t' '!seen[$3]++' "$PLAN_FILE" > "$PLAN_FILE.u" && mv "$PLAN_FILE.u" "$PLAN_FILE"

rel() { case "$1" in "$BASE"/*) echo "${1#"$BASE"/}" ;; *) echo "$1" ;; esac; }

ecc_detect() {
  local d
  for d in "$BASE/.claude/skills" "$HOME/.claude/skills" "$BASE/.cursor/skills" "$BASE/.cursor/rules" "$BASE/.agents/skills" "$HOME/.agents/skills" "$BASE/.qoder/skills"; do
    [ -d "$d" ] || continue
    if grep -rqs "origin: ECC" "$d" 2>/dev/null; then echo "$d"; return 0; fi
  done
  [ -d "$HOME/.claude/plugins" ] && grep -rqls '"ecc@ecc"\|affaan-m/ECC' "$HOME/.claude/plugins" 2>/dev/null && { echo "$HOME/.claude/plugins"; return 0; }
  return 1
}

ecc_target() { case "$1" in claude|cursor|codex|antigravity) echo "$1" ;; *) echo "" ;; esac; }

# ---- uninstall ----------------------------------------------------------------
if [ "$UNINSTALL" = 1 ]; then
  echo "BlitzHash Senior Engineer Skills: uninstall from $SCOPE"
  N=0; LIST="$(mktemp)"
  while IFS=$'\t' read -r _ _ dest man; do
    if [ "$(basename "$dest")" = "AGENTS.md" ] && [ -f "$dest" ] && grep -qF "$BEGIN_MARK" "$dest"; then
      echo "  remove block  $(rel "$dest")"; echo "$dest" >> "$LIST"; N=$((N+1))
    elif in_manifest "$man" "$dest" && [ -f "$dest" ]; then
      echo "  remove        $(rel "$dest")"; echo "$dest" >> "$LIST"; N=$((N+1))
    fi
  done < "$PLAN_FILE"
  if [ "$N" = 0 ]; then echo "Nothing to remove."; rm -f "$LIST"; exit 0; fi
  if [ "$DRY" = 1 ]; then echo "DRY RUN: nothing was removed. $N item(s) would be removed."; rm -f "$LIST"; exit 0; fi
  if [ "$YES" != 1 ]; then
    [ -t 0 ] || die "not interactive: re-run with --yes after reviewing the --dry-run output"
    printf 'Remove %s item(s)? Type "yes" to continue: ' "$N"; read -r ans; [ "$ans" = "yes" ] || { echo "Cancelled."; exit 1; }
  fi
  while read -r f; do
    if [ "$(basename "$f")" = "AGENTS.md" ]; then
      sed -i.bak "/$BEGIN_MARK/,/$END_MARK/d" "$f" && rm -f "$f.bak"
    else rm -f "$f"; rmdir "$(dirname "$f")" 2>/dev/null || true; fi
  done < "$LIST"
  rm -f "$LIST"
  find "$BASE" -maxdepth 2 -name ".$PACK.manifest" -type f -exec rm -f {} + 2>/dev/null || true
  echo "Removed $N item(s)."; exit 0
fi

# ---- show plan ----------------------------------------------------------------
echo "BlitzHash Senior Engineer Skills v$VERSION (built on ECC, not affiliated with it)"
echo "Install to: $SCOPE"
echo "Targets:    $TARGETS"
echo ""
WRITES=0; CONFLICTS=0; i=0; TOTAL="$(wc -l < "$PLAN_FILE" | tr -d ' ')"
while IFS=$'\t' read -r state src dest _; do
  i=$((i+1))
  case "$state" in
    new|update|overwrite|append) WRITES=$((WRITES+1)) ;;
    conflict) CONFLICTS=$((CONFLICTS+1)) ;;
  esac
  label="$src"; case "$src" in "$SRC"/*) label="${src#"$SRC"/}" ;; esac
  printf '  %-9s %-44s -> %s\n' "$state" "$label" "$(rel "$dest")"
done < "$PLAN_FILE"
echo ""
echo "$TOTAL file(s): $WRITES to write, $CONFLICTS conflict(s) (left untouched; --force to overwrite)."

ECC_CMDS=""
if [ "$WITH_ECC" = 1 ]; then
  for t in $TARGETS; do
    et="$(ecc_target "$t")"
    if [ -n "$et" ]; then ECC_CMDS="$ECC_CMDS
npx -y ecc-universal@$ECC_VERSION install --profile minimal --target $et"
    else echo "ECC: no ECC installer target for '$t'; see https://github.com/affaan-m/ECC#install-ecc"; fi
  done
  ECC_CMDS="$(echo "$ECC_CMDS" | sed '/^$/d' | sort -u)"
  [ -n "$ECC_CMDS" ] && { echo "ECC: will also run ECC's official installer (from $BASE):"; while read -r c; do echo "  $c"; done <<< "$ECC_CMDS"; }
elif found="$(ecc_detect)"; then
  echo "ECC detected ($found). These skills pair with it."
else
  echo "ECC not detected. Recommended alongside: https://github.com/affaan-m/ECC (or re-run with --with-ecc)."
fi

if [ "$DRY" = 1 ]; then
  echo "DRY RUN: nothing was written. Re-run without --dry-run to install (you will be asked to confirm)."
  exit 0
fi
if [ "$WRITES" = 0 ] && [ -z "$ECC_CMDS" ]; then echo "Already up to date."; exit 0; fi
if [ "$YES" != 1 ]; then
  [ -t 0 ] || die "not interactive: review the --dry-run output, then re-run with --yes"
  printf 'Write %s file(s)? Type "yes" to continue: ' "$WRITES"; read -r ans
  [ "$ans" = "yes" ] || { echo "Cancelled. Nothing was written."; exit 1; }
fi

# ---- apply ----------------------------------------------------------------------
while IFS=$'\t' read -r state src dest man; do
  if [ "$src" = "(AGENTS.md block)" ]; then
    case "$state" in
      append)
        sep=""; [ -s "$dest" ] && sep=$'\n'
        { printf '%s' "$sep"; agents_block ".agents/skills"; } >> "$dest" ;;
      update)
        blk="$(mktemp)"; out="$(mktemp)"
        agents_block ".agents/skills" > "$blk"
        awk -v b="$BEGIN_MARK" -v e="$END_MARK" -v f="$blk" \
          'BEGIN { while ((getline l < f) > 0) blk = blk l "\n" } $0 == b { printf "%s", blk; skip = 1; next } $0 == e { skip = 0; next } !skip' \
          "$dest" > "$out"
        cat "$out" > "$dest"; rm -f "$blk" "$out" ;;
    esac
    continue
  fi
  case "$state" in
    new|update|overwrite)
      mkdir -p "$(dirname "$dest")" "$(dirname "$man")"
      cp "$src" "$dest"
      in_manifest "$man" "$dest" || echo "$dest" >> "$man" ;;
  esac
done < "$PLAN_FILE"
echo "Installed. Start a new chat in your tool, then ask: \"Run a launch-readiness audit on this project.\""

if [ -n "$ECC_CMDS" ]; then
  echo "$ECC_CMDS" | while read -r c; do
    [ -n "$c" ] || continue
    read -r -a argv <<< "$c"
    echo "+ $c"; (cd "$BASE" && "${argv[@]}")
  done
fi
