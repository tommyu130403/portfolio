# Portfolio Project - Claude Guidelines

## Project Overview
Next.js portfolio site. Components are in `/components/`, pages in `/app/`.

## Commit Rules

Format: `<type>: <description>`

| Type | Usage |
|------|-------|
| `feat` | New feature or component |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `style` | Styling, CSS changes |
| `chore` | Build config, dependencies |
| `docs` | Documentation only |

Example: `feat: HistoryItemコンポーネントを追加`

## Branch Rules

Format: `<type>/<yyyymmdd>-<description>`

| Type | Usage |
|------|-------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Refactoring |
| `chore/` | Maintenance |
| `temp/` | Work content not yet decided |

Examples:
- `feat/20260310-project-card-component`
- `fix/20260310-icon-path`
- `refactor/20260310-extract-page-components`

Main branch: `main`

When creating a new branch, always update main first:
```bash
git checkout main
git pull origin main
git checkout -b <type>/<yyyymmdd>-<description>
```

### Git Operation Rules

**基本運用事項:**
- すでにPRが作成された作業ブランチで、追跡ファイルがなく差分がない状態で新しい指示や作業を開始しようとした場合、新規ブランチを作成するか必ず確認すること
- ブランチ作成の指示に作業内容が含まれていない場合は、作業内容を確認せず `temp/<yyyymmdd>-work` の命名でブランチを作成すること

**原則禁止事項:**
- mainブランチでの作業（作業指示があった場合は、そのまま続行してよいか必ず確認すること）
- mainブランチの変更をそのままpushすること

## Style Guide Auto-Update Rules

When making changes that affect the following files, **always update the style guide** (`app/styleguide/StyleguideLayout.tsx`) in the same task:

| Trigger | Required action |
|---------|----------------|
| New file added to `components/` | Add import + `<ComponentPreview>` entry to `ComponentsSection` |
| Existing component props / variants changed | Update the corresponding `<ComponentPreview>` example in `ComponentsSection` |
| `lib/design-tokens.ts` token added / removed | Update the relevant section in `StyleguideLayout.tsx` (Colors / Tokens) |
| `app/globals.css` `@theme` block changed | Verify the color / radius swatches in the style guide still reflect the values |

No update is needed when:
- Only internal component logic changes (no prop API or visual change)
- Changes are inside `app/` pages unrelated to the design system

## 🤖 Execution Guidelines (Automation vs. Manual Approval)

Claude Codeがタスクを実行する際、自動実行（無条件での実行や `-auto-run` フラグの適用）を許可する作業と、必ず開発者の確認および明示的な承認を求める作業を以下のように定義する。

### 🟢 1. 自動実行を許可する作業 (Auto-Run Allowed)
以下の作業については、毎回開発者の許可を求めず、自律的にコマンド実行やファイルの書き換えを行ってよい。

- **静的解析・型チェックの実行:** `npm run lint` や `tsc --noEmit` などの実行。
- **ローカルテストの実行:** 既存のテストスイート（Vitest / Jestなど）の実行と結果の確認。
- **デザイン・スタイルの微調整:** CSS、Tailwind CSSのクラス修正、Storybookなどのコンポーネントの見た目に関する調整。
- **ドキュメントの更新:** README、インラインコメント、型定義（JSDocなど）の追加・修正。
- **軽微なバグ修正:** 変数名の誤字脱字の修正や、影響範囲が単一コンポーネント内に閉じており、既存のテストがパスする修正。

### 🔴 2. 必須確認・承認を要する作業 (Manual Approval Required)
以下の作業を行う、または提案する場合は、**コマンドを実行したりファイルを破壊的に書き換えたりする前に、必ず開発者に確認（プロンプトでの停止や提案内容の提示）**を行うこと。

- **依存関係の変更:** `package.json` への新しいパッケージの追加（`npm install`）、主要なライブラリのアップデート。
- **非破壊的でないスキーマの変更:** Supabase/SQLなどのマイグレーションファイルの生成や実行、データベース構造の変更。
- **認証・セキュリティに関わる実装:** Supabase Auth、行レベルセキュリティ（RLS）ポリシーの変更、APIルートの認証ロジックの修正。
- **環境変数の操作:** `.env` ファイルの変更、新しい環境変数の導入提案（※シークレット情報は入力させないこと）。
- **ビルド設定・ツールの変更:** Vite、TypeScript、GitHub Actionsなどの設定ファイル（`vite.config.ts`、`tsconfig.json`、`.github/workflows/*`）の変更。
- **破壊的変更・リファクタリング:** 既存の複数コンポーネントにまたがる共通ロジックの変更や、既存のインターフェース・API仕様を破壊する修正。

### 💡 行動指針
- 上記の「🟢 自動実行を許可する作業」に該当する場合は、`-auto-run` モードでの効率的な実行を推奨する。
- 「🔴 必須確認・承認を要する作業」に1つでも該当、または判断に迷う場合は、作業を一時停止し、変更内容のサマリーと理由を開発者に提示して承認を得ること。

## Project Structure

```
app/          - Next.js pages
components/   - Reusable UI components
src/components/ - Additional components (SkillsRadarChart)
public/       - Static assets
```
