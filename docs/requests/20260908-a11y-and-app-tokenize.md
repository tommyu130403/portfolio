# 依頼書 — フォーカスリングのコントラスト是正 / プレースホルダ色の統一 / `app/` 配下のトークン化

- 作成日: 2026-09-08
- 状態: **A・B・C1 完了（2026-09-08）** — A+B は PR #83（`fix/20260908-a11y-focus-placeholder`）、C1（`app/styleguide` 70 + `app/page.tsx` 11）は PR #84（`refactor/20260908-tokenize-app-styleguide`、base は #83）。**残りは C2（`app/admin/AdminLayout.tsx` 176）と C3（`WorkEditor` 54 / `FlowchartEditor` 33）で未着手**
- 種別: A = `fix` / B = `fix` / C = `refactor`
- 前提 PR: #78・#80・#81（いずれもマージ済み）
- 関連依頼書: `docs/requests/20260908-styleguide-figma-sync.md`、`docs/requests/20260908-pr78-review-and-tokenize.md`

---

PR #81（`components/` と `lib/` の直書き色をトークン参照へ置換）の検証中に見つかった3件を引き継ぐ。**3件とも PR #81 が作った問題ではない。** 値はいずれも以前から同じで、トークン化によって「名前として可視化された」もの。**どれも着手要否の判断から委ねる。**

- **A. フォーカスリングのコントラスト不足** — キーボード操作に影響。3件のうち唯一ユーザーへの実害がある
- **B. プレースホルダ色が3種に割れている** — 見た目の一貫性とコントラスト
- **C. `app/` 配下 353箇所のトークン化** — PR #81 の続き。規模が大きい

**A と B は同じ性質（アクセシビリティ）なので1つの PR にまとめてよい。C は独立。**

---
---

# A. フォーカスリングのコントラストが不足している

## 観測事実（VERIFIED 2026-09-08）

`lib/figma-variants.ts:30-31`

```ts
export const ITEM_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-light focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
```

`ring-border-light` は `#424242`。サイドバーの背景 `#212121` に対する**コントラスト比は 1.60:1**。

| | 色 | 背景 | 比 |
|---|---|---|---|
| 現状 | `#424242`（border-light） | `#212121` | **1.60:1** |
| プロジェクト既定 | `#48F4BE`（main-100） | `#212121` | 11.47:1 |
| 参考 `fg-muted` | `#9E9E9E` | `#212121` | 6.01:1 |
| 参考 `fg-caption` | `#BDBDBD` | `#212121` | 8.57:1 |

**WCAG 2.1 SC 1.4.11（非テキストのコントラスト）は 3:1 を要求する。** 1.60:1 は基準の約半分で、キーボード操作時にどの項目を選んでいるかが視認しづらい。

## なぜ問題か

`app/globals.css:10-14` はサイト全体の既定フォーカスを定義している。

```css
:focus-visible {
  outline: 2px solid var(--color-main-100);   /* #48F4BE = 11.47:1 */
  outline-offset: 2px;
  border-radius: 2px;
}
```

`ITEM_FOCUS` は `outline-none` でこれを打ち消し、グレーのリングに差し替えている。**リポジトリ全体で `focus-visible:` を独自定義しているのはこの1箇所だけ**（grep 済み）。つまり「サイト唯一の例外が、唯一 WCAG を満たしていない」状態。

## 影響範囲（VERIFIED）

```
lib/figma-variants.ts:30  ITEM_FOCUS 定義
lib/figma-variants.ts:48-49  getItemClasses() が連結
components/SideMenuBar.tsx:9  getItemClasses / resolveItemStatus を import
```

利用元は **`components/SideMenuBar.tsx` のみ**。ただし SideMenuBar はサイトの主ナビゲーションで、トップページと admin の全画面に出る。キーボード利用者が最初に触れる要素。

## 選択肢

- **(a) 既定に合わせる** — `ITEM_FOCUS` を削除し、`app/globals.css` のグローバル既定（ミントの outline）に任せる。最も単純で 11.47:1 を満たす。ただし Figma に「サイドバー項目のフォーカスはグレーのリング」という指定があるなら、それに反する
- **(b) リング色を上げる** — `ring-border-light` → `ring-fg-muted`（#9E9E9E・6.01:1）や `ring-primary`（#48F4BE・11.47:1）へ。リングという見せ方は保つ
- **(c) 意図的な妥協として記録する** — Figma がこの見た目を指定しているなら `.design-system-context.yml` の `intentional_compromises` に理由と再検討トリガーを書く

