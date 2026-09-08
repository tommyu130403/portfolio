# 依頼書 — Figma Master（node 20-702）を実装・スタイルガイドと突き合わせ、差分を実装へ反映する

- 作成日: 2026-09-08
- 状態: **方針セッションで作成・未合意**（方針セッションはクラウド。実装は別セッション opus で行う）
- 種別: `style`（差分の反映）。付随して `docs`（依頼書への実装記録追記）
- 前提 PR: #78〜#86（すべてマージ済み。Library → トークン同期 Phase 1+2 は完了）
- 関連: `docs/requests/20260908-styleguide-figma-sync.md`（前回の突き合わせ。付録 A の差分表と実装記録を必ず読む）、`.design-system-context.yml`（意図的な妥協 1 件）

---

## 0. 実装セッションへの指示プロンプト（この節をそのまま新セッションの最初のメッセージにする）

```
あなたは portfolio リポジトリの実装セッション（model: opus）。以下を順に守る。

【最初に読む】
1. CLAUDE.md 全文（§0-4 により .claude/skills/director を通す。§5 の 3 条件は必須）
2. .claude/skills/coding-lessons/SKILL.md
3. .design-system-context.yml（intentional_compromises の border-[#424242] 61 件は触らない）
4. docs/requests/20260908-styleguide-figma-sync.md（付録 A の差分表と末尾の実装記録）
5. docs/requests/20260908-figma-master-sync.md（この依頼書。§1〜§6 が要件）

【入力】
- Figma Master（サイトデザイン）: https://www.figma.com/design/j0g2E1YFLJfikcrmW0PJC5/Master?node-id=20-702&m=dev
- Figma Library（正）: https://www.figma.com/design/KpNwkdFy1usaO1sBR0dycv/Library?node-id=0-1
- 正の定義は前回合意のまま: Library の変数・paint style・text style が正。Master にしか無いローカルスタイルは取り込まず、§6 の報告表に載せてユーザー判断に回す。

【Figma の取り方（守らないと値が取れない）】
- Figma MCP が有効なローカル（Mac）セッションで行う。クラウドセッションでは Figma に届かない（2026-09-08 に確認済み）。
- get_metadata → 20-702 のノード名・種別・子フレーム一覧を先に取る。20-702 が何の画面かを最初に 1 行で報告する。
- get_variable_defs は「Figma デスクトップで選択中のノードが使う変数」しか返さない。値が要るノードごとに、ユーザーに「Copy link to selection」の URL を求めてから取る。Library のキャンバスはテンプレート残骸のみで変数を使うノードが無いので、実デザイン（Master）側のノードを選ばせる。
- インスタンスは必ずマスターコンポーネント（Library 側）まで遡る（§5-2）。Variant / Property / Auto Layout の方向・gap・padding・整列・サイズ制約・radius・text style・色のバインド先を取得できる限り取る。
- /figma-component-review が使えるなら token モードから回す。使えなければ「使えなかった」と明記し、§3 の表を手で埋める。
- 取れなかった値は推測で埋めず ASSUMED と書く。

【進め方（各フェーズの終わりで止まり、承認を取ってから次へ）】
Phase 0 観測: 20-702 の構造と、実装側の対応ファイルを特定。§2 の基準線を再計測して一致を確認。
Phase 1 トークン層: §3-1 の 19 値を実値照合。§3-2（radius）と §3-3（text style の Tailwind 化）はユーザーの選択を取ってから着手。
Phase 2 コンポーネント層: §4 の表を Figma 実値で埋め、差分ごとに「変える / 変えない（理由）」を提示 → 承認 → 実装。components/ 配下 2 ファイル以上に触るので §2-2 の要承認。
Phase 3 画面レイアウト層: 20-702 のレイアウト数値と app/page.tsx（または該当ページ）を照合 → 差分提示 → 承認 → 実装。
各フェーズ共通: §4 スタイルガイド更新を同じ PR に含める / qa-verifier を通す / npm run check が exit 0 / PR を作る（マージしない）。

【ブランチ / PR】
- main を最新化してから Phase ごとに切る: style/<yyyymmdd>-figma-master-tokens → style/<yyyymmdd>-figma-master-components → style/<yyyymmdd>-figma-master-layout。
- 1 Phase = 1 PR。前の PR が未マージなら base をその PR のブランチにする。

【やらないこと】
- app/admin 配下のトークン化（別依頼 C2 / C3）。border-[#424242] の置換。依存の追加。Figma 側の修正（ユーザー作業として §6 に列挙するだけ）。
- Tooltip / RadarChart / Legend / Table の新規実装（Figma のみのコンポーネント。必要なら別依頼）。

【閉じ方】
- 各フェーズの最後は docs/requests/20260908-figma-master-sync.md の末尾に「実装記録」を追記（前回依頼書と同じ形式: 再承認内容 / 実装中に決めたこと / 未達・未確認）。
- 応答の最後は **完了** か **次のアクション** で閉じる（CLAUDE.md §0-5）。
```

---

