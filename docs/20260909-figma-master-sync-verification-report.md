# Figma Master 同期 — 独立検証報告書

- 実施日: 2026-09-09
- 対象: PR #88 / #89 / #90
- 対象ブランチ: `style/20260908-figma-master-layout`
- テスト仕様書: `docs/20260909-figma-master-sync-test-spec.md`
- 実装記録: `docs/requests/20260908-figma-master-sync.md`
- 検証者の役割: 実装を変更しない独立検証者

## 1. 結論

**総合判定: 修正必要**

全84ケースを確認し、合格80件、不合格2件、未確認2件だった。

| 区分 | 件数 | ID |
|---|---:|---|
| 合格 | 80 | 下表の PASS 項目 |
| 不合格 | 2 | `L-4`, `W-12` |
| 未確認 | 2 | `R-5`, `R-9` |

不合格の要点:

1. `L-4`: トップページの `section#skills` 自体は `max-width: 800px` ではなく、1440px viewport で幅1104pxだった。
2. `W-12`: 54文字の `role` で `scrollWidth 585 > clientWidth 576` となり、9px横に溢れた。

未確認の要点:

1. `R-5`: 固定ナビが `tabIndex=0` で、クリック時の遷移と先頭復帰は確認したが、ブラウザ制御では Tab フォーカス移動を再現できなかった。
2. `R-9`: 現在の admin preview が正常に描画され、コードの既定値も維持されていることは確認した。比較用の過去版実描画がないため「見た目が変わっていない」は断定していない。

## 2. 環境と判定方法

| 項目 | 観測値 |
|---|---|
| リポジトリ | `/Users/tommyu/Dev/portfolio` |
| ブランチ | `style/20260908-figma-master-layout` |
| dev server | Preview `portfolio-dev`, `http://localhost:3000` |
| 実データの Work | `c5b71719-c894-4678-9785-26887c0021b3` |
| build出力先 | `.next-verify`（検証後にリポジトリ外へ退避） |

- CSSと寸法は `getComputedStyle()` / `getBoundingClientRect()` で判定した。
- 横溢れは `document.documentElement.scrollWidth > clientWidth` で判定した。
- build、lint、YAMLはexit codeで判定した。
- スクリーンショットの目視だけではPASSにしていない。
- `/styleguide` の異常系サンプルは一時変更後に復元し、最後に `git diff --exit-code` のexit 0を確認した。

主な実行コマンド:

```bash
NEXT_DIST_DIR=.next-verify npm run check
git diff claude/figma-implementation-strategy-o5mj5g..HEAD -- lib/design-tokens.ts
rg -n '^@source not' app/globals.css
rg -rEn '(text-(title|headline|body|caption)-[a-z0-9-]+)' --include='*.tsx' app components src lib
npx --yes js-yaml .design-system-context.yml
git diff --exit-code
git status --short
```

ブラウザでは各URLへ移動後、対象要素をroleまたはCSS selectorで取得し、次の値を機械的に収集した。

```js
const style = getComputedStyle(element);
const rect = element.getBoundingClientRect();
const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
```

## 3. 合否サマリー

### 3-1. §3 門

| ID | 判定 | 観測値 | 期待値 | コマンド |
|---|---|---|---|---|
| G-1 | PASS | exit 0 | exit 0 | `NEXT_DIST_DIR=.next-verify npm run check` |
| G-2 | PASS | 0 errors / 19 warnings | 0 errors / 19 warnings | 同上 |
| G-3 | PASS | 15 routes | 15 routes | 同上 |

最初のsandbox内実行はGoogle Fontsへのネットワーク制限で失敗した。ネットワーク許可付きで同じコマンドを再実行し、上記結果を得た。アプリケーションの失敗とは扱っていない。

### 3-2. §4 トークン層

| ID | 判定 | 観測値 | 期待値 | コマンド |
|---|---|---|---|---|
| T-1 | PASS | コメント以外の変更0行 | 0行 | `git diff ... -- lib/design-tokens.ts`＋非コメント行集計 |
| T-3 | PASS | token 19 / utility 19 / matched 19 / mismatch 0 | 19件一致 | Nodeインライン比較スクリプト |
| T-4 | PASS | map 19 / missing 0 / extra 0 | 過不足0 | Nodeでキーを比較 |
| T-5 | PASS | 不正radius 0件 | 0件 | 本番CSSを`border-radius:Npx\|16777200px`で検索 |
| T-6 | PASS | 除外対象5件あり | 5件 | `rg -n '^@source not' app/globals.css` |
| T-7 | PASS（記録） | custom 239097 / `text-[` 239544 / `font-bold` 241562 | customが先 | 本番CSSのバイト位置を比較 |
| T-8 | PASS | text styleと旧指定の併記0件 | 0件 | 指定`rg`のヒット行を機械検査 |

