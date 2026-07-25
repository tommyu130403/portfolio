# 実装プロンプト: フローチャート作成・埋め込み機能

> 以下をそのまま新しいセッションに貼って実行させる想定の自己完結プロンプトです。
> リポジトリ: `/Users/tommyu/Dev/portfolio`

---

## 依頼

作品詳細ページに「制作プロセス」などを図式化するフローチャート機能を実装してください。

1. admin でフローチャートを作成・編集・保存できる
2. 作品をまたいで再利用できる（独立テーブルに保存）
3. リッチエディタのツールバーから既存の図を呼び出し、本文の任意の位置に挿入できる
4. 公開側では段落内にインライン表示。**全デバイスで初期表示は図全体が収まり**、自由にパン/ズームできる。クリックで拡大モーダル

---

## 着手前に必ず確認すること

- **ブランチ**: 現在 `feat/20260721-design-review-frontend` にデザインレビューの未 push コミット2件と未コミットのドキュメント変更がある。この実装をどのブランチで進めるか（main から新規に切るか等）を**最初にユーザーへ確認**すること。
- `CLAUDE.md` の §0（最優先原則）、§2（自動実行 vs 要承認）、§3（Git 運用）、§4（スタイルガイド更新義務）を読むこと。

---

## 確定済みの方針（ユーザー承認済み・再検討不要）

| 論点 | 決定 |
|---|---|
| 作成UI | **React Flow (`@xyflow/react`)** を新規依存として追加 |
| 公開側の描画 | **公開側でも React Flow を使う**（読取専用モード）。自作SVGにはしない。編集画面と見た目を100%一致させ、パン/ズームを自前実装しないため |
| 保存先 | **独立した `flowcharts` テーブル**。本文からは `::: flowchart id=<uuid>` で参照 |
| 表示 | 段落内インライン ＋ クリックで拡大モーダル。全デバイスでパン/ズーム自由、初期表示は fitView で全体が収まる |
| デザイン基準 | Figma に該当デザインは無い。**既存 design tokens + `components/WorkViz.tsx` の意匠**から組む |

---

## 前提として理解しておくべきコードベースの事実

このリポジトリは一般的な Next.js プロジェクトの想定が通用しない箇所が多いので、以下を前提にすること。

- **静的エクスポート**: `next.config.ts` は本番で `output: 'export'`、`basePath: '/portfolio'`。**サーバーコンポーネントでのデータ取得も Server Actions も使えない**。全てブラウザから anon キーで Supabase を叩く（`src/lib/supabase.ts` のシングルトン）。
- **動的セグメントが使えない**ため、編集画面のIDは**クエリ文字列**。`app/admin/works/edit/page.tsx` が `Suspense` + `useSearchParams` で `?id=xxx` / `id=new` を読む形になっているので、これを写すこと。
- **リッチエディタはライブラリではない**。Tiptap/Lexical/Slate 等は入っていない。`components/RichMarkdownEditor.tsx`（538行）は生 Markdown の `<textarea>` ＋ ツールバー ＋ ライブプレビュー。
- **`components/WorkMarkdown.tsx`（578行）は自作 Markdown パーサ兼レンダラで、公開詳細と admin プレビューの両方から共有される単一レンダラ**。この不変条件を壊さないこと（両ファイルのヘッダコメントに明記されている）。
- 本文の保存形式は `works.sections`（jsonb）＝ `[{ heading, body /* markdown */ }]`。`lib/work-sections.ts` / `lib/work-content.ts` が変換を担う。
- 実行時依存は現状 `next` / `react` / `react-dom` / `@supabase/supabase-js` の4つだけ。図表（`WorkViz.tsx` の RACI ガントとステークホルダー図）は全て CSS grid/flex の自作で、**SVG すら使っていない**。
- パスエイリアスは `@/*` → リポジトリルート。`src/` と ルート直下の `lib/` `components/` の**2系統が併存**している（両方 active）。
- **無視すべきディレクトリ**: `/Users/tommyu/Dev/portfolio/portfolio/`（リポジトリの古い完全コピー、git 未追跡・tsconfig で除外済み）、`_to_delete/`、`out/`。検索結果が二重に出るので注意。

---

## Phase 0: 承認が必要な前提作業（CLAUDE.md §2-2）

**この2つは実行前にユーザーの承認を得ること。**