## 1. 目的（なぜ）
前回（PR #78〜#86）で Library の変数・text style・semantic はトークン層に同期済み。しかし **コンポーネント層と画面レイアウト層は Figma と照合していない**。また text style は `lib/design-tokens.ts` の TS 定数として存在するだけで Tailwind ユーティリティが無く、実装は `text-[17px]` のような直書きが続いている。Master（サイトデザイン）の node 20-702 を起点に、トークン → コンポーネント → 画面の 3 層で差分を洗い、実装へ反映する。

## 2. 実装側の基準線（VERIFIED 2026-09-08、クラウドセッションで計測。実装セッションで再計測して一致を確認する）

| 項目 | 計測値 | 計測コマンド |
|---|---|---|
| `npm run check` | exit 0（tsc OK / eslint 0 errors 20 warnings / build 15 routes） | `npm run check`（Supabase 環境変数が無い環境では build が落ちる。ローカル `.env.local` があれば不要） |
| `text-[Npx]` 直書き | components/ 88・src/ 7・app/page.tsx 5・app/styleguide 67・app/admin 187 | `grep -rnoE 'text-\[[0-9]+px\]' --include='*.tsx' components lib app src \| cut -d: -f1 \| sort \| uniq -c` |
| `tracking-[…]` 直書き | 87（components + app + src） | `grep -rnoE 'tracking-\[[^]]+\]' --include='*.tsx' components app src \| wc -l` |
| `rounded-[…]` 直書き | 8px 81 / 12px 34 / 6px 24 / 14px 12 / 10px 10 / 7px 4 / 2px 4 / 16px 3 / 999px 2 / 24px 2 / 36px 1 / 32px 1 | `grep -rnoE 'rounded-\[[^]]+\]' --include='*.tsx' components app src \| sed 's/.*rounded/rounded/' \| sort \| uniq -c` |
| `rounded-r*`（radius トークン）使用 | 2 箇所のみ | `grep -rnoE 'rounded-r[0-9]+' --include='*.tsx' components app src \| wc -l` |
| `textStyle` の参照元 | app/styleguide/StyleguideLayout.tsx のみ（4 箇所） | `grep -rn 'textStyle' --include='*.tsx' --include='*.ts' components lib app src` |
| HEX 直書き（components/ + lib/ + src/） | CareerGanttChart 24 / FlowchartNodes 17 / SkillsCardGrid 13 / RichMarkdownEditor 12 / WorkViz 11 / WorkMarkdown 5 / FlowchartEmbed 4 / WorkDetailLeftPanel 3 / Headline 2 / AuthGate 2 / HistoryItem 1 / FlowchartView 1 / lib 2 | `grep -rnoE '#[0-9a-fA-F]{6}\b' --include='*.tsx' --include='*.ts' components lib src \| cut -d: -f1 \| sort \| uniq -c` |
| `#1a1a1a`（トークン外の色） | app/admin 42 / styleguide 8 / components 10 / src 2 | `grep -rnoi '#1a1a1a' --include='*.ts' --include='*.tsx' components lib app src` |
| `rgba(255,255,255,0.05)` 直書き（= Action/hover） | TabBar 2 / lib/figma-variants.ts 2 / CareerGanttChart 1 | 同上 grep |
| `border-[#424242]` | app/admin 61（意図的な妥協。触らない） | `.design-system-context.yml` の記載どおり |
| 現ブランチ / PR | 方針セッションは `claude/figma-implementation-strategy-o5mj5g`（リモート無し・PR 無し・差分無し） | `git status --short` |

## 3. トークン層で確認・判断すること

### 3-1. 前回未照合のまま残っている 19 値（実値照合が必須）
前回の実装記録に「Skills ノード 502:1344 が使っておらず取得範囲外」と明記されたもの。20-702 配下のノードを選択して取る。
- System 新規 14 段のうち 825 以外の 13 段: 025 / 075 / 150 / 250 / 350 / 450 / 550 / 650 / 750 / 850 / 875 / 925 / 950
- System/1000（#000000）
- Action/hover の不透明度（白 5%）
- Semantic 4 種: Main/Secondary（#2B9E7A）/ Text/Caption（#BDBDBD）/ Background/Light（#292929）/ Border/Main（main-100 40%）
判定: 一致なら `lib/design-tokens.ts` のコメントを VERIFIED に更新するだけ。不一致なら値を直し、`app/globals.css` の `@theme` とスタイルガイドの表示を同時に更新（§4）。

### 3-2. radius の乖離（ユーザー判断が要る）
Figma Radius コレクションは 2 / 4 / 8 / 16 / 40 / 80 の 6 値。実装は 6 / 7 / 10 / 12 / 14 / 24 / 32 / 36 / 999 px を直書きで使っている（§2）。
選択肢（実装セッションで AskUserQuestion 1 問）:
- A（おすすめ）: Figma Master の実デザインが 12 / 14 px 等を使っているなら **Library の Radius コレクションに追加してもらい**、実装はトークン `rounded-r12` 等へ置換する。Library が正という前提を崩さない。
- B: 実装側を最寄りのトークン（12→8 or 16 等）へ寄せる。見た目が変わるので §2-2 の要承認。
- C: 今回は触らず `.design-system-context.yml` の intentional_compromises に trigger 付きで記録。