#### T-2: text style 19種

`/styleguide` で19クラスを反復し、`getComputedStyle()` を取得した。観測値は `font-size / font-weight / line-height / letter-spacing / font-family` の順。

| ID | クラス | 判定 | 観測値 | 期待値 |
|---|---|---|---|---|
| T-2a | `text-title-pj` | PASS | 34 / 700 / normal / 1.02 / Noto | 同値 |
| T-2b | `text-title-en` | PASS | 38 / 800 / normal / 1.14 / Avenir | 同値 |
| T-2c | `text-headline-01-jp` | PASS | 24 / 700 / 36 / 1.2 / Noto | 同値 |
| T-2d | `text-headline-01-en` | PASS | 24 / 800 / normal / 1.2 / Avenir | 同値 |
| T-2e | `text-headline-02-jp` | PASS | 17 / 700 / normal / 0.85 / Noto | 同値 |
| T-2f | `text-headline-02-en` | PASS | 20 / 700 / 30 / 1 / Afacad | 同値 |
| T-2g | `text-body-01-jp` | PASS | 15 / 400 / 22.5 / 0.45 / Noto | 同値 |
| T-2h | `text-body-01-jp-bold` | PASS | 15 / 700 / 22.5 / 0.45 / Noto | 同値 |
| T-2i | `text-body-01-en` | PASS | 17 / 400 / normal / normal / Avenir | 同値 |
| T-2j | `text-body-02-jp` | PASS | 13 / 400 / 19.5 / 0.39 / Noto | 同値 |
| T-2k | `text-body-02-jp-bold` | PASS | 13 / 700 / 19.5 / 0.39 / Noto | 同値 |
| T-2l | `text-body-02-en` | PASS | 15 / 400 / normal / normal / Avenir | 同値 |
| T-2m | `text-body-03-jp` | PASS | 11 / 400 / 16.5 / 0.33 / Noto | 同値 |
| T-2n | `text-body-03-jp-bold` | PASS | 11 / 700 / 16.5 / 0.33 / Noto | 同値 |
| T-2o | `text-body-03-en` | PASS | 13 / 400 / normal / normal / Avenir | 同値 |
| T-2p | `text-caption-01-jp` | PASS | 10 / 400 / normal / 0.3 / Noto | 同値 |
| T-2q | `text-caption-01-en` | PASS | 12 / 400 / normal / normal / Avenir | 同値 |
| T-2r | `text-caption-02-jp` | PASS | 9 / 400 / normal / 0.27 / Noto | 同値 |
| T-2s | `text-caption-02-en` | PASS | 11 / 400 / normal / normal / Avenir | 同値 |

機械比較の出力:

```text
tokenCount: 19
utilityCount: 19
matched: 19
mismatches: []
```

### 3-3. §5 コンポーネント層

| ID | 判定 | 観測値 | 期待値 |
|---|---|---|---|
| C-1 | PASS | Works見出し 34/700/normal/1.02、下線0件 | 同値、下線なし |
| C-2 | PASS | 17/700/`rgb(158,158,158)` | 同値 |
| C-3 | PASS | 17/800/`rgb(158,158,158)` | 同値 |
| C-4 | PASS | default 32、sub 12、section/h1/h2/h3 0px | 同値 |
| C-5 | PASS | height 40、width 167.617、max-width 200 | height 40、最大200 |
| C-6 | PASS | secondary/ghostとも`hover:bg-action-hover`、2%直書きなし | 白5%トークン |
| C-7 | PASS | 36×36 | 36×36 |
| C-8 | PASS | border rgb(58)、background rgb(33) | 同値 |
| C-9 | PASS | 背景透明、border rgb(58)、font 10、padding 6/10 | 同値 |
| C-10 | PASS | 背景透明、border rgb(58)、shadow `.25 1px 1px 16px 2px`、タイトル13/700/19.5 | 同値 |
| C-11 | PASS | Active 1件、背景透明、色rgb(224) | 同値 |
| C-12 | PASS | radius 4、padding 10/12、14px/20px、文字alpha .8 | 同値 |
| C-13 | PASS | background rgb(41) | 同値 |
| C-14 | PASS | 3項目ともpadding 16/24、height 40 | 同値 |
| C-15 | PASS | weight 800、background rgb(33)、border rgb(58) | 同値 |
| C-16 | PASS | 3画像ともnaturalWidth 24、表示18×18 | naturalWidth 24 |
| C-17 | PASS | radius16、border rgb(58)、scrim padding40、shadow `.1 0 1px 3px` | 同値 |
| C-18 | PASS | コンテナ右端との隙間9px、top -1px | 同値 |