### 0-1. 依存追加
```bash
npm i @xyflow/react
```
- CSS は `@xyflow/react/dist/style.css` を `components/FlowchartView.tsx` 内で import する（`.react-flow` 配下にスコープされるので `globals.css` と衝突しない）。
- React Flow の MIT 版は右下の "React Flow" アトリビューション表示を残すことがライセンス上推奨される。`proOptions={{ hideAttribution: true }}` で消せるが、**既定では表示したまま実装**し、消すかどうかはユーザーに確認すること。

### 0-2. マイグレーション
`supabase/migrations/<yyyymmddhhmmss>_create_flowcharts.sql` を作成。

```sql
create table if not exists public.flowcharts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  data jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.flowcharts enable row level security;
-- 既存全テーブルと同じ3ポリシー構成を踏襲
-- （supabase/migrations/20260531120000_baseline_schema.sql:128-193 と同型）
--   "public read flowcharts"      for select to public        using (true)
--   "auth write flowcharts"       for all    to authenticated using (true) with check (true)
--   "anon full access flowcharts" for all    to anon          using (true) with check (true)
```

- **まず DEV プロジェクトにのみ適用**する（本リポジトリの既存運用）。prod 適用は別途ユーザー指示を待つこと。
- 適用後、`mcp__supabase__list_migrations` と `select * from flowcharts limit 1` を**別途実行して物理適用を独立検証**すること（CLAUDE.md §0-1 の義務）。
- その後 `npm run update-types` で `src/types/supabase.ts` を再生成。

---

## Phase 1: データ層

### 新規 `lib/flowchart.ts`

React Flow のノード/エッジ形状に近い保存形式にして、変換を最小化する。

```ts
export type FlowNodeKind = "start" | "end" | "step" | "decision" | "note";
export type FlowNode = { id: string; kind: FlowNodeKind; label: string; sublabel?: string; x: number; y: number; w?: number };
export type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string; dashed?: boolean };
export type FlowchartData = { nodes: FlowNode[]; edges: FlowEdge[] };
```

実装するもの:

- **`parseFlowchart(raw: unknown): FlowchartData | null`**
  `components/WorkViz.tsx:30-80` の `parseTimeline` / `parseStakeholders` と**同じ防御的パーサ規約に厳密に従う**こと:
  - 引数は `unknown`（jsonb 由来）を受け、`Record<string, unknown>` で絞る
  - 不正な行は `.filter((n): n is FlowNode => n !== null)` で落とす
  - 有効ノードが0件なら `null` を返す
  - `kind` はホワイトリスト検証（`["start","end","step","decision","note"].includes(...)`）
  - 座標は `Number(o.x) || 0` で強制コアース
  - **エッジは source/target が実在ノードを指すものだけ残す**（孤立エッジで React Flow が落ちるのを防ぐ）
- **`toReactFlow(data)` / `fromReactFlow(nodes, edges)`** — React Flow の `Node[]` / `Edge[]` との相互変換
- **`DEFAULT_FLOWCHART`** — 新規作成時の種（start → step → end の3ノード）。`app/admin/works/edit/WorkEditor.tsx:631` の `DEFAULT_TIMELINE` と同じ役割
- **フェッチのメモ化** — モジュールレベルの `Map<string, Promise<FlowchartData | null>>` で同一図の重複フェッチを防ぐ

### `app/admin/actions.ts` に CRUD を追加

同ファイル内の既存関数（`saveWork` 等）の**anon クライアント直叩きパターンをそのまま踏襲**すること。ファイル名に反して `"use server"` ではなく、ブラウザで動く素のモジュールである点に注意。

`listFlowcharts()` / `getFlowchart(id)` / `saveFlowchart(payload)` / `deleteFlowchart(id)` / `duplicateFlowchart(id)`

---

## Phase 2: admin — フローチャート作成画面

### 2-1. ナビ登録
`app/admin/sections.ts` の `NAV_SECTIONS` に1行追加:
```ts
{ id: "flowcharts", label: "Flowcharts", labelJa: "フローチャート" },
```
これ1箇所でサイドバーと `app/admin/[section]/page.tsx` の `generateStaticParams` の両方が駆動される。

### 2-2. 一覧セクション
`app/admin/AdminLayout.tsx`（1765行）に `function FlowchartsSection({ onDirtyChange })` を追加し、`AdminLayout()` 内のセクション分岐（**`AdminLayout.tsx:1747-1758`**）に1行追加:
```tsx
{section === "flowcharts" && <FlowchartsSection onDirtyChange={setDirty} />}
```

