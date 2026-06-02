# スキルセクション リデザイン（アコーディオン化）実装指示書

> 対象 Figma: `Master` / node `502:1344`（"Content"）
> 対象ブランチ前提: `feat/20260601-iconset-all-categories`（IconSet 全35カテゴリ拡張済み）
> 作成日: 2026-06-01

この文書は、スキルセクションを現行の「案A: Refined Cards」から **アコーディオン式の展開可能スキルアイテム** に刷新するための、実装者向け自己完結プロンプトです。**この指示書だけ読めば着手できる**ことを目標にしています。

---

## 0. 確定済みの設計方針（ユーザー確認済み）

| # | 決定事項 | 内容 |
|---|---------|------|
| 1 | アコーディオン挙動 | **クリックで個別トグル**。複数行を同時に開ける（単一開閉ではない）。 |
| 2 | データソース | **DB スキーマを拡張**（マイグレーション）。静的ハードコードは採らない。 |
| 3 | ツールロゴ未整備分 | **カテゴリーアイコン（既存アイコンセット）でフォールバック**。 |
| 4 | 凡例・レイアウト | `ProficiencyLegend` は**削除**。カードは **2カラムのレスポンシブグリッド**（モバイル1カラム）。masonry は採らない。 |

> ⚠️ スキーマ変更は CLAUDE.md §2-2「要承認」かつ §0-1「不可逆操作の検証義務」に該当する。マイグレーションの **生成・適用前に必ず差分サマリーを提示して承認を得る**こと。適用後は `list_migrations` 等の独立コマンドで物理適用を検証・報告すること。

---

## 1. 対象ファイル

| ファイル | 役割 | 変更種別 |
|---------|------|---------|
| `src/components/SkillsCardGrid.tsx` | スキルセクション本体 | **全面改修** |
| `components/Tag.tsx` | タグ UI | **バリアント追加**（border付き・グレー文字・アイコン前置） |
| `components/Icon.tsx` | 汎用アイコン | 変更不要（既存で充足。`tintColor` 利用） |
| `src/types/supabase.ts` | DB 型 | マイグレーション後に**再生成**（手動編集しない） |
| `supabase/migrations/*.sql` | スキーマ | **新規マイグレーション**（要承認） |
| `app/styleguide/StyleguideLayout.tsx` | スタイルガイド | **更新義務**（CLAUDE.md §4。Tag 変種追加に追従） |
| `app/page.tsx:209` | マウント箇所 | 変更不要（`<SkillsCardGrid />` のまま） |

未追跡の `portfolio/`（入れ子複製）と `figma-skills-a-plan.js` は**対象外**。触れないこと。

---

## 2. デザイン仕様（実測値・トークン）

### 2-1. カラー / フォントトークン

| 用途 | 値 | 既存トークン |
|------|----|----|
| アクセント緑 | `#48F4BE` | `--color-main-100` / `Main/base` |
| カード背景 | `#1A1A1A` | `System/1000` |
| 区切り/ボーダー | `#424242` | `System/800` |
| サブテキスト | `#9E9E9E` | `System/500` |
| キャプション | `#757575` | `System/600` |
| 本文白 | `#FFFFFF` | `System/White` |
| 行ホバー/展開背景 | `rgba(255,255,255,0.05)` | Background/Light-α5 |
| Tag 背景 | `rgba(0,0,0,0.25)` | Background/Dark-α25 |
| EN 見出し | Avenir Heavy | `Body/EN` |
| EN 本文/ラベル | Avenir Roman | `Body/EN` |
| EN レベル名 | Afacad Bold | `Special/EN`（`--font-guide`） |
| JP 本文/キャプション | Noto Sans JP Regular | `--font-noto` |

> 既存 `SkillsCardGrid.tsx` はインライン hex を多用している。同様の方針で良い（無理にトークン化しない）。

### 2-2. レイアウト構造と実測値

