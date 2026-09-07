# Claude Code Development Guidelines

**ルールは `CLAUDE.md` を正とする。** このファイルには独自ルールを書かない。差分が出たら CLAUDE.md 側へ寄せる。

門（機械判定）が止めるもの:

| 規約 | 門 |
|------|-----|
| コミット形式 | commitlint（`.husky/commit-msg`） |
| ブランチ名 `<type>/<yyyymmdd>-<description>` | `.husky/pre-push` |
| `temp/` でのコミット | `.claude/hooks/block-temp-commit.sh` |
| 型 / lint / ビルド | `npm run check`（`.github/workflows/check.yml` と Stop hook から同じコマンドが走る） |

コミット前に走らせるのは `npm run check` の1コマンド。テストスイートは存在しないので `npm test` は使わない。
