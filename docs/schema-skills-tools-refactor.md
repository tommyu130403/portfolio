## Skills / Tools スキーマ再設計（方針A・マイグレーション前ドラフト）

このドキュメントは、`feat/20260316-schema-refactor-skills-tools` ブランチで進める
「Skills / Tools 周りのスキーマ再設計（方針A）」について、
**マイグレーション実行前** までに決めておく内容をまとめたものです。

実際の SQL 適用や型再生成・実装変更は、このドキュメントをベースに
別ブランチまたはこのブランチ上の後続コミットで行います。

---

## 1. 現状スキーマの整理（抜粋）

`src/types/supabase.ts` より、Skills / Tools 関連のテーブルは以下の通り。

```ts
// projects
projects: {
  Row: {
    id: string;
    title: string;
    // ...
    skills: string[] | null;
    tools: string[] | null;
    sections: Json | null;
    sort_order: number;
    created_at: string;
  };
  // ...
}

// skill_cards（スキルカード自体）
skill_cards: {
  Row: {
    id: string;
    title: string;
    title_jp: string;
    icon_set: string;
    icon_name: string;
    sort_order: number;
    created_at: string;
  };
}

// skill_bars（カード内のバー / ラダー）
skill_bars: {
  Row: {
    id: string;
    card_id: string; // FK -> skill_cards.id
    label: string;
    segments: number;
    level: string;
    description: string | null;
    sort_order: number;
  };
}

// skill_tools（カード内のツール行）
skill_tools: {
  Row: {
    id: string;
    card_id: string; // FK -> skill_cards.id
    name: string;
    years: string;
    sort_order: number;
  };
}
```

- プロジェクトとスキル / ツールの関係は、`projects.skills` / `projects.tools` の
  **文字列配列のみ** で表現されており、`skill_bars` / `skill_tools` とは
  型レベルでは直接結びついていない。
- `skill_bars` / `skill_tools` の `card_id` は `skill_cards.id` に対する FK であり、
  あくまで **Skills セクションのカード表示用データ** という位置付け。

---

## 2. 方針Aでの新スキーマ案（正規化）

### 2-1. 目的

- スキル・ツールの「語彙マスタ」と「プロジェクトとの多対多関係」を
  正規化されたテーブルで表現する。
- 公開 UI や admin のコードは、最終的にはこの新スキーマを
  経由してデータを扱うように寄せていく。
- 既存の `skill_bars` / `skill_tools` は、
  表示用カードの中身という役割にフォーカスさせる。

### 2-2. 新規テーブル定義ドラフト（SQL）

※まだ実行しない前提のドラフト。`supabase` 側マイグレーションに流用可能な形で記述。

```sql
-- スキル語彙（マスタ）
create table public.skills_vocab (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,                -- 表示名（UI Design / UX Research など）
  slug       text unique,                  -- 任意: label の正規化 (ui-design など)
  category   text,                         -- 任意: カテゴリ（"design" / "dev" など）
  created_at timestamptz not null default now()
);

-- ツール語彙（マスタ）
create table public.tools_vocab (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                -- 表示名（Figma / Notion など）
  slug       text unique,                  -- 任意: 正規化名
  created_at timestamptz not null default now()
);

-- プロジェクト × スキル（多対多）
create table public.project_skills (
  project_id uuid not null
    references public.projects(id) on delete cascade,
  skill_id   uuid not null
    references public.skills_vocab(id) on delete restrict,
  sort_order integer,                      -- 任意: 表示順
  primary key (project_id, skill_id)
);

-- プロジェクト × ツール（多対多）
create table public.project_tools (
  project_id uuid not null
    references public.projects(id) on delete cascade,
  tool_id    uuid not null
    references public.tools_vocab(id) on delete restrict,
  sort_order integer,
  primary key (project_id, tool_id)
);
```

### 2-3. 既存カラムの扱い（現時点）

- `projects.skills` / `projects.tools` は、現時点ではそのまま残す。
  - 将来的に **deprecated 扱い** とし、UI・サーバーコードを
    `project_skills` / `project_tools` に寄せていく。
  - このドキュメントのスコープでは「削除・NULL 制約変更などは行わない」。
- `skill_bars` / `skill_tools` は、
  「Skills セクションのカード表示用データ」という役割にフォーカスし、
  語彙マスタとは別レイヤーとして扱う。

---

## 3. 型・API インターフェース案（実装前の設計）

Supabase 型（`src/types/supabase.ts`）は
**マイグレーション適用後に再生成** する前提で、
アプリケーションからは以下のようなインターフェースで扱う想定。

### 3-1. 語彙取得・サジェスト API

想定ファイル: `src/lib/skills-tools.ts`