```
Skill カード
  bg #1A1A1A / radius 14 / overflow-clip / padding 40
  drop-shadow: 0 1px 1.5px rgba(0,0,0,0.1), 0 1px 1px rgba(0,0,0,0.1)
  │
  ├─ CategoryCard（ヘッダー）  flex gap 12 items-start
  │   ├─ Icon 24×24  tintColor=#48F4BE
  │   └─ 縦並び gap 8
  │       ├─ title     Avenir Heavy 20px / line-height 28 / #FFF
  │       └─ subtitle  Noto 13px / line-height 1.5 / tracking 0.39px / #757575
  │
  └─ items 容器  flex-col / padding-top 24 / gap 4
      └─ _SkilllItem（行）× N   ※3状態を持つ → §2-5
          padding 12 / flex-col gap 16（active 時）
          状態で変化: radius 10↔16 / 背景 transparent↔rgba(255,255,255,0.05) / chevron 表示有無
          │
          ├─ _SkillVaule（常時表示）flex justify-between items-center  ← クリックで開閉
          │   ├─ 左 SkillItem  flex gap 12 items-center flex-1 / padding-right 16
          │   │   ├─ Icon 16×16（スキル固有・白〜淡色。tint なし or 淡色）
          │   │   └─ label  Avenir Roman 13px / #FFF / 省略 ellipsis
          │   └─ 右グループ  flex gap 8 items-center
          │       ├─ _SkillLevel  flex gap 8 items-center
          │       │   ├─ セグメント列  flex gap 4
          │       │   │   └─ 4本: 各 w18 h6 / rounded-full
          │       │   │       点灯=#48F4BE / 消灯=透明+1px #424242 border
          │       │   └─ レベル名  幅80 / 右寄せ / Afacad Bold 12px
          │       │       Expert=#48F4BE(太字) / 他=#9E9E9E
          │       └─ Button/Function  16×16 / padding 6 / rounded 8  ※default時は非表示（§2-5）
          │           └─ chevron 12×12: hover=Arrows/down, active(展開)=Arrows/up
          │
          └─ 展開パネル（開時のみ／高さアニメ推奨）
              border-top 1px rgba(255,255,255,0.05) / padding-top 16 / padding-x 32
              flex-col gap 16
              ├─ テキスト  flex-col gap 4 / 全幅
              │   ├─ label-note   Noto 10px / tracking 0.3px / #757575
              │   └─ description  Noto 13px / line-height 1.5 / tracking 0.39px / #9E9E9E
              └─ Slot-Tool  flex flex-wrap gap 8
                  └─ Tag × N
```

### 2-3. 習熟度（_SkillLevel）バリアント

`segments`（既存 1–10 スケール）→ 4段階へ写像。**既存ヘルパー `segmentsToLevel()` を流用**する。

| level | 点灯本数 | EN ラベル | ラベル色 |
|-------|---------|-----------|---------|
| 1 | 1/4 | Beginner | #9E9E9E |
| 2 | 2/4 | Intermediate | #9E9E9E |
| 3 | 3/4 | Advanced | #9E9E9E |
| 4 | 4/4 | Expert | #48F4BE（太字） |

> 既存 `SKILL_LEVELS` 配列の EN/JP 定義を再利用可。セグメント寸法のみ 22×8 → **18×6** に更新。

### 2-4. Tag 新バリアント（`components/Tag.tsx`）

現行 `small` 変種（border なし・白文字）とは別物。以下を満たす変種を追加（例: `variant="tool"`）:

- コンテナ: `bg-[rgba(0,0,0,0.25)] border border-[#424242] rounded-full px-[10px] py-[4px]`
- 内側: `flex gap-[4px] items-center`
- アイコン枠: 16×16（`prefix` slot を流用）
- ラベル: Avenir Roman 11px / `#9E9E9E` / `leading-none whitespace-nowrap`

`prefix` props で `<ServiceLogo>` か `<Icon>`（カテゴリーフォールバック）を差し込む設計にする。

### 2-5. _SkilllItem のインタラクション3状態（Figma `Status` variant: node 733:2787）

行コンポーネントは **`Status = default / hover / active`** の3バリアントを持つ。各状態の差分は以下のとおり（実装で必ず再現すること）:

