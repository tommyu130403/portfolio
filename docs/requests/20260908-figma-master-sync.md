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
