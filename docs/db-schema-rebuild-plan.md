# DB スキーマ再構築 方針

> ステータス: **Phase 0 調査完了（数値は MCP で再検証済み）/ 実装着手前**
> 作成日: 2026-05-31
> 関連: PR #39（スキルセクション刷新）, `docs/schema-skills-tools-refactor.md`

不要になったデータテーブルの削除を含む DB スキーマ再構築の進め方をまとめる。**スキーマ変更（破壊的操作）は CLAUDE.md「🔴 必須確認」に従い、着手前に都度承認を得る。**

> ⚠️ 注記: 初回ドラフトの行数・テーブル有無の一部は `list_tables` の推定値や記載ミスで不正確だった。下表は `pg_class` ＋ `COUNT(*)` で**再実測した確定値**。

---

## 0. Phase 0 調査結果（2026-05-31 / 確定値）

### 0-1. プロジェクトは 2 つ、いずれもアクセス可能
同一組織 `omoahghgfwipmcgrdsfc` 配下。**dev も直接アクセス可能**（別アカウント提供は不要だった）。

| 環境 | ref | 用途 | 作成日 |
|---|---|---|---|
| **prod** | `kljlxjlbetaxhtxqzrdc`（portfolio） | 本番・実データあり。`package.json` の型生成先 | 2025-12-04 |
| **dev** | `aemqzbsofprgmwtpfndf`（portfolio_dev） | ローカル開発用（`NEXT_PUBLIC_DEV_SUPABASE_URL`） | 2026-05-30 |

### 0-2. テーブル構成は両環境とも同一（13 テーブル）／確定行数・RLS

| テーブル | prod 行数 | prod RLS | dev 行数 | dev RLS | コード参照 | 判定 |
|---|---|---|---|---|---|---|
| `profile` | 1 | ✓ | 1 | ✗ | あり | 維持 |
| `career_items` | 5 | ✓ | 2 | ✗ | あり | 維持 |
| `projects` | 4 | ✓ | 2 | ✗ | あり | 維持 |
| `skills_vocab` | 23 | ✓ | 0 | ✗ | あり | 維持 |
| `tools_vocab` | 25 | ✓ | 0 | ✗ | あり | 維持 |
| `project_skills` | 10 | ✓ | 0 | ✗ | あり | 維持 |
| `project_tools` | 14 | ✓ | 0 | ✗ | あり | 維持 |
| `skill_cards` | 6 | ✓ | 2 | ✗ | あり | 維持 |
| `skill_experience` | 11 | ✓ | 0 | ✗ | あり（PR #39） | 維持 |
| `skill_tools` | 19 | ✓ | 0 | ✗ | あり | 維持 |
| `todos` | **1** | ✓ | 0 | ✗ | **なし** | **削除** |
| `user_skills` | **2** | ✓ | 0 | ✗ | admin のみ | **削除**（機能廃止） |
| `skill_level_tokens` | **5** | ✓ | 3 | ✗ | **なし**※ | **削除**（バックアップ後） |

※ `skill_level_tokens` は現行コード（`src/`, `app/`, `lib/`）から参照ゼロ。ヒットするのは重複ディレクトリ `portfolio/src/components/SkillsCardGrid.tsx` のみ（後述の整理対象）。

### 0-3. 🔴 セキュリティ所見: dev は RLS 全無効
- **prod は全 13 テーブルで RLS 有効**（問題なし）
- **dev（portfolio_dev）は全 13 テーブルで RLS 無効** → anon キーで全行 read/write 可能。Supabase advisor も critical 判定
- dev は非本番だが、**スキーマ再構築の baseline に RLS ポリシーを含めて是正**するのが望ましい（自動適用はしない／適用時に内容提示）

### 0-4. マイグレーション履歴の状況
- **prod**: 11 件の独自履歴（`create_*_table` … `drop_projects_skills_tools_columns` … `rename_figma_string_tokens_to_skill_level_tokens` 等）
- **dev**: 2 件（`20260101000000_initial_schema`, `20260322000000_add_profile_career_lead`）＝ repo の `supabase/migrations/` と一致
- → **repo の migration は dev に対応。prod の実履歴とは別物**。prod を正としたベースライン再構築が妥当
- prod の `projects` には `skills`/`tools` カラムは**もう無い**（`drop_projects_skills_tools_columns` 適用済み・SQL 確認済み）。コードの `project.skills`/`.tools` は join テーブルからの派生値

