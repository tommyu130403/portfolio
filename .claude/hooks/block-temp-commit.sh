#!/bin/sh
# block-temp-commit.sh — PreToolUse(Bash)。temp/ ブランチでの git commit をブロックする。
#
# CLAUDE.md §3: temp/ は作業内容が未定のときの一時ブランチ。コミット前に
# git branch -m <type>/<yyyymmdd>-<description> へリネームする。
#
# Claude Code（.claude/settings.json）と Codex（.codex/hooks.json）の両方から
# このスクリプト1本を呼ぶ。ロジックを複製しないこと。
#
# 設計方針: ブランチを判定できなかったときは **安全側（deny）に倒す**。
# 判定不能を「問題なし」として通すと、ガードが黙って無効化されるため。

deny() {
  jq -n --arg r "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

# `git commit` / `git -C path commit` / `foo && git commit` などを拾う
printf '%s' "$CMD" \
  | grep -qE '(^|[[:space:];&|(])git([[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)' \
  || exit 0

# リポジトリ位置はスクリプト自身の場所から解決する。呼び出し元の cwd や
# CLAUDE_PROJECT_DIR の有無（Codex では未設定）に依存させない。
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || SCRIPT_DIR=""
ROOT=$(git -C "${SCRIPT_DIR:-.}" rev-parse --show-toplevel 2>/dev/null)
[ -n "$ROOT" ] || deny "git リポジトリを特定できなかったため、安全側に倒してコミットをブロックしました。リポジトリ内から実行しているか確認してください。"

BRANCH=$(git -C "$ROOT" branch --show-current 2>/dev/null)
GIT_STATUS=$?
[ "$GIT_STATUS" -eq 0 ] || deny "現在のブランチを取得できなかったため（git が異常終了）、安全側に倒してコミットをブロックしました。"

# BRANCH が空 かつ git は成功 = detached HEAD。temp/ ではないので通す。
printf '%s' "$BRANCH" | grep -q '^temp/' || exit 0

deny "現在のブランチが temp/ で始まっています($BRANCH)。CLAUDE.md §3 に従い、git branch -m <type>/<yyyymmdd>-<description> でリネームしてからコミットしてください。"