| 項目 | **default**（通常） | **hover**（ホバー） | **active**（クリック=展開） |
|------|------|------|------|
| 背景 | transparent | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.05)` |
| 角丸 | **10px** | **16px** | **16px** |
| chevron（Button/Function） | **非表示** | 表示・**Arrows/down** | 表示・**Arrows/up** |
| _SkillLevel（バー+レベル名） | 表示（右グループが `flex-1` で右端寄り） | 表示（右グループ `shrink-0`） | 表示（右グループ `shrink-0`） |
| 展開パネル（note/desc/tags） | なし | なし | **あり**（border-top + label-note + description + Slot-Tool） |
| 行内 gap | – | – | `16px`（パネルとの間） |

**実装マッピング**（方針1: クリックで個別トグル・複数同時展開）:

- **default → hover** は純粋な CSS `:hover` で表現（JS不要）。`hover:bg-[rgba(255,255,255,0.05)] hover:rounded-[16px]` と、chevron を `opacity-0 group-hover:opacity-100`（または条件レンダ）で出し分け。
- **active**（展開）は React 状態で管理：`expanded: Set<string>` に行 ID が含まれるか。active のスタイル（背景・16px・chevron up・パネル表示）は hover より優先（常時適用）。
- したがって視覚的な優先順位は **active > hover > default**。active 中にホバーしても active 表示を維持。
- chevron は **default では DOM から出さない（または不可視）** 点に注意。レベルインジケーターの水平位置が default と hover/active で微妙に異なる（default は右グループ `flex-1`）が、視覚差は小さいので `shrink-0` 統一でも可。厳密一致が必要なら default のみ右グループを伸長させる。
- トグルのトリガーは `_SkillVaule` 行全体（`<button>`）。`aria-expanded` を active と同期（§6）。

---

## 3. ツールタグのアイコン解決ロジック（方針3）

各ツールタグのアイコンは次の優先順で解決する:

1. `public/logos/<slug>.svg` が存在 → `<ServiceLogo name={slug} />`
   （現状ある10個: airtable, discord, figma, github, miro, notion, sketch, slack, webflow, zapier）
2. 無ければ **ツールのカテゴリーに対応する既存アイコン**（`<Icon set=... name=... />`）でフォールバック

→ `toolCategory → { set, name }` のマップを `SkillsCardGrid.tsx`（または `src/lib` の小ヘルパー）に定義する。
   例（実アイコン名は `public/icons/` から選定して確定させること）:
   - "Frontend Frameworks & UI Libraries" → `{ set: "Components", name: "..." }`
   - "Source Control & Developer Platforms" → `{ set: "Connect", name: "pull-requests" }`
   - 既定フォールバック → `{ set: "Base", name: "system" }`

> ロゴ SVG の新規追加は今回スコープ外（方針3）。後続で追加された分は自動的に優先1で拾われる。

---

## 4. DB スキーマ拡張案（要承認 → マイグレーション）

### 現状

- `skill_cards(id, icon_set, icon_name, title, title_jp, sort_order)` … カードヘッダー。**変更不要**。
- `skill_experience(card_id, label, label_short, description, level, segments, sort_order)` … スキル行。`description`/`level`/`segments` は既存。
- `skill_tools(card_id, name, years, sort_order)` … **カード単位**でツール保持。ロゴ参照なし。
- `tools_vocab(id, name, slug, ...)` … ツール語彙マスタ（`slug` あり＝ロゴ名に流用可）。

### ギャップと拡張提案

**(A) `skill_experience` に列追加**（展開行の表現に必要）
```sql
ALTER TABLE skill_experience
  ADD COLUMN icon_set   text,          -- スキル行アイコンのカテゴリ
  ADD COLUMN icon_name  text,          -- スキル行アイコン名
  ADD COLUMN label_note text;          -- 展開時の JP 短ラベル（例: "UIデザイン"）