```ts
export type SkillVocab = {
  id: string;
  label: string;
  slug?: string | null;
};

export type ToolVocab = {
  id: string;
  name: string;
  slug?: string | null;
};

// 全件 / 一覧取得
export async function listSkillVocab(): Promise<SkillVocab[]>;
export async function listToolVocab(): Promise<ToolVocab[]>;

// サジェスト（前方一致など）
export async function suggestSkillVocab(
  query: string,
  opts?: { limit?: number }
): Promise<SkillVocab[]>;

export async function suggestToolVocab(
  query: string,
  opts?: { limit?: number }
): Promise<ToolVocab[]>;
```

### 3-2. プロジェクトとの紐付け API

```ts
export type ProjectSkillsSnapshot = {
  projectId: string;
  skills: SkillVocab[];
};

export type ProjectToolsSnapshot = {
  projectId: string;
  tools: ToolVocab[];
};

// 取得系
export async function getProjectSkills(
  projectId: string
): Promise<ProjectSkillsSnapshot>;

export async function getProjectTools(
  projectId: string
): Promise<ProjectToolsSnapshot>;

// 更新系（セット型。内部では project_skills / project_tools を upsert / delete）
export async function setProjectSkills(
  projectId: string,
  skillIds: string[]
): Promise<void>;

export async function setProjectTools(
  projectId: string,
  toolIds: string[]
): Promise<void>;
```

- Admin の「保存」ボタンは、最終的に
  `setProjectSkills` / `setProjectTools` を呼ぶ形に寄せていく想定。
- Skills セクションの公開 UI も、
  必要に応じて `skills_vocab` / `tools_vocab` を利用できるようにしておく。

---

## 4. マイグレーション実行前までの Runbook（案）

ここでは「まだ SQL を流さない状態」で、
実際にマイグレーションを行う際の手順イメージだけを整理する。

### 4-1. 新テーブル追加用マイグレーション SQL の準備

1. Supabase CLI またはダッシュボードを用いて、
   上記の `create table skills_vocab / tools_vocab / project_skills / project_tools`
   を含むマイグレーションファイルを作成する。
2. マイグレーションファイル内にコメントとして、以下を明示:
   - `projects.skills` / `projects.tools` は将来削除予定（現時点では残す）。
   - `skill_bars` / `skill_tools` は公開 UI の表示用であり、
     新しい語彙マスタとは役割が異なる。

### 4-2. 型再生成の手順

実際にマイグレーションを適用したあとで、
`src/types/supabase.ts` を更新するための手順例。

（環境に合わせて調整する想定。ここでは Supabase CLI を利用する例を記載。）

```bash
# 例: Supabase CLI を利用して public スキーマの型を再生成
supabase gen types typescript \
  --project-id <YOUR_PROJECT_ID> \
  --schema public \
  > src/types/supabase.ts
```

- あるいは Supabase ダッシュボードの「型定義のエクスポート」機能を利用して
  `src/types/supabase.ts` を更新してもよい。
- いずれにせよ、「マイグレーション → 型再生成 → ESLint / TypeScript のエラー確認」
  という流れをガイドラインとして明文化しておく。

### 4-3. 既存データ移行の方針（SQL レベルのイメージ）

※この段階では **まだ実際には実行しない**。マイグレーション用 SQL に
コメントとして方針を書く、あるいはこのドキュメントに箇条書きで残す。

1. 既存 `skill_bars` の `label` から `skills_vocab` を生成
   - `insert into skills_vocab (label) select distinct label from skill_bars;`
   - 必要であれば `slug` / `category` を後から埋めていく。
2. 既存 `skill_tools` の `name` から `tools_vocab` を生成
   - `insert into tools_vocab (name) select distinct name from skill_tools;`
3. 既存 `projects.skills` 配列から `project_skills` を生成
   - `unnest(projects.skills)` を用いて展開し、
     `skills_vocab.label` と突き合わせて `skill_id` に変換して insert。
4. 既存 `projects.tools` 配列から `project_tools` を生成
   - 同様に `tools_vocab.name` と突き合わせて `tool_id` に変換。

ロールバック方針（例）:

- 新テーブルを作ったマイグレーションは、検証環境でのみ一度適用し、
  問題があればロールバック（`drop table project_skills / project_tools / skills_vocab / tools_vocab`）
  できるようにしておく。
- 本番適用前に、Admin 画面・公開画面双方の動作確認を行い、
  新スキーマを利用するコードパスが問題ないことを確認してから反映する。

### 4-4. コード側の差し替えポイント一覧（TODO メモ）

実際の実装変更はマイグレーション後の別タスクだが、
どこを触るかの TODO を事前に洗い出しておく。

- `app/admin/AdminLayout.tsx`
  - プロジェクトの Skills / Tools 部分で、
    現在は `projects.skills` / `projects.tools` の文字列配列を直接扱っている。
  - 将来的には `getProjectSkills` / `setProjectSkills`,
    `getProjectTools` / `setProjectTools` を呼ぶ形に差し替える。
  - サジェスト用の候補取得についても、
    `skills_vocab` / `tools_vocab` ベースに変更する。