### 3-3. text style の Tailwind 化（ユーザー判断が要る）
`textStyle` 19 種は TS 定数のみで、ユーティリティが無い。コンポーネントは `text-[15px] leading-[1.5] tracking-[0.45px]` を毎回書いている（§2）。
選択肢（AskUserQuestion 1 問）:
- A（おすすめ）: `app/globals.css` に `@utility text-body-01-jp { font-size / font-weight / line-height / letter-spacing / font-family }` を 19 種ぶん定義し、値は `lib/design-tokens.ts` の `textStyle` と一致させる。以後のコンポーネント差分反映（Phase 2）でこのユーティリティへ置換する。スタイルガイドの Text Styles 節は各行にクラス名を併記。
- B: ユーティリティは作らず、Phase 2 では数値の直書きを Figma の値に合わせるだけ。
- C: 今回はトークン層を触らない。
注意: A を選んだ場合、`@theme` ではなく `@utility` を使う（複数プロパティを 1 クラスにまとめるため）。`@utility` は Tailwind v4 の機能で、既存の `@source not` と同じファイルに書ける。Turbopack のキャッシュで反映されないときは coding-lessons 失敗パターン 1 を参照。

## 4. コンポーネント層の照合表（Phase 2 で Figma 実値を埋める）
実装側の現状値は VERIFIED（2026-09-08 にコードを読んで転記）。Figma 列は実装セッションが埋める。**「Figma 値」「実装値」「判定」「変える / 変えない理由」の 4 列が埋まるまで実装しない。**