## 着手前に確認が要ること

**Figma のサイドバー `_Item` のフォーカス状態に指定があるか。** `docs/requests/20260908-styleguide-figma-sync.md` の付録 A によると、Figma の SideMenuBar には `_Item` が 9 variants ある。フォーカス状態が定義されているかは未確認。

Figma の値を取るときの注意は `~/.claude/projects/-Users-tommyu-Dev-portfolio/memory/figma-get-variable-defs-selection-scope.md` に記録済み。要点は「`get_variable_defs` は Figma デスクトップで**選択中のノードが使っている変数**しか返さない」「Library ファイルは canvas がテンプレート残骸なので取得できない。Master の実デザイン画面を選択する」。

## 完了条件の案

- [ ] サイドバー項目のフォーカスリングのコントラスト比が **3:1 以上**（実測して数値を報告する）
- [ ] キーボードの Tab でサイドバーを辿り、**実プレビューでフォーカスが見えることを目視**する
- [ ] `npm run check` が exit 0

---
---

# B. プレースホルダの色が3種に割れている

## 観測事実（VERIFIED 2026-09-08）

`components/` の3つの入力欄が、それぞれ別のプレースホルダ色を使っている。

| 箇所 | クラス | 色 | 背景 | コントラスト |
|---|---|---|---|---|
| `components/AuthGate.tsx:80` | `placeholder-system-800` | `#424242` | `#1A1A1A` | **1.73:1** |
| `components/RichMarkdownEditor.tsx:103` | `placeholder-system-700` | `#616161` | `#141414` | **2.97:1** |
| `components/RichMarkdownEditor.tsx:312` | `placeholder-system-825` | `#3A3A3A` | `#141414` | **1.62:1** |

一方 **`app/` 配下は 9箇所すべてが `placeholder-[#616161]` で統一されている**（`app/admin/AdminLayout.tsx` ×6、`app/admin/works/edit/WorkEditor.tsx` ×2、`app/styleguide/StyleguideLayout.tsx` ×1）。つまり `#616161`（`system-700`）が事実上の標準で、`components/` の3件が例外。

## なぜ問題か

- **一貫性**: 同じ「入力のヒント文」が画面によって違う濃さで出る
- **可読性**: SC 1.4.3（テキストのコントラスト）は 4.5:1 を要求する。3件とも下回る。特に `#3A3A3A` の 1.62:1 はほぼ背景と同化している
- **セマンティック層の不在**: プレースホルダ用の semantic トークンが無いため primitive 直参照になっており、値が割れても気づけない

## 選択肢

- **(a) `system-700`（#616161）に揃える** — `app/` 側の事実上の標準に合わせる。変更が最小。ただし 2.97:1 で SC 1.4.3 は満たさない
- **(b) `fg-muted`（#9E9E9E）に揃える** — `#141414` 上で **6.88:1** となり SC 1.4.3 を満たす。ただし `app/` 側 9箇所との差が生まれるので、`app/` も同時に変えるか、差を許容するかの判断が要る
- **(c) semantic トークンを新設する** — `Figma に対応する paint style があるか` を先に確認する。無いなら実装ローカルのトークンになるため、`.design-system-context.yml` への記録が要る

## 着手前に確認が要ること

**Figma に Placeholder / Text/Disabled 等の paint style があるか。** `docs/requests/20260908-styleguide-figma-sync.md` の付録 A では Library の paint style は 11種で、プレースホルダ用は含まれていない（Main/Primary・Main/Secondary・Text/Body/Main・Text/Body/Sub・Text/Caption・Background/Default・Background/Light・Border/Default・Border/Light・Border/Main・Action/hover）。**つまり Figma には無い可能性が高い。**

## 完了条件の案

- [ ] プレースホルダの色が **1種類**に統一されている（`components/` と `app/` の扱いを決めたうえで）
- [ ] 選んだ色のコントラスト比を実測して報告する
- [ ] 実プレビューで3つの入力欄を目視する（AuthGate はログイン画面なので表示手順の確認が要る）
- [ ] `npm run check` が exit 0

---
---

# C. `app/` 配下 353箇所のトークン化

## 観測事実（VERIFIED 2026-09-08）

PR #81 で `components/` と `lib/` は完了した。残りは以下。

