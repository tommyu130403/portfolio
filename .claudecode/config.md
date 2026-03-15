# Claude Code Development Guidelines

## 1. Branching Strategy

- **No direct commits to `main` or `develop`**: 必ず `feat/`, `fix/`, `refactor/`, `chore/`, `temp/` プレフィックスをつけた新規ブランチで作業すること。
  - ブランチ命名フォーマットは `CLAUDE.md` の Branch Rules に従う: `<type>/<yyyymmdd>-<description>`
- **Fresh Start**: 作業開始前に必ず以下を実行し、最新の状態からブランチを切ること。
  ```bash
  git checkout main
  git pull origin main
  git checkout -b <type>/<yyyymmdd>-<description>
  ```

## 2. Coding & Testing Workflow

- **Pre-commit Checks**: コミット前に必ず `npm test`（またはプロジェクト標準のテスト）と lint を実行し、エラーがないことを確認すること。
- **Atomic Commits**: 1つのブランチで複数の無関係な修正を行わない。
- **Cleanup**: `console.log` や一時的なデバッグコードはコミット前に必ず削除すること。

## 3. Pull Request Protocol

- **Draft PRs**: 作業完了後は `gh pr create --draft` を使用してプルリクエストを作成すること。
- **Conventional Commits**: コミットメッセージは `CLAUDE.md` の Commit Rules に定めた形式（`feat:`, `fix:`, `chore:`, `docs:` 等）に従うこと。

## 4. Environment & Safety

- 環境変数が含まれるファイル（`.env` 等）をコミットに含めないよう、常に `git status` で確認すること。
