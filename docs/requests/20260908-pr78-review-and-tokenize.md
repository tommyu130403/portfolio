# 依頼書 — PR #78 のレビュー指摘対応 と ハードコード色のトークン化

- 作成日: 2026-09-08
- 状態: **未着手**（引き継ぎ元セッションは終了済み。着手要否の判断から委ねる）
- 種別: A = `fix` / B = `refactor`
- 関連: PR #78（`style/20260908-styleguide-figma-sync` / `557bae5`）、破棄ブランチ `ed8e9fb`
- 依頼書: `docs/requests/20260908-styleguide-figma-sync.md`（PR #78 本体の依頼書）の後続

---

PR #78（`style/20260908-styleguide-figma-sync` / コミット `557bae5`）に関連して、別セッションから2件の引き継ぎがある。**どちらも着手要否の判断からそちらに委ねる。** 引き継ぎ元のセッションは終了しており、追加の説明は得られない前提で書いてある。

- **A. PR #78 に対するコードレビュー指摘 6件** — マージ前の判断が望ましい
- **B. ハードコード色をトークン参照へ置換する作業** — PR #78 のマージ後に着手する前提。着手するか、別の形にするか、やらないかを含めて判断してほしい

前提として `/figma-component-review` skill が `~/.claude/skills/figma-component-review/` に導入済み。A の指摘1・2・5 は同 skill の `scripts/token_audit.py` で機械的に再検出でき、B は同 skill の設計思想（間接化・意味の符号化）に沿った作業。`.design-system-context.yml` もリポジトリ直下にあるので Phase 0 の5問は聞かれない。

---
---

# A. PR #78 に対するレビュー指摘 6件

静的チェックは通っている（`npx tsc --noEmit` exit 0、`npx eslint` は 3 errors / 17 warnings で基準線と同一・新規混入なし）。以下は静的解析では検出できない種類の指摘。

## 判断が要るもの（3件）

### A-1. `--color-border` の値変更で、ハードコード境界色101箇所と分裂している