```
app/ + src/ のクラス形式 生HEX: 465箇所
  トークンと完全一致（置換候補）: 353箇所 / 8色
  独自色（対応トークンなし）:     112箇所 / 13色
```

置換候補のディレクトリ別:

| | 件数 |
|---|---|
| `app/admin` | 271 |
| `app/styleguide` | 71 |
| `app/`（その他） | 11 |
| `src/` | 0 |

上位の色:

| HEX | 件数 | トークン |
|---|---|---|
| `#424242` | 87 | `system-800` |
| `#616161` | 83 | `system-700` |
| `#9E9E9E` | 70 | `system-500` |
| `#48F4BE` | 67 | `main-100` |
| `#F4487E` | 25 | `danger-300` |
| `#212121` | 15 | `system-900` |
| `#BDBDBD` | 5 | `system-400` |
| `#B3FFE7` | 1 | `main-050` |

## PR #81 で確立した規則（そのまま使える）

**接頭辞（用途）と semantic の役割が一致するときだけ semantic を使い、ずれるものは primitive にする。**

| 元 | 置換後 | 理由 |
|---|---|---|
| `border-[#424242]` | `border-border-light` | Border/Light と役割一致 |
| `bg-[#424242]` | `bg-system-800` | `borderLight` は境界の役割で `bg-` とずれる |
| `text-[#9E9E9E]` | `text-fg-muted` | Text/Body/Sub と役割一致 |
| `bg-[#9E9E9E]` | `bg-system-500` | `fgMuted` はテキストの役割 |
| `text`/`bg`/`border`/`accent-[#48F4BE]` | `*-primary` | 役割中立 |
| `bg-[#212121]` | `bg-surface` | Background/Default |
| `text-[#BDBDBD]` | `text-fg-caption` | Text/Caption |
| `text-[#616161]` | `text-system-700` | 対応 semantic なし |
| `text-[#F4487E]` | `text-danger-300` | 対応 semantic なし |

`#48F4BE` は `main-100` と `main-base` の両方に一致するが、**数値スケール側（`main-100`）を採る**。

## 踏んではいけない罠（すべて実測で確認済み）

1. **`--include='*.tsx'` だけでは足りない。** `.ts` にもクラス文字列がある（`lib/figma-button-variants.ts` がこれで数え漏れた）。`--include='*.ts'` と `-i`（HEX の大文字小文字ゆれ）を必ず付ける
2. **`app/styleguide/StyleguideLayout.tsx` の 71箇所は「置換禁止」ではない（VERIFIED）。** 前の依頼書は「パレット見本なので置換禁止」と書いていたが、実際にはパレットのスウォッチは `app/styleguide/StyleguideLayout.tsx:291` の `style={{ backgroundColor: hex }}` で描画されており、`hex` はトークンオブジェクトから来る。クラス形式の 71箇所はカード枠・入力欄・ホバー枠などの**通常の UI** なので置換して問題ない。ただし `COLOR_GROUPS` / `SEMANTIC_SWATCHES` が渡す値と、テキストとして表示している HEX 文字列は絶対に触らないこと
3. **クラス形式以外は触らない。** コメント文・色定数オブジェクト（`SKILL_LEVELS` の `bar:` など）・SVG の `fill=`/`stroke=`・`style={{}}` の中・`tintColor` などの props。`<接頭辞>-[#hex]` の形にマッチするものだけが対象
4. **`components/CareerGanttChart.tsx` は色定数オブジェクトで HEX を持つ。** クラス置換では対応できないので、やるなら `design-tokens.ts` からの import という別方式になる
5. **不透明度修飾子（`/10` など）付きは生成 CSS の機構が変わる。** `lab()` 直書き → `color-mix(in oklab)` になる。**解決後の色は同一だが CSS 文字列は変わる**ので、文字列比較で「変わった」と判定しないこと。ピクセル比較で確かめる
6. **`!` (important) 前置がある**（`!bg-[#9e9e9e]` など）。`!` を保持すること

## 有効だった検証方法（PR #81 で実証済み）

置換前後で**描画色が1つも変わっていない**ことを機械的に示せる。

```js
// /styleguide を開いて実行。置換の前後で取って突き合わせる
const props=['color','backgroundColor','borderTopColor','borderRightColor',
             'borderBottomColor','borderLeftColor','outlineColor','accentColor'];
const hist={};
[...document.querySelectorAll('#components *')].forEach(e=>{
  const cs=getComputedStyle(e);
  for(const p of props){const v=cs[p]; if(v&&v!=='rgba(0, 0, 0, 0)') hist[v]=(hist[v]||0)+1;}
});
```

