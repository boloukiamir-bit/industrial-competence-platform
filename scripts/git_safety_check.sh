#!/usr/bin/env bash
# Git Safety Check: fail if uncommitted changes or branch ahead of upstream.
# Used by: npm run git:safety and npm run ship.
# Exit: 0 = clean and synced; 1 = dirty or ahead (with fix instructions).

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not a git repo." >&2; exit 1; }
cd "$REPO_ROOT"

FAIL=0
MSG=""

# a) Uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  FAIL=1
  MSG="${MSG}Working tree has uncommitted changes.\n"
fi

# b) Branch ahead of upstream
STATUS_SB="$(git status -sb 2>/dev/null)"
if echo "$STATUS_SB" | grep -qE '\[.*ahead'; then
  FAIL=1
  MSG="${MSG}Current branch has commits not pushed to upstream.\n"
fi

if [ "$FAIL" -eq 1 ]; then
  echo "Git safety check FAILED." >&2
  printf "%b" "$MSG" >&2
  echo "Fix and try again:" >&2
  echo "  git add -A" >&2
  echo "  git commit -m \"<your message>\"" >&2
  echo "  git push" >&2
  exit 1
fi

echo "Git safety OK: clean and synced with upstream."
exit 0