```
- `description` は既存列を**そのまま使用**（現状 null 多数 → 投入が必要）。
- `level` は文字列だが、表示は `segments` からの導出（`segmentsToLevel`）を継続。`level` 列は当面据え置き or 整合させる（実装時に判断）。

**(B) ツールをスキル行単位へ**（現状はカード単位）

2案。実装時にどちらか選び、マイグレーション差分を提示して承認を得る:

- **案B-1（最小変更）**: `skill_tools` を `skill_experience` 紐付けに再設計
  ```sql
  ALTER TABLE skill_tools
    ADD COLUMN experience_id uuid REFERENCES skill_experience(id) ON DELETE CASCADE,
    ADD COLUMN category text;          -- カテゴリーアイコン・フォールバック用
  -- 既存 card_id データ移行 or 破棄を判断（現状データ件数を execute_sql で確認のうえ）
  ```
  表示では `years` は不使用（列は残置で可）。`slug` でロゴ解決する場合は `tools_vocab` を参照。

- **案B-2（正規化）**: `skill_experience` × `tools_vocab` の中間テーブル新設
  ```sql
  CREATE TABLE skill_experience_tools (
    experience_id uuid REFERENCES skill_experience(id) ON DELETE CASCADE,
    tool_id       uuid REFERENCES tools_vocab(id),
    sort_order    int DEFAULT 0,
    PRIMARY KEY (experience_id, tool_id)
  );
  ```
  ロゴ/カテゴリは `tools_vocab` 側へ列追加（`slug`, `category`）。再利用性が高い。

> **推奨**: 既存 `project_tools`/`project_skills` の中間テーブル流儀（案B-2）に寄せると一貫性が出る。ただし投入コスト増。**ユーザーに B-1/B-2 を提示して選ばせる**こと。

**(C) RLS / 公開ポリシー**: 既存 `skill_*` テーブルと同じ read ポリシーを新テーブル/新列にも適用する（CLAUDE.md §2-2 認証・RLS は要承認）。

**(D) 型再生成**: 適用後 `mcp__supabase__generate_typescript_types` で `src/types/supabase.ts` を再生成（手書きしない）。

**(E) 管理画面**: スキル編集 UI（admin）がある場合、新列（icon/label_note/tools）の入力に追従が必要。スコープに含めるか別PRにするかを確認する。

---

## 5. 実装フェーズ（推奨順）

> 各フェーズ末で `npm run lint` / `tsc --noEmit` を通す。プレビューで視覚確認する。

**Phase 1 — UI スケルトン（DB非依存・モックデータ）**
1. `components/Tag.tsx` に `tool` 変種を追加（§2-4）。→ StyleguideLayout 更新（§4義務）。
2. `SkillsCardGrid.tsx` を改修し、アコーディオン行・展開パネル・Tag 群を**モック定数**で描画。
   - **3状態（default/hover/active）を §2-5 のとおり実装**：default→hover は CSS `:hover`、active は `useState<Set<string>>`（複数同時可＝方針1）。背景・角丸(10↔16)・chevron 表示有無を状態で出し分け。
   - 展開アニメ: `max-height` or `grid-template-rows: 0fr/1fr` トランジション推奨。
   - chevron は **default で非表示**、hover=`Arrows/down`、active=`Arrows/up`。
   - セグメント寸法を 18×6 に、レベル名幅 80 に更新。`ProficiencyLegend` と関連 import を**削除**。
   - グリッド: `grid-cols-1 md:grid-cols-2`、`gap 24`。
3. ツールアイコン解決ヘルパー（§3）を実装し、ロゴ→カテゴリーアイコンのフォールバックを通す。
4. プレビューで Figma（node 502:1344）と並べて視覚一致を確認。

**Phase 2 — スキーマ拡張（要承認）**
5. 現状データ件数・内容を `execute_sql`(SELECT) で確認。
6. §4 の ALTER/CREATE 差分サマリーを提示し、**承認を得てから** `apply_migration`。
7. 適用後 `list_migrations` で検証・報告。型を再生成。

**Phase 3 — データ結線**
8. `fetchSkillCards()` を拡張し、新列（icon/label_note）とスキル行単位 tools を取得・整形。
9. モックを実データに差し替え。description/label_note/tools の初期データ投入も行う（投入 SQL は別途承認）。

**Phase 4 — 仕上げ**
10. レスポンシブ（モバイル1カラム）、ホバー/フォーカス、キーボード操作（`button` 要素・`aria-expanded`）確認。
11. StyleguideLayout の最終確認。lint / tsc / プレビュー証跡を提示。

---

## 6. アクセシビリティ要件

- 開閉トリガーは `<button>` とし `aria-expanded` を付与。展開パネルに `id`/`aria-controls` を紐付け。
- chevron アイコンは装飾扱い（`aria-hidden`）。レベルは視覚＋テキスト両方で提示済み（OK）。
- キーボード（Enter/Space）でトグル可能にする。

---

## 7. 完了条件（Definition of Done）

- [ ] Figma node 502:1344 とビジュアル一致（カード/行/展開パネル/Tag/習熟度バー）。
- [ ] クリックで個別トグル、複数同時展開が動作。
- [ ] 3状態（default=透明/10px/chevron無 → hover=薄背景/16px/chevron下 → active=薄背景/16px/chevron上/展開）を §2-5 のとおり再現。
- [ ] ツールアイコンがロゴ→カテゴリーフォールバックで解決。
- [ ] 凡例削除・2カラム（モバイル1カラム）グリッド。
- [ ] スキーマ拡張が承認・適用され、型再生成済み。実データで描画。
- [ ] `npm run lint` / `tsc --noEmit` パス。
- [ ] `StyleguideLayout.tsx` を Tag 変種に追従更新（CLAUDE.md §4）。
- [ ] a11y（button/aria-expanded/キーボード）対応。

---

## 8. 留意・確認事項（着手前に解消）

1. **ツール紐付けの正規化方針**: 案B-1（skill_tools 再設計）か B-2（中間テーブル）か。→ ユーザー選択。
2. **管理画面の追従**: 新列/新ツール構造の編集UIを本PRに含めるか、別PRか。
3. **`level` 列の扱い**: 表示は segments 導出のままで良いか（level 列を整合させるか）。
4. **既存 skill_tools データの移行/破棄**: 件数確認のうえ判断。
5. **description/label_note の初期コンテンツ**: 文言はユーザー提供 or 仮置きか。

---

### 付録: 確認済みアイコン資産

- スキル行アイコン（writing-fluently, file-search, system, checklist, tree-diagram, delivery, chart-line, i-mac, toolkit, pull-requests, magic, spanner ほか）・カテゴリーヘッダー（platte, peoples-two, code, ai-intract）・chevron（Arrows/up, Arrows/down）は **すべて `public/icons/` に存在**（確認済み）。
- ロゴは `public/logos/` に10件のみ（不足分はカテゴリーアイコンでフォールバック）。
