#!/usr/bin/env bash
# Install a bash PROMPT_COMMAND that prints a RED warning if:
#   - working tree is dirty (uncommitted changes), or
#   - current branch is ahead of origin.
# Idempotent: safe to run multiple times (skips if block already in ~/.bashrc).
# WSL/Linux only; appends to ~/.bashrc.
#
# UNINSTALL: Remove the block between "# --- git prompt guard (start) ---"
#            and "# --- git prompt guard (end) ---" from ~/.bashrc.

set -e

MARKER_START="# --- git prompt guard (start) ---"
MARKER_END="# --- git prompt guard (end) ---"
BASHRC="${HOME}/.bashrc"

if [ ! -f "$BASHRC" ]; then
  touch "$BASHRC"
fi

if grep -qF "$MARKER_START" "$BASHRC" 2>/dev/null; then
  echo "Git prompt guard already installed in ~/.bashrc (idempotent skip)."
  exit 0
fi

BLOCK=$(cat << 'GUARD_BLOCK'

# --- git prompt guard (start) ---
_git_prompt_guard() {
  local dir="$PWD" warn=""
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if [ -n "$(git status --porcelain)" ]; then
      warn="[DIRTY]"
    fi
    if git status -sb 2>/dev/null | grep -qE '\[.*ahead'; then
      warn="${warn}[AHEAD]"
    fi
    if [ -n "$warn" ]; then
      printf '\033[31m%s Git: %s — commit and push.\033[0m\n' "$warn" "$dir" >&2
    fi
  fi
}
PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND; }_git_prompt_guard"
# --- git prompt guard (end) ---
GUARD_BLOCK
)

echo "$BLOCK" >> "$BASHRC"
echo "Git prompt guard installed. Open a new terminal (or run: source ~/.bashrc) to see warnings when dirty or ahead."
echo "To uninstall: remove the block between the two 'git prompt guard' markers in ~/.bashrc."