### 3-4. §6 トップページ

| ID | 判定 | 観測値 | 期待値 |
|---|---|---|---|
| L-1 | PASS | columns `392px 392px`、gap16、カード392 | 同値 |
| L-2 | PASS | 639: 1列591、640: 2列288、768: 2列352、1024: 2列344 | 640px以上2列 |
| L-3 | PASS | rowGap120、padding上下80 | 同値 |
| L-4 | **FAIL** | hero/introduction/career/worksは800、skillsはmaxWidth `none`・幅1104 | 各section maxWidth 800 |
| L-5 | PASS | 画像200×200、gap 64/8/8、名前下揃え | 同値 |
| L-6 | PASS | 段落グループ40、内部16 | 同値 |

### 3-5. §7 Works詳細

| ID | 判定 | 観測値 | 期待値 |
|---|---|---|---|
| W-1 | PASS | column 800、rowGap48、padding 40/80 | 同値 |
| W-2 | PASS | column left 448 | 448 |
| W-3 | PASS | aside幅256 | 256 |
| W-4 | PASS | `/#introduction`, `/#career`, `/#works`, `/#skills` | 同値 |
| W-5 | PASS | 上部境界線1本、本文section間0本 | 同値 |
| W-6 | PASS | 6セルすべてheight40、background rgb(41) | 同値 |
| W-7 | PASS | border rgb(58)、radius8 | 同値 |
| W-8 | PASS | データ有無とも6セル・3行 | 常に3行 |
| W-9 | PASS | 欠損値は`—`、禁止文言なし | 同値 |
| W-10 | PASS | 期間/役割/関係者、アイコン各16×16 | 同値 |
| W-11 | PASS | 実Workは24×24が2個、欠損状態は0個 | 同値 |
| W-12 | **FAIL** | `scrollWidth 585`、`clientWidth 576`、title全文あり | `scrollWidth === clientWidth` |
| W-13 | PASS | 375: main375、固定矢印なし、末尾ナビあり、overflowなし | 同値 |
| W-14 | PASS | 768: main768、固定矢印なし、末尾ナビあり、overflowなし | 同値 |
| W-15 | PASS | 1024: main768、固定矢印なし、末尾ナビあり、overflowなし | 同値 |
| W-16 | PASS | 1090: main834、column800、固定矢印なし、末尾ナビあり | 同値 |
| W-17 | PASS | 1280: main1024、column左368、矢印右端300、非重複、overflowなし | 同値 |
| W-18 | PASS | 1440: main1184、column左448、矢印右端300、非重複、overflowなし | 同値 |

### 3-6. §8 回帰テスト

| ID | 判定 | 観測値 | 期待値 |
|---|---|---|---|
| R-1 | PASS | href `#introduction`、クリック後top 0、current Introduction | 同値 |
| R-2 | PASS | open時overflow hidden、Esc後`""` | 同値 |
| R-3 | PASS | Close・背景クリック後ともoverflow `""` | 同値 |
| R-4 | PASS | Close・背景クリック後ともoverflow `""` | 同値 |
| R-5 | **未確認** | `tabIndex=0`、クリック遷移とscrollY 0は確認。Tab移動は再現不可 | Tab→Enterで遷移 |
| R-6 | PASS | sections空で本文null、浮いた罫線0 | 同値 |
| R-7 | PASS | 0枚:0、1枚:1、3枚:2。3枚時は126×257・同一行 | 最大2枚で崩れなし |
| R-8 | PASS | 404画像0、`BrokenTool`テキストTag表示 | テキストへfallback |
| R-9 | **未確認** | 現行previewはalert 0・横overflowなし。コード既定値も一致 | 過去版と見た目同一 |
| R-10 | PASS | エラー容器1280×720、横overflowなし、文言・戻るリンク表示 | 崩れなし |
| R-11 | PASS | Card幅392。復元後も392 | 392 |
| R-12 | PASS | exit 0、`intentional_compromises` 4件 | exit 0・4件 |
| R-13 | PASS | tracked diffなし。未追跡6項目は開始時と同一 | 同値 |