- `src/components/SkillsCardGrid.tsx`
  - 現状は `skill_cards` + `skill_bars` / `skill_tools` をベースに
    Skills セクションを表示している。
  - 必要に応じて、新しい語彙テーブルを補助的に利用できるようにする
    （例: フィルタリング、タグ表示など）。

---

## 5. このドキュメントの役割

- **このブランチ時点では DB にはまだ変更を加えない。**
- スキーマ再設計に関する合意内容（テーブル構造 / API インターフェース /
  マイグレーション方針）を 1 か所に集約し、
  後続のマイグレーション実行・実装変更タスクのベースとする。
- マイグレーション実行用のブランチを切る際は、
  本ドキュメントを参照しつつ SQL とコード変更を進める。

## 6. マイグレーション実行フェーズ用メモ（Claude Code 用）

このセクションは、「方針Aに基づくスキーマ変更」を
**実際に Supabase に適用し、型 / 実装を更新するフェーズ** で
Claude Code や開発者が参照するための実行メモです。

### 6-1. 使用するブランチ

- スキーマ変更用ブランチ（ベース）: `feat/20260316-schema-refactor-skills-tools`
- 実際のマイグレーション実行 & 実装変更は、必要に応じて
  `feat/YYYYMMDD-schema-migration-skills-tools` のような派生ブランチで行ってもよい。

### 6-2. このフェーズでやること（高レベル）

1. Supabase 側に新テーブルを追加（`skills_vocab` / `tools_vocab` / `project_skills` / `project_tools`）
2. 既存データから新テーブルへデータ移行（INSERT）
3. `src/types/supabase.ts` の型定義を再生成
4. Admin / 公開 UI 側のコードを、新スキーマベースに寄せる
5. 動作確認 & 必要に応じて旧カラム / 旧コードの整理

### 6-3. Supabase マイグレーション実行手順（期待する流れ）

1. ローカル環境で Supabase CLI を利用している場合:

   ```bash
   # 1) 新マイグレーションファイルの作成
   supabase migration new skills_tools_vocab --schema public

   # 2) 生成された SQL ファイルに、docs/schema-skills-tools-refactor.md の
   #    「2-2. 新規テーブル定義ドラフト（SQL）」と
   #    「4-3. 既存データ移行の方針」を元にした SQL を記述する
   #
   #    - create table skills_vocab ...
   #    - create table tools_vocab ...
   #    - create table project_skills ...
   #    - create table project_tools ...
   #    - insert into skills_vocab (...) select distinct ... from skill_bars ...
   #    - insert into tools_vocab (...) select distinct ... from skill_tools ...
   #    - insert into project_skills (...) select ... from projects ...
   #    - insert into project_tools (...) select ... from projects ...
   #
   # 3) ローカル開発環境に対してマイグレーションを適用
   supabase db reset   # or supabase db push / db migrate を適切に選択
```

---

## 7. マイグレーション完了後の状態まとめ（2026-03-16 時点）

### 7-1. ソースオブトゥルース（現在の状態）

| データ | ソースオブトゥルース | 旧カラム |
|--------|-------------------|---------|
| スキル語彙マスタ | `skills_vocab` (18件) | `skill_bars.label` も存在（display 用として残存） |
| ツール語彙マスタ | `tools_vocab` (25件) | `skill_tools.name` も存在（display 用として残存） |
| プロジェクト×スキル紐付け | `project_skills` (13件) | `projects.skills` (text[]) も残存・後方互換 |
| プロジェクト×ツール紐付け | `project_tools` (13件) | `projects.tools` (text[]) も残存・後方互換 |

### 7-2. 旧スキーマで残っているもの

- `projects.skills` / `projects.tools` (text[] カラム): 残存。Admin の保存時に新テーブルと**両方**に書き込むようにしている。
- `skill_bars` / `skill_tools`: Skills セクションのカード表示用データとして引き続き残存（役割が異なる）。
- `SKILL_VOCAB_CARD_ID` / `TOOL_VOCAB_CARD_ID` 環境変数: 新テーブルに移行したため**不要**になった。

### 7-3. 残 TODO

- [ ] `projects.skills` / `projects.tools` カラムの削除（新テーブルへの完全移行後）
- [ ] 公開 UI (`SkillsCardGrid.tsx` 等) から `project_skills` / `project_tools` を参照できるよう拡張（現状は `skill_cards` / `skill_bars` / `skill_tools` ベースのまま）
- [ ] `skills_vocab.slug` / `tools_vocab.slug` の整備（必要に応じて）
- [ ] `skills_vocab.category` によるフィルタリング機能の追加（必要に応じて）