### 0-5. `user_skills`（スキルマトリクス）＝廃止確定
- PR #39 で公開ページのレーダー/レベルチャート廃止。`app/page.tsx` は関連 import なし
- 孤立コンポーネント（どこからも未 import）: `src/components/SkillsRadarChart.tsx`, `src/components/UserSkillsList.tsx`, `components/SkillsRadarChart.tsx`, `components/RadarChart.tsx`
- admin にのみ編集 UI 残存: `app/admin/AdminLayout.tsx`（L28/L2065/L2090）, `app/admin/actions.ts`（`saveUserSkills` L239-）
- → テーブル・孤立コンポーネント・admin 編集 UI・関連 RLS をまとめて削除

---

## 1. 今回のスコープ（確定）

### 1-1. DB スキーマ変更（prod・dev 両方を目標形へ）
- `todos` を DROP（prod 1 行 / dev 0 行）
- `user_skills` を DROP（prod 2 行 / dev 0 行）
- `skill_level_tokens` を DROP（prod 5 行 / dev 3 行・**バックアップ後**）
- **追加・作り直しカラムは無し**（ユーザー確認済み。PR #39 が要求する `skill_experience.segments` は既存）

### 1-2. マイグレーション健全化（ベースライン再構築）
- prod 実スキーマを正として baseline 化し、repo の現行 2 本を置換
- 後段に前進マイグレーション `..._drop_unused_tables.sql`（`DROP TABLE todos, user_skills, skill_level_tokens;` ＋関連 policy）

### 1-3. コード掃除（Phase 5）
- 孤立コンポーネント 4 ファイル削除（radar/user_skills 系）
- admin の user_skills 編集 UI と `saveUserSkills` 削除
- `src/types/supabase.ts` 再生成（削除テーブルが型から消える）
- `app/admin/actions.ts` の stale コメント整理、重複 `portfolio/` ディレクトリの扱い
- `app/styleguide/StyleguideLayout.tsx` への影響確認（CLAUDE.md ルール）

---

## 2. 決定事項
| 論点 | 決定 |
|---|---|
| マイグレーション方針 | ベースライン再構築（実 prod を正に） |
| 適用範囲 | dev のみ先行（本番はレビュー後に別途指示） |
| dev 環境 | 既存 `aemqzbsofprgmwtpfndf` を使用（アクセス済み） |
| 削除テーブル | `todos`, `user_skills`, `skill_level_tokens`（全てバックアップ後） |
| カラム変更 | なし |
| user_skills | 機能ごと完全廃止 |

---

## 3. フェーズ別手順
- **Phase 1 目標スキーマ確定** … 完了（削除 3 テーブル / カラム変更なし）
- **Phase 2 マイグレーション設計** … prod baseline 化 ＋ drop マイグレーション作成（apply 前に承認）
- **Phase 3 dev 検証** … dev に適用 → `npm run dev` 表示確認 → `tsc --noEmit` → 型再生成 diff
- **Phase 4 本番適用**（※別途指示）… **本番バックアップ必須** → apply → `npm run update-types`
- **Phase 5 コード掃除** … §1-3

---

## 4. 安全策
- データ削除は不可逆 → ①バックアップ ②dev 先行 厳守（todos/user_skills/skill_level_tokens は prod に実データあり）
- 本番への apply は明示承認後のみ
- 作業ブランチ: `git checkout main && git pull` 後に `refactor/20260531-db-schema-rebuild`
- スキーマ・RLS 変更・型再生成の各 apply 前に変更サマリを提示し承認（CLAUDE.md 🔴）

---

## 5. 残論点
- [ ] dev の RLS 全無効を baseline で是正するか（prod 同等のポリシーを付与）
- [ ] baseline 化で repo の既存マイグレーション 2 本を削除してよいか
- [ ] dev シード（`supabase/seed.sql`）を削除後のテーブル構成に合わせて更新するか