## 4. 不合格・未確認の再現記録

### 4-1. L-4 — Skills sectionの幅

- ラベル: **VERIFIED**
- 指摘: `section#skills` 自体が800px制約を持たない。
- 期待値: `maxWidth: 800px`

```js
[...document.querySelectorAll("main section")].map((element) => ({
  id: element.id,
  maxWidth: getComputedStyle(element).maxWidth,
  width: element.getBoundingClientRect().width,
}));
```

```text
hero:         maxWidth 800px / width 800
introduction: maxWidth 800px / width 800
career:       maxWidth 800px / width 800
works:        maxWidth 800px / width 800
skills:       maxWidth none  / width 1104
```

内側の見出し・コンテンツには800px制約があるが、テスト仕様書は各`<section>`自体の`maxWidth`を期待しているため不合格とした。

### 4-2. W-12 — 長いroleの横溢れ

- ラベル: **VERIFIED**
- 指摘: 54文字のroleで内容セルが9px横に溢れた。
- 期待値: `scrollWidth === clientWidth`
- `title`属性: 全文あり

一時入力:

```text
リードUI/UXデザイナー・プロジェクトマネージャーとして情報設計・検証・実装連携・品質保証まで一貫して担当
```

```js
({
  scrollWidth: roleCell.scrollWidth,
  clientWidth: roleCell.clientWidth,
  title: roleCell.getAttribute("title"),
});
```

```text
scrollWidth: 585
clientWidth: 576
title: 全文あり
```

### 4-3. R-5 — Tab操作

- ラベル: **未確認**
- 確認できたこと:
  - 固定「次のWork」buttonは`tabIndex=0`、`disabled=false`、36×36px。
  - マウスクリックではIDが変わり、遷移後の`scrollY`は0。
- 確認できなかったこと:
  - BrowserのTab入力後も`document.activeElement`が`BODY`のままで、Tab→Enter経路を再現できなかった。

```text
before: ?id=c5b71719-c894-4678-9785-26887c0021b3
after:  ?id=794dc818-3005-4a5e-9b15-8e96d18c3ed3
scrollY: 0
```

### 4-4. R-9 — admin previewの過去版との比較

- ラベル: **未確認**
- 現在の観測値: `/admin/works/edit` は描画され、alert 0件、horizontal overflowなし、本文previewあり。

```bash
rg -n "gap-\[120px\]|withDividers" components/WorkMarkdown.tsx
```

```text
gapClass = "gap-[120px]"
withDividers = false
```

比較用の過去版スクリーンショットまたは同一viewportの実描画基準がないため、視覚的な同一性は未確認とした。

## 5. §9として不合格にしなかったもの

今回の観測に現れたが、テスト仕様書§9に従って不合格から除外した項目:

- §9-1: markdown-h2 / h3がweight以外同一
- §9-2: hoverがFigmaの2%ではなくAction/hoverの5%
- §9-3: shadowがFigma直書き値ではなくトークン値
- §9-5: `/works` のサイドバーがxl未満で非表示
- §9-6: Timeline / StakeholderモーダルがEscで閉じない

## 6. 検証終了時の作業ツリー

一時変更はすべて復元済み。

```text
$ git diff --exit-code
exit 0
```

未追跡ファイルは検証開始時と同一:

```text
?? .codex/config.toml
?? _to_delete/
?? docs/figma-color-token-sync-prompt.md
?? figma-skills-a-plan.js
?? learnings/20260906-cowork-figma-unreachable.md
?? supabase/.temp/
```

## 7. 次の作業

`docs/requests/20260909-figma-master-sync-verification-followup.md` のプロンプトを新しいセッションへ渡し、不合格2件の是正と未確認2件の再検証を行う。