`app/globals.css:118` で `--color-border` を `system-800`(#424242) から `system-825`(#3A3A3A) に変更した。変更前は `border-border` と `border-[#424242]` が同色だったが、いま別のグレーになっている。

```bash
# ⚠️ この grep は 101 を返すが誤り。--include='*.tsx' が .ts を除外し、探索先に lib が無い。
grep -rno 'border-\[#424242\]' --include='*.tsx' app components src | wc -l   # → 101

# 正しい数え方（VERIFIED 2026-09-08）: 102 件
#   app/admin 61 / components 26 / app/styleguide 14 / lib 1
# lib の 1 件 = lib/figma-button-variants.ts:39（Button/Function の on バリアント）。
# .ts なので上の grep では拾えない。B の対象リストを作るときは必ずこちらを使うこと。
grep -rno 'border-\[#424242\]' --include='*.ts' --include='*.tsx' \
  . --exclude-dir=node_modules --exclude-dir=.next | wc -l                     # → 102
```

再現: `/styleguide` を開くと、このコミットで追加された SideMenuBar プレビューの枠（`border-[#424242]`）と、同じ画面の FigmaOnlyPreview の破線枠（`border-border` = #3A3A3A）が並んで別色に見える。`app/admin/AdminLayout.tsx` にも同種のハードコードが多数残る。

選択肢:
- (a) 101箇所を `border-border` に寄せる（→ **B の作業と重なる**。まとめて処理する手もある）
- (b) `--color-border` を #424242 に戻し、Figma 側の Border/Default を確認する
- (c) 分裂を承知で放置し、`.design-system-context.yml` の `intentional_compromises` に理由と再検討トリガーを記録する

### A-2. 同じ Figma 名 `Border/Light` が別の値に再割当されている

`lib/design-tokens.ts:120`。

```ts
// 変更前
borderStrong: color.system["500"],  //  #9E9E9E   Figma: Border/Light
// 変更後
borderLight:  color.system["800"],  //  #424242   Figma: Border/Light
```

同一の Figma 変数が2つの値を持つことはないので、どちらかのマッピングが誤っている。Figma の Border/Light が #9E9E9E のままだった場合、`border-border-light` を使う箇所は輝度 474 → 198 と大幅に暗くなり「コントラストの高い境界」という役割が失われる。

**未確認**: `search_design_system` が Semantic コレクションを返さないため、レビュー側では Figma の実値を取得できていない。判定には Figma の Semantic スウォッチのノードIDが要る。取得手順は `~/.claude/skills/figma-component-review/references/figma-retrieval.md` の §1・§5 にある。要点は「`get_variable_defs` はノードに束縛された変数しか返さない」「ページIDを渡すと選択エラーになるが、具体的なノードIDなら選択不要で動く」「ユーザーに Figma の『Copy link to selection』の URL をもらうのが最短」。

### A-3. `surface-dark` → `surface-light` の置換で面の前後関係が反転している

`lib/design-tokens.ts:116`。

| | 値 | `surface`(#212121) との関係 |
|---|---|---|
| 変更前 `surfaceDark` | system-1000 `#1A1A1A`（輝度 79） | 暗い（沈む） |
| 変更後 `surfaceLight` | system-875 `#292929`（輝度 123） | 明るい（浮く） |

呼び出し側は `bg-surface-dark` → `bg-surface-light` と名前だけを機械置換している。影響箇所は `app/page.tsx` のモバイルメニュー開閉ボタンと `components/FlowchartNodes.tsx` の NoteNode。変更前は背景より沈んで見えたものが、変更後は浮いて見える。

Figma の Background/Light に合わせた意図的な変更なら問題ない。一括置換で紛れ込んだのであれば意図しない見た目になる。**どちらかを確認してほしい。**

## 直したほうがよいもの（3件）

### A-4. `borderMain` が `main-100` を参照せず rgba を直書きしている

`lib/design-tokens.ts:122`。`rgba(72, 244, 190, 0.4)` の RGB は `color.main["100"]`（`#48F4BE`）と完全一致するが、トークンを参照せずリテラルで重複定義している。ブランドカラーを変えて `color.main["100"]` を更新しても `borderMain` は旧色のまま残り、`border-border-main` を使う箇所だけが前のブランド色で描画される。`#48F4BE` での grep にも掛からないため見落とされる。

### A-5. `system-1000` と `system-black` が完全な重複になった

`lib/design-tokens.ts:88-89`。`"1000"` を `#1A1A1A` から `#000000` に変更した結果、直下の `black: "#000000"` と同値になった。どちらを使うべきかの規約が無い。`/styleguide` の System スケールに同じ黒のスウォッチが2枚並ぶ。今後 `bg-system-1000` と `bg-system-black` が混在し、Figma 側で System/1000 の値が変わったときに片方だけが追従して見た目が割れる。

### A-6. `var(--fg-muted)` は未定義（このコミットの変更行ではない既存バグ）

`app/page.tsx:203` が `color: "var(--fg-muted)"` を参照しているが、`app/globals.css` が定義しているのは `--color-fg-muted` で `--fg-muted` は存在しない。トップページの該当段落が、意図したグレー（#9E9E9E）ではなく親から継承した色（白）で描画される。CSS 変数の未定義はエラーにならず `tsc` / `eslint` も検出しないため目視するまで気づかない。

このコミットの差分行ではないので、**スコープ外と判断するならそれでよい**。

## 誤読していた点（訂正済み・対応不要）

レビュー途中で「`HistoryItem` のプレビューが削除された」と読んだが、差分を追うと「実装のみ（Figma に対応コンポーネントなし）」節へ**移動**していた。削除ではない。未使用 import はゼロ、`Modal` / `SideMenuBar` の props 契約も呼び出し側と一致している。

## 良かった点

`orderedShades()` の追加は、`Object.entries` が `"025"` のような先頭ゼロ付きキーを数値扱いせず末尾へ回してしまう既存の並び順バグを正しく解消している。数値キーを昇順、`base` / `black` / `white` などの非数値キーを定義順で末尾に置く分離も正しい。

---
---

# B. ハードコード色をトークン参照へ置換する作業

## 経緯

このリポジトリには**ハードコードされた HEX が大量に残っている**（`origin/main` 時点）。

```
components/  195件   app/  509件   lib/  58件   src/  15件
```

前のセッションでこの一部を置換するブランチ（`refactor/20260907-tokenize-colors`・5コミット・22ファイル・+162/-130）を作ったが、**PR #78 の作業と内容が重複するため破棄した**。破棄した先頭 SHA は `ed8e9fb987a94a957778a5291a46066cc0cd4ee8`。reflog の保持期間内なら次で復元できる。

```bash
git branch recovered/tokenize-colors ed8e9fb
git show --stat ed8e9fb
```

破棄した5コミットの内訳と、それぞれの現在の扱い:

| コミット | 内容 | 現在 |
|---|---|---|
| `e284717` | `.design-system-context.yml` を追加 | **救出済み**。PR #79 で main にマージ済み |
| `b215e5c` | ハードコード色121箇所 → primitive トークン参照 | **未実施**。これが B の本体 |
| `f01162b` | primitive 143箇所 → セマンティック層へ寄せ直し | **未実施**。これも B に含む |
| `aba00f4` | Gray スケール5段（825/850/875/925/950）を追加 | **PR #78 が同じことをより広範に実施**。不要 |
| `ed8e9fb` | `system-1000` を #000000 に修正 | **PR #78 が同じ修正を実施**。不要 |

つまり B として残っているのは中2つ（参照の置換）だけ。トークン定義側は #78 が担う。

## なぜやるか

`components/` のハードコード色195件のうち、前セッションの実測では **153件が既存トークンと完全一致**していた（値を変えずに参照へ置き換えるだけで済む）。トークンが定義されているのに参照されていない状態は「一箇所直せば全部直る」を無効化している。A-1 の分裂（`border-border` と `border-[#424242]`）も、この置換が済んでいれば起きない。

## やるなら（手順の目安）

1. **`/figma-component-review` の token モードを先に回す。** どの HEX がどのトークンと完全一致するか、近傍だが不一致か、独自色かを機械的に分類できる（T-E1 完全一致＝未移植 / T-E2 近傍 / T-E3 独自色）。**差が小さいこと（差3〜9）は一致の根拠にならない。完全一致だけを置換対象にする。**
2. 完全一致するものだけを `<接頭辞>-[#hex]` → `<接頭辞>-<トークン名>` の完全一致文字列で置換する。
3. `primitive` に寄せるか `semantic` に寄せるかを決める。**#78 でセマンティック層の名前が変わっている**（`surfaceDark`→`surfaceLight`、`borderStrong`→`borderLight`、`fgCaption`/`secondary`/`borderMain`/`actionHover` が新設）ため、**対応表は #78 確定後に作り直す必要がある**。前セッションの対応表はそのまま使えない。

## 前セッションで踏んだ落とし穴（同じ轍を避けるため）

- **コメント文中・JS の色定数オブジェクト・SVG の `fill=`/`stroke=` 属性・`style=` 内の HEX は置換対象外。** `<接頭辞>-[#hex]` の完全一致で置換すればクラス以外にはマッチしないが、事前に確認すること。`CareerGanttChart.tsx` は色定数オブジェクトで HEX を持っており、クラス置換とは別方式（`design-tokens.ts` からの import）になる
- ~~**`app/styleguide/StyleguideLayout.tsx` の HEX は置換禁止。** パレット見本として意図的に literal を書いている~~ → **撤回（2026-09-08）**: パレット見本は `style={{ backgroundColor: hex }}` で描画されており、クラス形式の HEX はカード枠・入力欄などの通常 UI。PR #84 で置換済み。触ってはいけないのは `COLOR_GROUPS` / `SEMANTIC_SWATCHES` の値と表示用の HEX 文字列だけ
- **`#48F4BE` は `main-100` と `main-base` の両方に一致する。** エイリアスではなく数値スケール側を採る
- **不透明度修飾子付き（`bg-[#48f4be]/10`）は生成CSSの機構が変わる**（`lab()` 直書き → `@supports` + `color-mix(in oklab)`）。解決後の色は同一だが「CSSが同一」ではない
- **セマンティック層に寄せる場合、同じ primitive が用途で別名になる。** 例えば `system-500` はテキストなら `fg-muted`、境界なら `border-strong`（#78 後は名前が変わる）。機械置換ではなく用途判断が要る
- **検証は実プレビューで目視する。** DOM の computed style を実測すると確実（`getComputedStyle(el).color` を期待 HEX と突き合わせる）。数値・JS計測だけで済ませない

## スコープの目安

`components/` だけでも195件ある。`app/admin/` 系は313件と規模が大きく、`app/styleguide/` の77件は置換禁止（→ 撤回。PR #84 で置換済み）。**一度に全部やらず、`components/` に閉じるのが現実的**というのが前セッションの判断だった。

---
---

# 進め方（A・B 共通）

- CLAUDE.md §0-4 に従い、着手前に `.claude/skills/director` を通す
- `lib/design-tokens.ts` / `app/globals.css` の `@theme` を触ると **§4 のスタイルガイド更新義務**が発火する。`app/styleguide/StyleguideLayout.tsx` は `Object.entries(color.system)` を読む実装なのでトークン追加は自動反映されるが、`SEMANTIC_SWATCHES` の `ref:` ラベルは手で直す必要がある
- A-2 の判定には Figma の実値取得が要る。**§5 の突き合わせは `/figma-component-review` の token モードで回せる**
- 見た目が変わる変更（A-1・A-2・A-3、B 全体）は**実プレビューで目視確認する**

## やらないでほしいこと

- A の判断が要る3件を、確認せずにどちらかへ倒すこと
- A-6（既存バグ）を PR #78 に混ぜること。スコープが広がるなら別 PR にする
- B を PR #78 のマージ前に始めること。同じ4ファイル（`lib/design-tokens.ts` / `app/globals.css` / `app/styleguide/StyleguideLayout.tsx` / `components/FlowchartNodes.tsx`）で衝突する
- 破棄済みブランチ `ed8e9fb` をそのまま復元して PR にすること。トークン定義の変更が #78 と二重になる
