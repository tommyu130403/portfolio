# Dev Supabase セットアップ 実装プロンプト

## 前提・現状

- **テーブル構成**（`src/types/supabase.ts` が正とする）
  - `profile` — サイト基本情報（1行）
  - `career_items` — 職歴一覧
  - `skill_level_tokens` — デザイントークン（スキルレベル）
- **既存 migration**: `supabase/migrations/20260322000000_add_profile_career_lead.sql`
  - これは `ALTER TABLE profile ADD COLUMN career_lead` のみ
  - **ベーススキーマ migration がない**ため、先にそれを作る必要がある
- **Dev project ref**: `aemqzbsofprgmwtpfndf`（`NEXT_PUBLIC_DEV_SUPABASE_URL` から）
- **Supabase CLI** はまだ初期化されていない（`supabase/config.toml` なし）

---

## タスク

以下の順番で実装してください。

---

### Step 1: Supabase CLI インストール確認・初期化

```bash
# CLI が入っているか確認
supabase --version

# 入っていなければインストール（macOS）
brew install supabase/tap/supabase

# プロジェクトルートで初期化
supabase init
```

`supabase/config.toml` が生成されたことを確認する。

---

### Step 2: ベーススキーマ migration ファイルを作成

`supabase/migrations/20260101000000_initial_schema.sql` を新規作成してください。

内容は `src/types/supabase.ts` の型定義を正として、以下の3テーブルを `CREATE TABLE IF NOT EXISTS` で定義する：

**`profile` テーブル:**
- `id` BIGSERIAL PRIMARY KEY
- `name_jp` TEXT NOT NULL DEFAULT ''
- `name_en` TEXT NOT NULL DEFAULT ''
- `title` TEXT NOT NULL DEFAULT ''
- `bio` TEXT NOT NULL DEFAULT ''
- `hero_image_url` TEXT NOT NULL DEFAULT ''
- `introduction` JSONB NOT NULL DEFAULT '{}'
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- ※ `career_lead` は後続 migration で追加されるので**ここには含めない**

**`career_items` テーブル:**
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `company` TEXT NOT NULL DEFAULT ''
- `role` TEXT NOT NULL DEFAULT ''
- `period` TEXT NOT NULL DEFAULT ''
- `description` TEXT NOT NULL DEFAULT ''
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `created_at` TIMESTAMPTZ DEFAULT NOW()

**`skill_level_tokens` テーブル:**
- `key` TEXT PRIMARY KEY
- `value` TEXT NOT NULL DEFAULT ''
- `mode` TEXT NOT NULL DEFAULT ''
- `description` TEXT NOT NULL DEFAULT ''
- `scopes` TEXT[]
- `figma_type` TEXT
- `figma_variable_id` TEXT
- `is_override` BOOLEAN DEFAULT FALSE
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

ファイルを作成したら、**既存 migration との順番が正しいこと**（`20260101...` → `20260322...` の順）を確認する。

---

### Step 3: シードデータファイルを作成

`supabase/seed.sql` を新規作成してください。

dev 環境用のサンプルデータを INSERT する。本番データのコピーではなく、**開発・動作確認に十分なダミーデータ**とする。

**`profile`（1行）:**
```sql
INSERT INTO profile (name_jp, name_en, title, bio, hero_image_url, introduction)
VALUES (
  'テスト 太郎',
  'Test Taro',
  'Frontend Engineer',
  'dev環境用のサンプルプロフィールです。',
  '/images/hero-placeholder.jpg',
  '{"blocks": [{"type": "paragraph", "content": "サンプル自己紹介テキストです。"}]}'
);
```

**`career_items`（2〜3行程度）:**
```sql
INSERT INTO career_items (company, role, period, description, sort_order) VALUES
  ('サンプル株式会社A', 'フロントエンドエンジニア', '2022.04 - 現在', 'Next.js / TypeScript でプロダクト開発。', 1),
  ('サンプル株式会社B', 'Webデザイナー', '2020.04 - 2022.03', 'UIデザイン・コーディングを担当。', 2);
```

**`skill_level_tokens`（3行程度）:**
```sql
INSERT INTO skill_level_tokens (key, value, mode, description) VALUES
  ('skill/react', 'advanced', 'default', 'Reactスキルレベル'),
  ('skill/typescript', 'intermediate', 'default', 'TypeScriptスキルレベル'),
  ('skill/figma', 'intermediate', 'default', 'Figmaスキルレベル');
```

---

### Step 4: dev プロジェクトに link してマイグレーションを適用

```bash
# dev プロジェクトにリンク（project-ref は dev の URL から）
supabase link --project-ref aemqzbsofprgmwtpfndf

# マイグレーションを dev に適用（ローカル Docker 不使用、リモートに直接 push）
supabase db push
```

`20260101000000_initial_schema` → `20260322000000_add_profile_career_lead` の順で適用されることを確認する。

---

### Step 5: シードデータを適用

```bash
# Supabase の SQL Editor に seed.sql の内容を貼り付けて実行
# または psql が使える場合:
supabase db execute --file supabase/seed.sql --project-ref aemqzbsofprgmwtpfndf
```

> **Note:** `supabase db execute` は CLI バージョンによっては `supabase db query` 等コマンド名が異なる場合がある。`supabase --help` で確認すること。
> 代替: Supabase ダッシュボード > SQL Editor に `seed.sql` の内容を貼り付けて実行してもよい。

---

### Step 6: 動作確認

```bash
# localhost で dev サーバー起動
npm run dev
```

- `http://localhost:3000` を開いてプロフィール・キャリア情報が表示されることを確認
- `src/lib/supabase.ts` の切り替えロジック（`NODE_ENV === "development"` で dev URL を使用）が正しく機能していることをブラウザの Network タブで確認（リクエスト先が `aemqzbsofprgmwtpfndf.supabase.co` になっていること）

---

### Step 7: 型定義の再生成（任意・推奨）

dev プロジェクトからも型定義を生成して `src/types/supabase.ts` と差分がないことを確認する：

```bash
supabase gen types typescript --project-ref aemqzbsofprgmwtpfndf > /tmp/supabase-dev-types.ts
diff src/types/supabase.ts /tmp/supabase-dev-types.ts
```

差分がなければ ✅。差分がある場合は migration の抜けを疑う。

---

## ブランチ・コミット規則

```bash
git checkout main && git pull origin main
git checkout -b chore/20260530-setup-dev-supabase

# migration と seed を追加後
git add supabase/
git commit -m "chore: dev Supabase 初期スキーマとシードデータを追加"
```

---

## 注意事項

- `supabase/config.toml` はコミットしてよい（プロジェクト設定情報のみ、秘匿情報なし）
- `seed.sql` はコミットしてよい（dev 用ダミーデータのみ）
- `supabase link` は dev project ref に向けて実行し、**本番 ref には絶対に `db push` しない**
- `.env.local` の `NEXT_PUBLIC_DEV_SUPABASE_ANON_KEY` が設定されていることを事前確認すること
