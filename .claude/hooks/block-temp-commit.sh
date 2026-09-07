#!/bin/sh
# block-temp-commit.sh — PreToolUse(Bash)。temp/ ブランチでの git commit をブロックする。
#
# CLAUDE.md §3-2: temp/ は作業内容が未定のときの一時ブランチ。コミット前に
# git branch -m <type>/<yyyymmdd>-<description> へリネームする。
#
# Claude Code（.claude/settings.json）と Codex（.codex/hooks.json）の両方から
# このスクリプト1本を呼ぶ。ロジックを複製しないこと。

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

# `git commit` / `git -C path commit` / `foo && git commit` などを拾う
printf '%s' "$CMD" \
  | grep -qE '(^|[[:space:];&|(])git([[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)' \
  || exit 0

BRANCH=$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null)
printf '%s' "$BRANCH" | grep -q '^temp/' || exit 0

jq -n --arg b "$BRANCH" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: (
      "現在のブランチが temp/ で始まっています(" + $b +
      ")。CLAUDE.md §3-2 に従い、git branch -m <type>/<yyyymmdd>-<description> でリネームしてからコミットしてください。"
    )
  }
}'