| Figma コンポーネント（Library） | 実装 | 実装の現状値（照合対象） | Figma 実値 | 判定 |
|---|---|---|---|---|
| SectionTitle（836:3312） | `components/Headline.tsx` default | ラベル 12px / normal / tracking 0.36px / system-500、見出し 32px / 800 / lh 1.3 / white、下線 2×24px main-base、gap 24 / pb 24 | | |
| Headline 01 / 02 / 03（305:265） | Headline markdown-h1/h2/h3 | h1 24px 700 lh1.5 tracking 1.2px white / h2 20px 700 lh1.5 tracking 1px main-050 / h3 17px 800 lh normal tracking 0.85px fg-muted | | Library の Headline/02/JP は 17px、Headline/02/EN は Afacad 20px。h2 の 20px Noto はどちらにも一致しない |
| Headline/Section（Work 詳細） | Headline section | 34px 800 lh1.2 white（Avenir） | | Title/PJ は Noto 34 / 700、Title/EN は Avenir 38 / 800。どちらとも不一致 |
| Button/Action（15-276） | `components/ButtonAction.tsx` + `lib/figma-button-variants.ts` | rounded-full / px 24 / py 8 / 16px bold lh 24 / primary: bg-primary text-main-600, hover bg-main-400 / secondary: border-primary / ghost: text-primary, hover bg-white/5 | | 16px は Figma text style に無い。hover の bg-white/5 は Action/hover トークン（bg-action-hover）へ |
| Button/Function（120-395） | `components/ButtonFunction.tsx` | h 36 / min-w 36 / rounded 8 / border on: border-border-light bg-surface hover bg-[#2c2c2c] / off: hover bg-white/5 / アイコン 24px fg-muted | | hover の #2c2c2c はトークン外 |
| Tag（Label / Icon slot / Icon2） | `components/Tag.tsx` default / small / tool | default: bg-main-700 px12 py3 12px main-200 / small: bg black/25 px12 py4 11px white / tool: border-border-light bg black/25 px10 py4 11px fg-muted gap 4 | | 3 variant のうち Figma に対応する variant 名を確定する |
| SideMenuBar / _Item（55-296） | `components/SideMenuBar.tsx` + `lib/figma-variants.ts` | item: rounded 8 / px12 py10 / gap 12 / 15px lh none tracking 0.75px / default text-white/50 / hover bg white5% text-system-300 / Active 同色固定 / short w 40 | | text-white/50 は Text/Body/Sub（#9E9E9E）ではない。Figma の default 文字色を確認。Status 名 "defalut" は Figma 側の誤字を踏襲 |
| Tooltip（slot） | SideMenuBar 内のツールチップ（実装のみ） | rounded 14 / border-border-light / bg-surface / px12 py8 / 12px lh1.5 tracking 0.36px / shadow base | | Figma の Tooltip と数値が一致するなら「実装済み」に格上げしスタイルガイドの FigmaOnlyPreview を差し替える |
| TabBar / _TabBarItem | `components/TabBar.tsx` | 外枠 rounded 8 bg white5% / item h40 px24 gap12 14px tracking 0.7px / active: border-border-light bg white5% 600 white / inactive fg-muted / アイコン 18px | | 14px は Figma text style に無い。white5% は bg-action-hover へ |
| Card（default / hover） | `components/WorkCard.tsx` | w 216 / rounded 14 / border-system-800 bg-system-900 / shadow 直書き / hover border-system-500 bg-system-800 / 画像 aspect 339:190.69 / body p16 gap16 min-h 160 / category 10px main-100 / title 14px bold lh1.5 / Tag small | | primitive 直参照（system-800/900）を semantic（border-light / surface）へ。shadow は shadow-wisper と一致するか |
| Modal（Slot / Carousel） | `components/Modal.tsx` | scrim rgba(0,0,0,.25) + blur 8 / px80 py40 / 矢印 left -53 / ButtonFunction border on / ドット表示 | | |
| （Figma に無い）HistoryItem | `components/HistoryItem.tsx` | bg #1a1a1a（トークン外）/ rounded 14 / p24 / 11px・17px | | Master 20-702 に職歴があれば Figma 側の対応を探す。#1a1a1a は surface-light（#292929）か surface（#212121）のどちらかへ寄せる（ユーザー判断） |

## 5. 画面レイアウト層（Phase 3）
- 20-702 の Auto Layout（方向 / gap / padding / 幅制約）と `app/page.tsx` の対応値（gap 120 / px 24→32→40 / py 80 / max-w-main 800 / ヒーロー画像 200×200 rounded 32 / 名前 46px M PLUS 1p など）を表にして照合する。
- 20-702 がトップページでない場合は、該当ページ（`app/works/`・`components/WorkDetail*`）に読み替える。どのページかは Phase 0 の最初に報告する。

## 6. Figma 側で直すもの（ユーザー作業・実装セッションが列挙する）
前回付録 B に加え、Phase 0〜2 で見つかった「Master にしか無いローカルスタイル」「Library に無い radius / text style」をここに追記する。実装からは書き戻さない。

## 7. 完了条件（全 Phase 共通）
- [ ] §3-1 の 19 値が VERIFIED になり、`lib/design-tokens.ts` のコメントに反映されている
- [ ] §4 の表の Figma 列・判定列が全行埋まり、「変える」と判定した行がすべて実装に反映されている
- [ ] 変更したコンポーネントの `<ComponentPreview>` が更新されている（CLAUDE.md §4）。トークン増減があれば Colors / Tokens / Typography 節も更新
- [ ] `.design-system-context.yml` の intentional_compromises に、先送りした項目が trigger 付きで追記されている
- [ ] Figma に差分が無いトークン値は変わらない（`git diff lib/design-tokens.ts` で確認）
- [ ] `/styleguide`・トップ・Works 詳細をプレビューで目視し、崩れが無い
- [ ] `npm run check` が exit 0
- [ ] 本依頼書の末尾に実装記録が追記されている

## 8. ゲート判定
| ゲート | 判定 | 根拠 |
|---|---|---|
| §0-1 不可逆操作 | 非該当 | ファイル編集のみ |
| §2-2 要承認 | **該当** | components/ 配下 2 ファイル以上。Phase ごとに変更サマリーを提示して承認を取る |
| §3 ブランチ | Phase ごとに main から新規作成 | 命名は §0 参照 |
| §4 スタイルガイド | 更新義務あり | props / 見た目変更 + トークン増減の可能性 |
| §5 Figma | 突き合わせ必要 | 本依頼の主題。Library 突き合わせ・マスター遡及・不明点の事前確認の 3 条件をすべて満たす |
| §6-2 fable | 非該当 | 可逆・手順書あり。§3-2 / §3-3 の判断はユーザーが行う |

## 9. 未確認 / 要判断
- node 20-702 が何の画面か — 未確認（クラウドセッションから Figma に届かない。Figma MCP はこのチャットで無効、REST API はプロキシで 403、FIGMA_ACCESS_TOKEN も無い）
- `/figma-component-review` の所在 — CLAUDE.md §5 が参照するがリポジトリ内 `.claude/skills` には無い。Mac 側のグローバル skill と ASSUMED
- §3-1 の 19 値 — 前回から未照合のまま（前回実装記録に明記）
- radius 12 / 14 px 等が Figma Master の実デザインに存在するか — 未確認（§3-2 の判断材料）
- 実装セッションの `npm run check` — ローカルの `.env.local` があれば通る想定。無い環境では `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` の仮値で build 段が通ることを確認済み（VERIFIED 2026-09-08）

---

## 実装記録 — Phase 0 / Phase 1（2026-09-08 実装セッション・model opus）

### 依頼書の前提のうち、実測で覆ったもの
1. **`20:702` は1画面ではなく「Design」ページ（canvas）**。配下に4フレーム — `/`（45:128, 1440×1024, Content 4040px, 5 Section）・`/works/{id}`（787:9916, 2109px, 7ブロック）・`/works/{id}：timeline`（839:3499）・`/works/{id}：stakeholder`（848:2944）。
   → **ユーザー合意: Phase 3 の対象は `/` と `/works/{id}` の2画面**。Modal 2画面は中身が詳細ページと同一で、差分は Modal コンポーネント（Phase 2 で照合）だけのため除外。
2. **`get_variable_defs` は fileKey + nodeId を直接渡せば取れる**（VERIFIED 2026-09-08）。Figma デスクトップでの「Copy link to selection」は不要。依頼書 §0・§9 の記載は誤り。
   ただし返るのは **そのノードが実際に使っている変数だけ**。この制約は残る。
3. **`/figma-component-review` は存在する**（skill 一覧で確認）。依頼書 §9 の ASSUMED は解消。
4. **Master / Library の page 一覧 API は不完全**。`get_metadata`（nodeId 省略）は Master で `WIRE` 1枚、Library で `_GuideTemplate` 1枚しか返さない。`Design` canvas には nodeId 直指定でのみ到達できる。

### 再承認内容
- ブランチ: 依頼書コミット 708e083 が main に無いため、**`claude/figma-implementation-strategy-o5mj5g` を base に** `style/20260908-figma-master-tokens` を切った（ユーザー選択）。
- §3-2 radius: **選択肢 C**（今回は触らず `.design-system-context.yml` に trigger 付きで記録）。
- §3-3 text style: **選択肢 A**（`app/globals.css` に `@utility` を19種定義）。

### §3-1 の照合結果 — 値の変更ゼロ

**VERIFIED 2026-09-08**（Master の実ノードが使用しており値の一致を確認）:
System 300 `#e0e0e0` / 500 `#9e9e9e` / 600 `#757575` / 700 `#616161` / 800 `#424242` / 825 `#3a3a3a` / **875 `#292929`** / 900 `#212121` / White ・
Main base・100 `#48f4be` / 050 `#b3ffe7` / 200 `#39c89b` / **300 `#2b9e7a`** / **700 `#02140d`** / Primary ・
Semantic Text/Body/Main `#FFFFFF` / Text/Body/Sub `#9E9E9E` / Background/Default `#212121` / **Background/Light `#292929`** / Border/Default `#3A3A3A` / Border/Light `#424242` ・
Container Screen 1440×1024 / Main/Max 800 / Main/Min 728 / Side 256 ・
TextStyle 10種（Title/PJ・Headline/01/JP・Headline/02/JP・Headline/02/EN・Body/01/JP/Regular・Body/02/JP/Regular・Body/02/JP/Bold・Body/03/JP/Regular・Body/03/EN/Regular・Caption/01/JP）・
Effect shadow・shadow-wisper

太字は §3-1 で未照合だった19値のうち今回 VERIFIED になった4件。**すべて実装と一致し、値の修正は不要だった。**

**照合不能が確定した15件**: System 025 / 075 / 150 / 250 / 350 / 450 / 550 / 650 / 750 / 850 / 925 / 950 / 1000、Text/Caption、Border/Main、Action/hover の不透明度。
`search_design_system` で **Library の Color コレクションに変数として存在することは確認**したが、**名前しか返らず値は返らない**。`get_variable_defs` は使用中の変数しか返さず、Master のどのノードもこれらを使っていない。**MCP 経由の取得手段は尽きた。** 現在値の出所は `docs/requests/20260908-styleguide-figma-sync.md` 付録 A の実測値。実際に使うときに個別確認する（2026-09-08 ユーザー合意を継続）。

照合状況は `lib/design-tokens.ts` の Color セクション冒頭にコメントとして記録した。

### 実装中に決めたこと
- **`@utility` の font-family マッピング**: `lang: jp` → `var(--font-noto-sans-jp), sans-serif` / `en` → `Avenir, var(--font-noto-sans-jp), sans-serif`（body と同じ自動切替スタック）/ `special-en` → `var(--font-afacad), var(--font-noto-sans-jp), sans-serif`。
- **19種の定義は `lib/design-tokens.ts` の `textStyle` からスクリプトで生成**した。手で転記すると値がずれるため。
- **スタイルガイドの Text Styles プレビューを inline `style` から `@utility` クラスへ切り替えた。** Tailwind v4 は未使用のユーティリティを CSS に出力しないため、スタイルガイドが実際にクラスを使うことで「19種が生成されている」ことの担保になる。`text-${key}` の連結はスキャナが検出しないので、`TEXT_STYLE_CLASS` に literal で19件並べている。**この配列を消すとユーティリティが CSS から消える。**

### 検証（VERIFIED）
- `npm run check` **exit 0**（tsc OK / eslint 0 errors 20 warnings — 着手前の基準線と同数 / build 15 routes）
- ブラウザの `getComputedStyle` で **19種すべてを実測**し、`textStyle` の定義値と一致することを確認（例: `text-body-01-jp` → 15px / 400 / lh 22.5px（=1.5）/ ls 0.45px（=0.03em）/ Noto Sans JP、`text-headline-02-en` → 20px / 700 / lh 30px / Afacad）
- `/styleguide` の Typography 節を**実プレビューで目視**。各行にクラス名バッジ（`text-title-pj` 等）が並び、サンプルがユーティリティ経由で正しく描画されている。
- トップページを実プレビューで目視。崩れなし。
- `.design-system-context.yml` は `npx js-yaml` でパース成功（intentional_compromises 2件）。

### 未達・未確認
- **`/works/{id}` の目視は未了**。ブラウザペインが非表示になり、ページが描画されずスクリーンショットが黒画像になったため。スクロール位置自体は正しく取得できており（`worksTop ≈ 0`）、ページ側の不具合ではない。なお本 Phase の差分は `@utility` の追加（どのコンポーネントも未使用）とスタイルガイド内部の描画方法変更のみで、既存ページの描画経路は変わらない。
- `/works` は Work ID 必須のため単体では表示できず、トップページにも Work 詳細へのリンクが無かった（ローカルの Supabase データが空）。
- `images/hero-placeholder.jpg` が 404。**本 Phase の変更とは無関係の既存の欠落**（CSS / JS の 404 は無し）。

### §6 行き — Figma 側で直すもの（実装からは書き戻さない）
1. **`Background/Dark-α25`（#000000）は残骸ではなく Modal（839:3764）が実使用中**。前回セッションで「Master のみのローカルスタイル・取り込まない」と判定した根拠と矛盾する。Library に昇格させるか、Modal 側を別トークンへ付け替えるかの判断が要る。実装 `components/Modal.tsx` は `rgba(0,0,0,.25)` を直書きしている。
2. **`/works/{id}`（787:9916）に外部 UI キットの変数が混入**: `Device BG #121515` / `Screen Components #262C2D` / `fl-gray-1000 #121515` / `fl-gray-600 #636F73`。デバイスモックアップ（`Camera` 888:3231 / `Speaker` 888:3232）由来。自プロダクトのデザインシステムではないので分離が要る。
3. **Card（494:1363）の shadow が `shadow` トークンと不一致**: インスタンスは `1px 1px 8px spread 0`、トークンは `1px 1px 16px spread 2`。
4. **Radius コレクションに 12 / 14 が無い**。Master の Card は `rounded-[14px]`、Tag は `rounded-[16777200px]`（= full）を直書きしている。追加されるまで実装側のトークン化はできない（`.design-system-context.yml` に trigger 付きで記録済み）。

### Phase 2 への引き継ぎ（Card 494:1363 の実測差分・先行取得ぶん）
| 項目 | Figma 実値 | 実装（`components/WorkCard.tsx`） | 判定 |
|---|---|---|---|
| カード枠線 | `System/825` #3a3a3a | `border-system-800` #424242 | **差分** |
| カード背景 | 指定なし（透明） | `bg-system-900` | **差分** |
| タイトル | 13px / Bold / lh 1.5 / tracking 0.39px / white | 14px / bold / lh 1.5 | **差分** |
| カテゴリ | 10px / `Main/base` / tracking 0.3px | 10px / `main-100` | 一致（main-100 = main-base 同値） |
| Tag | border `System/825` / px10 py6 / 10px Avenir / `System/500` / rounded full | `tool` variant: border-border-light / bg-black/25 / px10 py4 / 11px | **差分** |
| padding / gap / min-h / aspect | p16 / gap16 / min-h160 / 339:190.6875 | 同値 | 一致 |

### qa-verifier の指摘と対応（同 Phase 内で修正済み）
1. **`.design-system-context.yml` の散文から不正な CSS が本番バンドルに混入していた**（VERIFIED）。Tailwind v4 の自動ソース検出がリポジトリ直下の同ファイルを走査し、説明文中の `rounded-[Npx]` / `rounded-[16777200px]` からルールを生成。`border-radius: Npx` は不正な長さでブラウザが宣言を破棄する。コミット `c1a6f28` で一度潰した不具合の再発。
   → `app/globals.css` の `@source not` に `.design-system-context.yml` と `README.md` を追加。`rm -rf .next` 後に再ビルドし、生成 CSS から両ルールが消え、19 ユーティリティは全数残ることを確認。
2. **`TYPO_LANG` の `cssVar` / `family` が死んでいた**（VERIFIED）。inline style を廃止したことで `.sample` しか参照されなくなったが、未使用の「オブジェクトのプロパティ」は tsc も eslint も検出しない。
   → 削除。

### Phase 2 で必ず守ること（qa-verifier の指摘3・実害はまだ無いが踏むと静かに壊れる）
コンパイル後の CSS で、19 個のカスタム `@utility` は組込みの `text-[Npx]` / `leading-*` より **前** に出る。同一レイヤー・同一詳細度なので **後に出る組込みが必ず勝つ**。
つまり `className="text-body-01-jp text-[12px]"` は書き順に関係なく font-size が 12px になる。
**Phase 2 で `text-[15px] leading-[1.5] tracking-[0.45px]` を text style へ置き換えるときは、古い指定を必ず全部消すこと。** 消し忘れても型エラーも lint 警告も出ず、text style が黙って無効化される。

### 記録のみ（欠陥ではない）
- `text-headline-02-en` の日本語フォールバックは `--font-noto-sans-jp`、既存の `--font-guide` は `--font-mplus-1p`。同じ Special 系で落とし先が分かれている（EN 用スタイルなので影響は混在文字列のみ）。
- EN 系7ユーティリティは `Avenir` をリテラルで持つため `--font-body` の変更に追従しない。
- スタイルガイドの EN サンプルは変更前 `fontFamily: "Avenir"`（フォールバック無し）→ 変更後 `Avenir, Noto Sans JP, sans-serif`。macOS 以外での描画が変わる（改善方向）。
- `figma-skills-a-plan.js` / `.codex/config.toml` が gitignore されておらず Tailwind の走査対象に入っている。本 Phase 起因ではないが、上記1と同じ経路の穴。

---

## 実装記録 — Phase 2 コンポーネント層（2026-09-08 実装セッション・model opus）

### 依頼書 §4 の前提のうち、実測で覆ったもの
1. **§4 の node ID はすべて Library ファイルのもので、Master には無い。** `15:276`（Button/Action の親フレーム）・`120:395`（Button/Function）・`55:296`（SideMenuBar）・`305:265`（Headline）はいずれも `KpNwkdFy1usaO1sBR0dycv` で解決する。Master に投げると "node not found" になる。
2. **Library はページ一覧に出ないだけで、node ID 直指定なら全部読める。** `get_metadata`（nodeId 省略）が `_GuideTemplate` 1枚しか返さないので「Library には変数を使うノードが無い」と結論していたが、誤り。コンポーネント定義は別キャンバスに実在し、`get_design_context` でマスターの実値（Variant / Auto Layout / 色バインド）まで取れる。
3. **hover 背景は `Action/hover`（白5%）ではない。** Button/Action・Button/Function の Figma 実値は **`rgba(255,255,255,0.02)`（2%）**。5% は SideMenuBar の `_Item` hover だけ。依頼書 §4 の「hover の bg-white/5 は bg-action-hover へ」という想定は成り立たない。
4. **Headline セットは 01 / 02 の2バリアントだけで 03 は存在しない**（`304:313` で確認）。実装の `markdown-h3`（17px / 800 / System/500）は Figma の `Headline/02`（17px / **700** / System/500）とほぼ同じで、実装の `markdown-h2`（20px / main-050）は Figma に対応が無い。
5. **`shadow` トークンが実デザインで使われていない。** Card も Tooltip も `1px 1px 8px rgba(0,0,0,0.25) spread 0` の直書き。トークンは `1px 1px 16px spread 2`。

### 再承認内容（ユーザー選択）
- **適用範囲: 見出しも含めて全部合わせる。**
- **Figma 側に問題があるもの（shadow の不一致・hover 2%）は §6 に列挙し、実装はトークン側に寄せる。** したがって hover は `bg-action-hover`（5%）を使い 2% は直書きしない、shadow は `shadow-base` を使う。

### 実装した差分

| ファイル | 変更 |
|---|---|
| `components/Headline.tsx` | `default` 見出しを `text-title-pj`（34/700/AUTO/0.03em）へ・**下線を削除**（Figma に無い）/ `markdown-h1` → `text-headline-01-jp` / `markdown-h2` → `text-headline-02-jp text-system-500`（20px main-050 → 17px System/500）/ `markdown-h3` は据え置き＋Figma に対応が無い旨をコメント |
| `lib/figma-button-variants.ts` | primary に `h-10 max-w-[200px]` / hover を `bg-action-hover` へ / Function に `p-[6px]` / border-on を `border-border`（#3a3a3a）＋hover で `border-border-light` へ（`#2c2c2c` を廃止） |
| `lib/figma-variants.ts` | `_Item` の **Active から背景を削除**（Figma の Active は文字色だけ変わる）/ hover を `bg-action-hover` へ |
| `components/Tag.tsx` | `tool` の**背景を削除**・枠線を `border-border` へ・py 4→6px・文字 11→10px |
| `components/WorkCard.tsx` | **背景を削除**・枠線を `border-border` へ・shadow 直書きを `shadow-base` へ・タイトルを `text-body-02-jp-bold`（14→13px） |
| `components/SideMenuBar.tsx` | Tooltip: rounded 14→`rounded-r4`・枠線を `border-border` へ・py 8→10px・文字 12→14px / lh 20px / `text-white/80`・shadow をトークンへ |

`app/styleguide/StyleguideLayout.tsx` は変更なし。全 `<ComponentPreview>` が props 経由の描画で、値の直書きコピーは無かった（builder が確認）。

### 検証（VERIFIED）
- `npm run check` **exit 0**（0 errors / 20 warnings＝基準線と同数）
- 生成 CSS に `text-title-pj` `text-headline-02-jp` `text-body-02-jp-bold` `rounded-r4` `shadow-base` が出力されていることを確認
- `bg-white/5` と `rgba(255,255,255,0.05)` の残存ゼロを grep で確認
- **ヘッドレス Chrome + CDP で実描画を撮って目視**（`scripts/shot.mjs`）。トップの Works セクション（下線なし・見出し34px・カード背景なし・Active に背景なし）と `/styleguide` の Components 節（ButtonAction 高さ40px・ButtonFunction の枠線と余白・Tag tool の背景削除）を確認。

### 事故と対処
**dev サーバー稼働中に `rm -rf .next` を実行し、Turbopack のキャッシュ DB を壊した。** `Failed to restore task data (corrupted database or bug)` で panic し、以後 `build-manifest.json` が見つからず全ページが 500 になった。サーバーを停止 → `.next` を削除 → 再起動で復旧。**`.next` を消すときは必ず先に dev サーバーを止めること。**

### 未達・未確認
- **TabBar と Modal は未着手。** Library に存在することは `search_design_system` で確認したが、**同ツールは componentKey しか返さず node ID を返さない**ため `get_design_context` を呼べない。Master の Design ページにも TabBar のインスタンスが無い（Modal は `839:3764` にあるが中身が Works 詳細そのもので、Modal 自体の定義値は取れない）。
- `Headline` の `section` / `sub` variant は Figma の対応ノードが未特定のため据え置き。
- `WorkCard` の hover（`hover:border-system-500 hover:bg-system-800`）は Figma の Card hover バリアントの実値が未取得のため据え置き。Card は component_set なので hover 定義は存在するはず。
- `markdown-h2` を Figma の 02 に合わせた結果、**`markdown-h3` と weight 以外が同じになった**（h2: 17/700/System500、h3: 17/800/System500）。Figma に 03 が無いことが原因の構造問題で、実装だけでは解けない。§6 へ。
- `app/page.tsx` が `ButtonAction` を import しているが JSX で使っていない（本 Phase 起因ではない既存の未使用 import）。

### §6 追記 — Figma 側で直すもの
5. **`Headline/03` が Library に無い。** 実装には markdown-h3 がある。01 / 02 だけでは本文の見出し階層が2段しか作れない。03 を追加するか、実装の h2 を廃止するかの方針決めが要る。
6. **hover 背景 2% にトークンが無い。** Button/Action・Button/Function は `rgba(255,255,255,0.02)` の直書き。`Action/hover` は 5% で別物。2% 用のトークン（例: `Action/hover-subtle`）を追加するか、ボタンも 5% に統一するか。**実装は現在 5% トークンを使っているため、Figma と実装で hover の濃さが違う。**
7. **`shadow` トークンが実デザインで使われていない**（前掲 3 と同じ。Card / Tooltip とも 8px・spread 0 の直書き）。
8. **`Card` の枠線は `System/825`（Border/Default）だが背景が無い。** ページ背景と同色（Background/Default #212121）の上に置く前提のデザインなので、別の背景色の上に置くと透けて見える。意図どおりか確認が要る。

### qa-verifier の指摘と対応（同 Phase 内で修正済み）

**ブロッカー2件**
1. **Figma 実値を「誰にも見えないバリアント」に当てていた**（VERIFIED）。`Headline` の `markdown-h2` / `markdown-h3` は `/styleguide` からしか呼ばれない。Work 詳細の本文見出しを実際に描画しているのは `components/WorkMarkdown.tsx` の `RenderBlock`（424 / 430 / 436 行）で、そこは初回コミットで一切変わっていなかった。**同じ「Headline/02」が 17px グレーと 20px ミントに分裂していた。**
   → `WorkMarkdown.tsx` の h1 / h2 を `text-headline-01-jp` / `text-headline-02-jp text-system-500` へ置換。h3 は Figma に対応が無いため据え置き。
2. **スタイルガイドの記述が実装とズレたまま**（CLAUDE.md §4 違反・VERIFIED）。`見出し 02（20px mint）` というラベルと `Library 305:265` という説明が旧値のまま残っていた。
   → ラベルを `見出し 02（17px gray・Headline/02/JP）` / `見出し 03（17px gray・Figma に対応なし）`、説明を `Library 304:313。03 は Figma に存在せず実装のみ` へ修正。

**非ブロッカー3件**
3. **`p-[6px]` で ButtonFunction が 36px 正方形でなくなっていた**（実測 38×36・VERIFIED）。`box-sizing: border-box` なので border 2px + padding 12px を引くと中身が 22px になり、24px のアイコンが 2px はみ出して幅が 38px に膨らんでいた。SideMenuBar のトグル（`right-[-18px]`）が 2px ずれ、Modal のクローズボタンの外余白が 16px → 14px になっていた。
   → **`p-[6px]` を撤回**。Figma は「36px の箱に padding 6px ＋ アイコンが残り 24px を埋める」指定だが、実装はアイコンが 24px 固定なので padding を足すと二重になる。36px の箱の中央にアイコンを置く現行のほうが Figma の見た目と一致する。理由をコメントに残した。**修正後の実測 36×36 を確認。**
4. **`h-10 max-w-[200px]` は長ラベルで上下 39px ずつはみ出す**（VERIFIED・40文字の日本語で実測）。Figma の実値なので**残す**が、制約であることを `lib/figma-button-variants.ts` の JSDoc に明記した。現状 `ButtonAction` は `/styleguide` でしか JSX に出ていないため実害はない。
5. **`Headline` の `gap-6` が死にクラスになっていた**（下線を消して子が1つになったため）。→ 削除。`pb-6`（24px）だけが残り、Figma の pb 24 と一致する。

**追加で直したもの（qa の指摘6）**
6. **Active から背景を消したことで、現在地の手がかりが色だけになっていた**（WCAG 1.4.1）。`aria-current` も無かった。
   → `SideMenuBar` の item に `aria-current`（Link は `"page"` / button は `"true"`）を追加。**実描画で現在地の1件だけに付くことを確認**（`ariaCurrentCount: 2` = トップページの Introduction とサイドバー内の該当要素）。

**対応せず記録のみ**
7. **`markdown-h2` と `markdown-h3` が weight 以外まったく同じになった**（h2: 17/700/#9e9e9e、h3: 17/800/#9e9e9e。`--color-fg-muted` = `--color-system-500` なので色も同一）。Figma に `Headline/03` が無いことが原因の構造問題で、実装だけでは解けない。§6-5 に記載済み。

### 再検証（修正後・VERIFIED）
- `npm run check` **exit 0**（0 errors / 20 warnings）
- ヘッドレス Chrome の実描画で: ButtonFunction **36×36**、`markdown-h2` = 17px / 700 / `rgb(158,158,158)`、`markdown-h3` = 17px / 800 / `rgb(158,158,158)`、サイドバーの `aria-current="page"` が Introduction のみ