内容: 一覧（タイトル / ノード数 / 更新日時）、「＋ 新規作成」ボタン、行ごとに 編集 / 複製 / 削除。
**削除時は「本文から参照されている可能性がある」旨を警告するダイアログ**を出すこと。

### 2-3. 全画面エディタ（新規2ファイル）

- `app/admin/flowcharts/edit/page.tsx` — `app/admin/works/edit/page.tsx` の写し（`Suspense` + `useSearchParams` の `?id=`）
- `app/admin/flowcharts/edit/FlowchartEditor.tsx` — `<AdminShell section="flowcharts" wide hasUnsavedChanges={dirty}>` で囲む。`AdminShell` は `AdminLayout.tsx:1619` にあり、220px サイドバー・`beforeunload` ガード・`wide` プロップを提供する。dirty 管理と `SaveButton` は `WorkEditor.tsx` の実装をそのまま再利用

| 領域 | 内容 |
|---|---|
| 上部バー | タイトル入力（`AdminLayout.tsx:322` の `Input`）、保存ボタン、戻る |
| 左パレット | ノード種別ボタン（開始 / 処理 / 分岐 / 終了 / 注記）。クリックでキャンバス中央に追加 |
| キャンバス | `<ReactFlow>` 編集モード。ドラッグ移動、ハンドル同士のドラッグで接続、Delete キーで削除、`<Background variant="dots">` ＋ `<Controls>` |
| 右インスペクタ | 選択中ノード/エッジの ラベル・補足・種別・破線トグル を編集 |

**右インスペクタは `WorkEditor.tsx:654-657` の `TimelineForm` のイディオムに揃えること** — ローカル state を持たず、親の値を丸ごと不変更新して `onChange` に渡す `patch` クロージャ方式:
```ts
const patch = (i, p) => onChange({ ...value, nodes: value.nodes.map((n, idx) => (idx === i ? { ...n, ...p } : n)) });
```
数値入力のコアースは同ファイル `:647-650` の `clampInt` を使う（`Number(v) || default` を使わない理由がコメントに書かれている）。

保存は `fromReactFlow()` → `saveFlowchart()`。

---

## Phase 3: 公開側レンダリング

### 3-1. `components/FlowchartNodes.tsx`（新規, `"use client"`）

React Flow の `nodeTypes` として登録するカスタムノード。**`components/WorkViz.tsx` の意匠に合わせる**（トークンクラスと生 hex の混在も既存に合わせてよい。`WorkViz.tsx:94-99` の `RACI_STYLE` が種別ごとのスタイルマップの参考実装）。

| kind | 見た目 |
|---|---|
| `start` | ピル `rounded-full bg-main-100 text-[#0a0a0a]` |
| `end` | ピル `rounded-full border border-main-100 bg-[#0a2218] text-main-100` |
| `step` | カード `rounded-[12px] border border-[#2a2a2a] bg-[#161616]`（`WorkViz.tsx:195` のノードタイルと同型） |
| `decision` | 菱形。`rotate-45` した外枠＋逆回転したラベル。`border-[#616161] bg-[#242424]` |
| `note` | 破線枠 `border-dashed border-[#424242]`、`text-[#9e9e9e]` |

エッジは React Flow 既定の `smoothstep` ＋ `markerEnd: arrowclosed`、色 `#616161`（`dashed` 時は `strokeDasharray`）。

参考トークン（`app/globals.css:44-89`）: `--color-main-100 #48F4BE` / `--color-system-500 #9E9E9E` / `--color-system-800 #424242` / `--color-system-1000 #1A1A1A`。

### 3-2. `components/FlowchartView.tsx`（新規, `"use client"`）

読み取り専用の React Flow。**編集画面と同一の `nodeTypes` を共有**することで見た目のズレを構造的に防ぐ。

```
nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
fitView fitViewOptions={{ padding: 0.15 }}
panOnDrag zoomOnScroll zoomOnPinch panOnScroll={false}
minZoom={0.2} maxZoom={2.5}
```
`fitView` により全デバイスで初期表示に図全体が収まる。`<Controls showInteractive={false} />` でズームリセットを提供。

### 3-3. `components/FlowchartEmbed.tsx`（新規, `"use client"`）

