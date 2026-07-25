# .claude/ はこのリポジトリで gitignore 済み・新規 agent 席はセッション再起動で認識される

- 文脈: `.claude/agents/*.md` と `.claude/skills/*/SKILL.md` を新規作成し、席がその場で使えるか確認した。
- 観測:
  - `git check-ignore` で `.claude/agents/shipper.md` が `.gitignore:25 (.claude/)` に一致 → `.claude/` 配下は git 追跡外（ローカルのみ）。CLAUDE.md と learnings/ は追跡される。
  - 稼働中セッションで `subagent_type: 'shipper'` を起動 → `Agent type 'shipper' not found. Available agents: claude, claude-code-guide, Explore, general-purpose, Plan, statusline-setup`。新規席は稼働中セッションに反映されない。
- 結論:
  - 席・skill をチーム共有したい場合のみ `.gitignore` を編集して除外解除が必要（今回はユーザー判断でローカルのみ維持）。
  - 新規 agent 席を作ったら **Claude Code を再起動**してから `/agents` で認識・起動を確認する。稼働中セッションの `subagent_type` では拾えない。
- 事実確認: VERIFIED（2026-07-21、check-ignore と実起動で観測）。