PR #81 では色スロット 4326件が完全一致し、差分は `lab()`→`oklab()` の表記2件だけだった（ピクセル比較で同一を確認）。

`app/` を対象にする場合は `#components` ではなく admin の各画面を対象にする必要がある。**admin は認証の内側**なので、表示手順の確認が要る。

さらに強い確認として、**置換表を機械適用して作業ツリーを再現できるか**を試すとよい。PR #81 では 128回の置換で 1バイト違わず再現でき、「表に無い変更が存在しない」ことを示せた。

## 規模の目安と分割案

`app/admin` の 271箇所だけで PR #81（128箇所）の2倍。**一度に全部やらず分けるのが現実的。**

- 案1: `app/styleguide`（71）+ `app/` その他（11）を先に → 82箇所。admin より検証が楽
- 案2: `app/admin` をファイル単位で分割（`AdminLayout.tsx` が最大）
- 案3: 全部まとめて1 PR（レビューは重くなるが、規則が確立しているので機械的ではある）

## 完了条件の案

- [ ] 対象範囲でトークンと完全一致するクラス形式の生 HEX が **0件**になる
- [ ] 置換前後で**描画色が変わっていない**ことを実測で示す
- [ ] 独自色 112箇所が1件も減っていない
- [ ] 置換先ユーティリティが生成 CSS に実在することを確認する（Tailwind v4 は literal 文字列からしか生成しない）
- [ ] `.design-system-context.yml` の `border-[#424242]` 残数を再計測して更新する（C1 完了時点で 61・すべて `app/admin` → `app/admin` 完了で 0 になるはず）
- [ ] `npm run check` が exit 0

---
---

# 進め方（A・B・C 共通）

- CLAUDE.md §0-4 に従い、着手前に `.claude/skills/director` を通す
- **§2-2 の線引きに注意**: `git diff --stat` の変更ファイルが `components/` 配下で**2つ以上**なら要承認。A は 1ファイル（`lib/figma-variants.ts`）なので該当しない可能性があるが、B は `components/` 2ファイル、C は多数のため確実に該当する
- `lib/design-tokens.ts` / `app/globals.css` の `@theme` を触ると §4 のスタイルガイド更新義務が発火する。B で semantic トークンを新設する場合が該当
- 門は `npm run check`（`tsc --noEmit` → `eslint` → `next build`）。CI と Stop hook からも同じコマンドが走る
- **見た目の確認は必ず実プレビューで目視する。** 数値・JS 計測だけで済ませない（メモリのルール）

## 開発サーバーの扱い（実際に3回止めた）

**`.next` に触る操作は、必ず dev サーバーを停止してから行う。** 稼働中にやると `next dev` がその場で固まり、以後どのページも応答しなくなる（HTTP 000）。自力では復帰しない。

止まる操作は2種類あり、**どちらも実際に踏んだ**。

1. `rm -rf .next`（キャッシュ削除）
2. **`npm run check` / `next build`** — 門を回すだけでも固まる。build と dev が同じ `.next` を奪い合うため

つまり「キャッシュを消すときだけ気をつける」では足りない。**門を回す前にも止める。**

```
preview_stop → lsof -ti:3000 | xargs -r kill -9 → （ここで .next 操作や npm run check）→ preview_start
```

`rm -rf .next` を `npm run check` と同じコマンドブロックに書くと止め忘れるので、必ず分けること。
停止したかどうかは `lsof -i:3000` で確認してから次へ進む。

また Turbopack は `app/globals.css` の `@theme` 変更を配信し損ねることがある。**レイアウトや色を数値で計測する前に、必ず「今配信されている値」を1つ確認する**こと。

```js
getComputedStyle(document.documentElement).getPropertyValue('--container-main')
```

これを怠って 1024px 時代の CSS に対してレスポンシブ計測を行い、全部やり直した。

## やらないでほしいこと

- A で Figma の指定を確認せずに、フォーカスの見た目を変えること
- B で `app/` 側 9箇所との一貫性を考えずに `components/` だけ変えること
- C を一度に全部やること（規模を分けて、各段階で描画色の不変を確認する）
- `app/styleguide/StyleguideLayout.tsx` のパレットスウォッチの HEX（`style={{ background: hex }}`）を触ること