- props: `{ id: string }`
- id で `flowcharts` を取得 → `parseFlowchart` → `FlowchartView`
- 取得は `lib/flowchart.ts` のモジュールレベルの Map でメモ化
- **`FlowchartView` は `next/dynamic({ ssr: false })` で遅延読み込み**すること。フローチャートを含まないページが React Flow を読み込まないようにするため（App Router では `ssr: false` はクライアントコンポーネント内でのみ許される。`FlowchartEmbed` は `"use client"` なので問題ない）
- 高さ `h-[clamp(260px,50vh,420px)]`、枠は `rounded-[14px] bg-[#1a1a1a] p-2`（`WorkViz.tsx:118` と同じコンテナ意匠）
- 右上に拡大ボタン → **既存の `components/Modal.tsx` を直接使う**。`components/WorkVizModal.tsx` は左パネル専用の別用途なので拡張しないこと。`Modal` は `onClose` 必須、body スクロールロック済み、`max-h-[90vh]`
- **見つからない場合**は控えめなプレースホルダ（「図が見つかりません」）を出す。空の穴を開けない
- **ローディング中**は同じ高さのスケルトンを出し、レイアウトシフトを避ける

### 3-4. `components/WorkMarkdown.tsx` を4箇所修正

`::: grid` のようなフェンス形式ではなく、**1行完結のディレクティブ**にする（`:::` 終端判定と競合させないため）。

1. `Block` union（`:211-223`）に `| { type: "flowchart"; id: string }` を追加
2. `isBlockStart`（`:236`）の正規表現に `flowchart` を追加
   現在: `/^:::\s*(grid|timeline|stakeholders)\b/`
3. パース分岐を **`::: grid` の分岐（`:252`）より前**に置く:
   ```ts
   const fc = line.match(/^:::\s*flowchart\s+id\s*=\s*([0-9a-fA-F-]{36})\s*$/);
   ```
   既存の属性パース正規表現 `/(\w+)\s*=\s*(\d+)/g`（`:256`）は**整数しか拾えないので uuid には使えない**。専用の正規表現が必要。
4. レンダラの switch（`case "grid":` は `:484-499`）に `case "flowchart": return <FlowchartEmbed id={b.id} />;` を追加

**壊してはいけない既存ガード:**
- `:243-249` — 旧 `::: timeline` / `::: stakeholders` を無描画で読み飛ばすガード
- `:380` — どの分岐にも一致しない未知の `:::` 行で無限ループしないよう強制的に1行進めるガード

この4箇所の修正だけで、公開詳細（`WorkDetailContent` → `WorkSections` → `MarkdownBody`）と admin のライブプレビューの**両方に自動的に反映される**。

---

## Phase 4: リッチエディタからの呼び出し

### `components/RichMarkdownEditor.tsx`

- **`onPickImage` と同型のプロップ**を追加（`:29` の隣）:
  ```ts
  onPickFlowchart?: () => Promise<{ id: string; title: string } | null>;
  ```
- ツールバー（`:214-233`、**`ml-auto` の div（`:236`）より前**）に `<TBtn label="フローチャート" title="フローチャートを挿入" onClick={...} />` を追加。ハンドラ:
  ```ts
  const p = await onPickFlowchart(); if (p) insertLine(`::: flowchart id=${p.id}`);
  ```
  `insertLine`（`:197-204`）は前後の改行を必要な分だけ合成してくれるので、そのまま使うこと。
- **プロップ未指定時はボタンを描画しない**（`app/styleguide/StyleguideLayout.tsx:619` のデモが Supabase に依存しないための既存慣習。`onPickImage` が optional なのと同じ理由）。
- **専用ダイアログは作らない**。入力項目が「どれを選ぶか」だけなので `GridDialog`（`:488-536`）のような `DialogShell` 型ダイアログは不要。

### `app/admin/AdminLayout.tsx`

`FlowchartPickerModal` を `ImagePickerModal`（`:51-258`）の隣に、同じ意匠で追加。一覧＋検索＋サムネイル（`FlowchartView` を小さく非インタラクティブに描画）。

### `app/admin/works/edit/WorkEditor.tsx`

`pickImage`（**`:132-144`**）と同じ **ref に resolve を保持する Promise パターン**で `pickFlowchart` を実装:
```ts
const fcResolve = useRef<((v: {id:string;title:string} | null) => void) | null>(null);
const pickFlowchart = () => new Promise((resolve) => { fcResolve.current = resolve; setFcPickerOpen(true); });
```
`RichMarkdownEditor` に `onPickFlowchart={pickFlowchart}` を渡し（`:362` の `onPickImage` の隣）、`FlowchartPickerModal` をエディタ外（`:607` 付近の `ImagePickerModal` の隣）にマウントする。

---

## Phase 5: スタイルガイド更新（CLAUDE.md §4 の義務）

`app/styleguide/StyleguideLayout.tsx` の `ComponentsSection` に `FlowchartView` の `<ComponentPreview>` を追加（サンプルの3ノードグラフをハードコード）。`components/` への新規ファイル追加は**同一タスク内での登録が必須**。

---

## 変更/新規ファイル一覧

**新規**
- `supabase/migrations/<ts>_create_flowcharts.sql`
- `lib/flowchart.ts`
- `app/admin/flowcharts/edit/page.tsx`
- `app/admin/flowcharts/edit/FlowchartEditor.tsx`
- `components/FlowchartNodes.tsx`
- `components/FlowchartView.tsx`
- `components/FlowchartEmbed.tsx`

**修正**
- `package.json`（`@xyflow/react`）
- `src/types/supabase.ts`（`npm run update-types` で自動再生成）
- `app/admin/sections.ts`（1行）
- `app/admin/actions.ts`（CRUD 追加）
- `app/admin/AdminLayout.tsx`（`FlowchartsSection` ＋ `FlowchartPickerModal` ＋ 分岐1行）
- `app/admin/works/edit/WorkEditor.tsx`（`pickFlowchart` 配線）
- `components/RichMarkdownEditor.tsx`（プロップ ＋ ツールバーボタン）
- `components/WorkMarkdown.tsx`（4箇所）
- `app/styleguide/StyleguideLayout.tsx`（プレビュー登録）

---

## 検証（すべて実行し、結果をそのまま報告すること）

1. `npm run lint` と `npx tsc --noEmit` が通ること
2. マイグレーション適用後、`mcp__supabase__list_migrations` と `select * from flowcharts limit 1` を**別途実行**して物理適用を確認（CLAUDE.md §0-1）
3. `preview` skill で dev サーバーを起動し、**実画面で目視確認**する（数値計測・JS 計測だけで済ませない）:
   - `/admin/flowcharts` → 新規作成 → ノード追加・接続・ラベル編集 → 保存 → **再読込して復元されること**
   - `/admin/works/edit?id=<既存>` → ツールバー「フローチャート」→ 選択 → 本文に `::: flowchart id=…` が入り、**split プレビューに図が描画される**こと
   - `/works?id=<既存>` → 段落内にインライン表示、ホイール/ドラッグでズーム・パン、クリックで拡大モーダル
4. `resize_window` で mobile(375) / tablet(768) / desktop(1280) を確認。**mobile の初期表示で図全体が収まっている**こと、横スクロールが本文に漏れていないこと
5. `read_console_messages` でエラーがゼロであること
6. **異常系**: 存在しない id を指す `::: flowchart id=00000000-0000-0000-0000-000000000000` を本文に書き、プレースホルダが出て**本文の残りが壊れない**ことを確認
7. `npm run build`（静的エクスポート）が通ること — React Flow の `ssr: false` 動的読み込みが正しく効いているかの確認を兼ねる

---

## スコープ外・注意点

- **参照の整合性**: 図を削除すると本文の `::: flowchart id=` が宙に浮く。今回は「削除時に警告」＋「レンダラでプレースホルダ」で対処し、逆引きの参照カウント表示は作らない
- **自動レイアウト**（dagre 等による整列）は入れない。座標は手動配置のみ
- **図のバージョン管理・履歴**は作らない
- **既知の別バグ（今回は触らない）**: `lib/work-sections.ts:65` の `markdownToSections` は最初の `# ` 見出しより前のテキストを保存時に無言で捨てる。プレビュー（`WorkMarkdownDocument`）は描画するので不整合がある。本件とは独立の問題として残すこと
- **RLS**: 既存全テーブルと同じく `anon` に全権を与える構成を踏襲する。これは本リポジトリの現行運用（baseline マイグレーション内にもその旨のコメントがある）に合わせるためで、新規に穴を開けるものではない。ただし**既存のセキュリティ姿勢をそのまま継承する**点は実装時に明示的に報告すること
