# テスト仕様書 — Figma Master 同期（Phase 1 / 2 / 3）

- 作成日: 2026-09-09
- 対象: PR #88（トークン層）/ #89（コンポーネント層）/ #90（画面レイアウト層）
- 対象ブランチ: `style/20260908-figma-master-layout`（3 PR ぶんの変更がすべて載っている最上流）
- 関連: `docs/requests/20260908-figma-master-sync.md`（依頼書と各 Phase の実装記録）
- 実装セッションの自己検証は済んでいる。**この仕様書は第三者が独立に反証するためのもの。**

---

## 0. この文書の使い方

- §1〜§2 で環境を作る。
- §3〜§8 のケースを上から順に実行し、**実際のコマンド出力を根拠として**合否を記録する。
- §9 は「落としてはいけない既知の未対応」。ここに載っているものを不合格として報告しない。
- §10 に別セッション用のプロンプトがある。そのまま貼れば実行できる。

**判定の原則**
- 期待値は**実測値**（`getComputedStyle` / `getBoundingClientRect` / コマンドの exit code）で判定する。スクリーンショットの目視だけで合格にしない。
- 期待値と違ったら、**実装を直さず**「観測値 / 期待値 / 再現手順」を報告する。
- 裏を取れなかった項目は合格にせず **未確認** と明記する。

---

## 1. 前提条件

| 項目 | 値 |
|---|---|
| リポジトリ | `/Users/tommyu/Dev/portfolio` |
| ブランチ | `style/20260908-figma-master-layout` |
| Node | 22 以上（`scripts/shot.mjs` が組み込み `WebSocket` を使う） |
| dev サーバー | port 3000（`.claude/launch.json` の `portfolio-dev`） |
| Supabase | `.env.local` が必要。無いと `next build` が落ちる |
| 実データの Work | `http://localhost:3000/works?id=c5b71719-c894-4678-9785-26887c0021b3`<br>※ このローカル環境で確認した ID。環境が違えばトップページの Works カードをクリックして URL を取る |

### 触ってはいけないもの
- 未追跡ファイル: `.codex/config.toml` / `_to_delete/` / `docs/figma-color-token-sync-prompt.md` / `figma-skills-a-plan.js` / `learnings/20260906-cowork-figma-unreachable.md` / `supabase/.temp/`
- **`prettier` を走らせない。** このリポジトリの依存でも設定でもなく、走らせるとファイル全体が別スタイルに整形される。

### 事故防止
- **dev サーバーが動いている状態で `.next` を消さない。** Turbopack のキャッシュ DB が壊れて全ページ 500 になる（この作業中に一度発生した）。消すときは先に `preview_stop` またはプロセス停止。
- 本番ビルドを取りたいときは `git worktree` で隔離するか `NEXT_DIST_DIR=.next-verify` を使う。
- `/styleguide` のサンプルデータを一時改変してよいが、**必ず元に戻して `git diff` が空であることを確認する**。

---

## 2. 環境セットアップ

```bash
cd /Users/tommyu/Dev/portfolio
git branch --show-current          # style/20260908-figma-master-layout であること
git status --short                 # 未追跡6件のみ。変更ファイルがあれば報告して止まる
```

dev サーバーは Claude Code の preview ツール（`preview_start` に `name: "portfolio-dev"`）で起動する。**`npm run dev` を Bash で直接起動しない。**

ヘッドレス Chrome での実測はこの2つを使う:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --remote-debugging-port=9333 --no-first-run --user-data-dir=<scratch>/chrome-profile about:blank &
until curl -s http://127.0.0.1:9333/json/version >/dev/null 2>&1; do sleep 1; done
```

```bash
node scripts/shot.mjs <出力png> <URL> '<描画前に実行する JS（返り値が PRE result に出る）>'
```

`scripts/shot.mjs` の JS は `Runtime.evaluate` に渡るので、`await` を使うなら `(async()=>{ ... })()` で包む。使い方は `learnings/20260908-headless-chrome-cdp-screenshot.md` にある。

終わったら `pkill -f "remote-debugging-port=9333"`。

---

## 3. 門（すべての前提）

| ID | 手順 | 期待値 |
|---|---|---|
| G-1 | `npm run check` | **exit 0** |
| G-2 | `npm run check 2>&1 \| grep problems` | **`0 errors, 19 warnings`** |
| G-3 | `next build` のルート数 | **15 routes**。`/`・`/works`・`/styleguide`・`/admin/*` が生成される |

> G-2 の 19 について: 作業前の基準線は 20 だった。PR #90 でサイトリンクカードを削除して `<img>` が1つ減ったぶん `@next/next/no-img-element` が 1 件減っている。**20 に戻っていたら削除が反映されていない疑い、21 以上なら新規の警告が入った疑いがある。** どちらも報告対象。

---

## 4. トークン層（PR #88）

### 4-1. `lib/design-tokens.ts` の値が変わっていないこと

| ID | 手順 | 期待値 |
|---|---|---|
| T-1 | `git diff <PR88のbase>..HEAD -- lib/design-tokens.ts` を取り、**コメント以外の差分**を数える | **0 行**。値・キーの変更が1つでもあれば不合格 |

`<PR88のbase>` は `claude/figma-implementation-strategy-o5mj5g`。

### 4-2. text style ユーティリティ 19 種が定義値どおりに効くこと

**手順**: 任意のページ（`/styleguide` でよい）で、19 個のクラスを当てた要素を動的に作り `getComputedStyle` を読む。

```js
const keys=["title-pj","title-en","headline-01-jp","headline-01-en","headline-02-jp","headline-02-en",
"body-01-jp","body-01-jp-bold","body-01-en","body-02-jp","body-02-jp-bold","body-02-en",
"body-03-jp","body-03-jp-bold","body-03-en","caption-01-jp","caption-01-en","caption-02-jp","caption-02-en"];
const out={};
for(const k of keys){
  const el=document.createElement("p"); el.className="text-"+k; el.textContent="x";
  document.body.appendChild(el);
  const c=getComputedStyle(el);
  out[k]={size:c.fontSize,weight:c.fontWeight,lh:c.lineHeight,ls:c.letterSpacing,ff:c.fontFamily.slice(0,20)};
  el.remove();
}
JSON.stringify(out)
```

| ID | クラス | size | weight | line-height | letter-spacing | font-family |
|---|---|---|---|---|---|---|
| T-2a | `text-title-pj` | 34px | 700 | normal | 1.02px | Noto Sans JP |
| T-2b | `text-title-en` | 38px | 800 | normal | 1.14px | Avenir |
| T-2c | `text-headline-01-jp` | 24px | 700 | 36px | 1.2px | Noto Sans JP |
| T-2d | `text-headline-01-en` | 24px | 800 | normal | 1.2px | Avenir |
| T-2e | `text-headline-02-jp` | 17px | 700 | normal | 0.85px | Noto Sans JP |
| T-2f | `text-headline-02-en` | 20px | 700 | 30px | 1px | **Afacad** |
| T-2g | `text-body-01-jp` | 15px | 400 | 22.5px | 0.45px | Noto Sans JP |
| T-2h | `text-body-01-jp-bold` | 15px | 700 | 22.5px | 0.45px | Noto Sans JP |
| T-2i | `text-body-01-en` | 17px | 400 | normal | normal | Avenir |
| T-2j | `text-body-02-jp` | 13px | 400 | 19.5px | 0.39px | Noto Sans JP |
| T-2k | `text-body-02-jp-bold` | 13px | 700 | 19.5px | 0.39px | Noto Sans JP |
| T-2l | `text-body-02-en` | 15px | 400 | normal | normal | Avenir |
| T-2m | `text-body-03-jp` | 11px | 400 | 16.5px | 0.33px | Noto Sans JP |
| T-2n | `text-body-03-jp-bold` | 11px | 700 | 16.5px | 0.33px | Noto Sans JP |
| T-2o | `text-body-03-en` | 13px | 400 | normal | normal | Avenir |
| T-2p | `text-caption-01-jp` | 10px | 400 | normal | 0.3px | Noto Sans JP |
| T-2q | `text-caption-01-en` | 12px | 400 | normal | normal | Avenir |
| T-2r | `text-caption-02-jp` | 9px | 400 | normal | 0.27px | Noto Sans JP |
| T-2s | `text-caption-02-en` | 11px | 400 | normal | normal | Avenir |

> `letter-spacing` が `normal` なのは `0em` の計算結果。EN 系7種は Figma の 0% を忠実に変換したもので正常。

### 4-3. 定義の出所が一致していること

| ID | 手順 | 期待値 |
|---|---|---|
| T-3 | `app/globals.css` の 19 個の `@utility` と `lib/design-tokens.ts` の `textStyle` 19 件を**スクリプトで機械的に突き合わせる**（size / weight / lineHeight / letterSpacing / lang→font-family）。変換規則: `lineHeight: "normal"` → CSS `normal`、数値 → 無単位、`letterSpacing` の数値 → `Nem`、lang `jp`→`var(--font-noto-sans-jp), sans-serif` / `en`→`Avenir, var(--font-noto-sans-jp), sans-serif` / `special-en`→`var(--font-afacad), var(--font-noto-sans-jp), sans-serif` | **19 件すべて一致**。目視で「合っていそう」は不可 |
| T-4 | `app/styleguide/StyleguideLayout.tsx` の `TEXT_STYLE_CLASS` のキーが `textStyle` のキー 19 件と過不足なく一致 | 過不足 **0** |

> T-4 が重要な理由: Tailwind v4 は**使われていないユーティリティを CSS に出力しない**。`TEXT_STYLE_CLASS` の literal 19 件が、19 種が生成されることの唯一の担保になっている。この配列を消すとユーティリティが CSS から消える。

### 4-4. 散文ファイルから不正な CSS が漏れていないこと

| ID | 手順 | 期待値 |
|---|---|---|
| T-5 | 本番ビルドの CSS を `grep -o "border-radius:Npx\|16777200px"` | **0 件** |
| T-6 | `app/globals.css` の `@source not` に `../docs` `../learnings` `../_to_delete` `../.design-system-context.yml` `../README.md` の**5件すべて**があること | 5件 |

> 経緯: `.design-system-context.yml` の説明文中の `rounded-[Npx]` を Tailwind が拾い、**不正な `border-radius: Npx` が本番バンドルに混入していた**（コミット `c1a6f28` で一度潰した不具合の再発）。散文にクラス名を書くファイルを増やしたら `@source not` も足す必要がある。

### 4-5. 生成 CSS の順序（将来の落とし穴）

| ID | 手順 | 期待値 |
|---|---|---|
| T-7 | ビルド後 CSS で `.text-title-pj` と `.font-bold` / `.text-\[` のバイト位置を比べる | **カスタムが前・組込みが後**。この順序自体は変えられないので**不合格にはしない**が、位置関係を記録すること |
| T-8 | `grep -rEn '(text-(title\|headline\|body\|caption)-[a-z0-9-]+)' --include='*.tsx' app components src lib` の各ヒット行に、`font-bold` / `font-extrabold` / `font-normal` / `leading-` / `tracking-` / `text-[数字` が**併記されていない**こと | **併記 0 件** |

> T-8 が本番の判定。同一レイヤー・同一詳細度なので**後に出る組込みが必ず勝つ**。併記すると text style が黙って無効化され、型エラーも lint 警告も出ない。

---

## 5. コンポーネント層（PR #89）

`/styleguide` の Components 節で実測する。

| ID | 対象 | 手順 | 期待値 |
|---|---|---|---|
| C-1 | Headline default（SectionTitle） | トップページの「Works」等の見出しの computed style | **34px / 700 / line-height normal / letter-spacing 1.02px**。**緑の下線が無い**（Figma に無いため削除済み） |
| C-2 | Headline markdown-h2 | `/styleguide` の「見出し 02」プレビュー | **17px / 700 / `rgb(158,158,158)`** |
| C-3 | Headline markdown-h3 | 同「見出し 03」 | 17px / **800** / `rgb(158,158,158)`（h2 と weight だけ違う。§9-1 参照） |
| C-4 | Headline 各 variant の `pb` | default / sub / section / markdown-h1〜h3 の `paddingBottom` | **default のみ 32px**。sub 12px、section・markdown-* は 0px |
| C-5 | ButtonAction primary | `/styleguide` の「Primary Button」の rect | **height 40px**、`max-width 200px` |
| C-6 | ButtonAction hover | secondary / ghost の `:hover` ルール | `background-color: var(--color-action-hover)`（白5%）。**2% を直書きしていないこと**（§9-2） |
| C-7 | ButtonFunction | `h-[36px]` を持つ button の rect | **36 × 36px**（padding を足すと border-box で 38 になる。38 なら不合格） |
| C-8 | ButtonFunction border on | 同要素の computed | `border-color: rgb(58,58,58)`（#3a3a3a = Border/Default）、`background-color: rgb(33,33,33)` |
| C-9 | Tag tool | `/styleguide` の Tag の3段目（Figma / GitHub / Next.js） | 背景 **透明**、`border-color rgb(58,58,58)`、`font-size 10px`、`padding 6px 10px` |
| C-10 | WorkCard | トップページの Works カード | 背景 **透明**、`border-color rgb(58,58,58)`、`box-shadow rgba(0,0,0,0.25) 1px 1px 16px 2px`、タイトル **13px / 700 / lh 19.5px** |
| C-11 | SideMenuBar _Item Active | トップページのサイドバー | Active 項目の `background-color` が **`rgba(0,0,0,0)`**（背景なし）、`color rgb(224,224,224)`。**`aria-current` が現在地の1件だけに付く** |
| C-12 | Tooltip | サイドバーを折りたたんで項目をホバー | `border-radius 4px` / `padding 10px 12px` / `font-size 14px` / `line-height 20px` / 文字色 白80% |
| C-13 | TabBar 外枠 | `/styleguide` の TabBar | `background-color rgb(41,41,41)`（#292929 = Background/Light） |
| C-14 | TabBar item | 各タブの computed | `padding-left 16px` / `padding-right 24px` / `height 40px` |
| C-15 | TabBar Active | アクティブタブ | `font-weight 800` / `background rgb(33,33,33)` / `border-color rgb(58,58,58)` |
| C-16 | TabBar アイコン | 3つの `<img>` の `naturalWidth` | **3つとも 24**（0 なら画像が壊れている） |
| C-17 | Modal | `/styleguide` の「Modal を開く」 | `border-radius 16px` / `border-color rgb(58,58,58)` / `box-shadow rgba(0,0,0,0.1) 0 1px 3px` / scrim の `padding 40px` |
| C-18 | Modal 閉じるボタン | 同上 | コンテナ右端からの隙間 **9px**、上オフセット **-1px** |

---

## 6. 画面レイアウト層（PR #90）— トップページ

| ID | 手順 | 期待値 |
|---|---|---|
| L-1 | 1440px でトップの Works グリッドの computed | `gridTemplateColumns` が **`"392px 392px"`**、`gap 16px`、カード幅 **392px** |
| L-2 | 639px / 640px / 768px / 1024px でのカラム数 | **640px 以上で 2 列**、639px で 1 列（`sm:` 基準） |
| L-3 | セクション間 | 外側コンテナの `rowGap` **120px**、`padding 80px 上下` |
| L-4 | コンテンツ幅 | 各 `<section>` の `maxWidth` **800px** |
| L-5 | Hero | 画像 **200×200**、画像とテキストの `gap 64px`、役職↔名前 `gap 8px`、名前JP↔EN `gap 8px` かつ下揃え |
| L-6 | Introduction | 段落グループの `rowGap 40px`、段落間 `16px` |

---

## 7. 画面レイアウト層（PR #90）— Works 詳細

**実データのページ**（`/works?id=...`）で実測する。`/styleguide` のプレビューには実ページの外殻が無いので代用にならない。

### 7-1. 骨格

| ID | 手順 | 期待値 |
|---|---|---|
| W-1 | 1440px でカラムの computed | `maxWidth 800px` / `rowGap 48px` / `paddingTop 40px` / `paddingBottom 80px` |
| W-2 | 1440px でカラムの位置 | `left 448px`（= 256 + (1184-800)/2。Figma と一致） |
| W-3 | サイドバー | `<aside>` が存在し幅 **256px** |
| W-4 | サイドバーの nav href | Profile 4項目が **`/#introduction` `/#career` `/#works` `/#skills`** |
| W-5 | 横罫線 | 本文の直上に **1本だけ**。セクション間には無い |

### 7-2. メタ表

| ID | 手順 | 期待値 |
|---|---|---|
| W-6 | 表のセル | 高さ **40px**、`background rgb(41,41,41)`（#292929） |
| W-7 | 表の外枠 | `border-color rgb(58,58,58)`、`border-radius 8px` |
| W-8 | 行数 | **常に3行**。`period` / `role` / `stakeholder_breakdown` の有無にかかわらず行が欠けない |
| W-9 | フォールバック | 値が無い行の内容セルが **`—`**。「タイムライン（RACI）」「体制図」と出たら不合格 |
| W-10 | ラベル | 上から **期間 / 役割 / 関係者**。アイコンは 16×16 |
| W-11 | 全画面ボタン | 期間行と関係者行の右端に **24×24**。`timeline` / `stakeholders` が無い Work では**出ない** |
| W-12 | 長い値 | 54文字の `role` を入れ、**セル・表・ドキュメントのいずれも `scrollWidth - clientWidth` が 0**。`title` 属性に全文が入っている。<br>※ **`span.scrollWidth === span.clientWidth` を判定に使わない。** truncate は `overflow:hidden` なので、文字が入りきらない限りこの等式は成立しない（成立するのは「収まったとき」であって「溢れていないとき」ではない）。実測では役割行は 768px 以上、全画面ボタンを持つ期間・関係者行は 1280px 以上でのみ成立し、それ未満では成立しないが**実際の溢れはどの幅でも 0** |

### 7-3. レスポンシブ（**ブロッカー2件の回帰テスト。最重要**）

各幅で `<main>` の幅・カラム幅・固定矢印と本文の重なり・横溢れを実測する。

| ID | 幅 | `<main>` 幅 | 固定矢印 | 本文末尾ナビ | 横溢れ |
|---|---|---|---|---|---|
| W-13 | 375 | **375**（0 なら不合格） | 非表示 | **表示** | なし |
| W-14 | 768 | **768**（0 なら不合格） | 非表示 | **表示** | なし |
| W-15 | 1024 | 768 | **非表示** | **表示** | なし |
| W-16 | 1090 | 834 | **非表示** | **表示** | なし |
| W-17 | 1280 | 1024 | 表示（右端 300）・カラム左端 368 → **重ならない** | 非表示 | なし |
| W-18 | 1440 | 1184 | 表示（右端 300）・カラム左端 448 → **重ならない** | 非表示 | なし |

> W-13/14 の背景: ルートを flex の横並びにしたとき、モバイル用の前後ナビが `<main>` と兄弟の flex アイテムになり `flex-1 min-w-0` の `main` を幅 0 まで押し潰していた。
> W-15/16 の背景: 固定矢印 `left-[264px]` の右端 300 に対し、カラム左端は `256 + (vw-1056)/2 + 24` なので vw < 1096 で食い込む。`xl`（1280px）で出し分けて解消した。**1024〜1279px でナビ手段がゼロになっていないこと**も確認する。

横溢れは `document.documentElement.scrollWidth > clientWidth` で判定する。

---

## 8. 回帰テスト（既存機能が壊れていないこと）

| ID | 対象 | 手順 | 期待値 |
|---|---|---|---|
| R-1 | **トップページのサイドバー** | `app/page.tsx` は `hrefBase` を渡していないので href は `#introduction` のまま。実際にクリックしてスクロールと `aria-current` のハイライトを確認 | href が **`#introduction`**（`/#` になっていたら不合格）。クリックで該当セクションの top ≈ 0、`aria-current` が移動する |
| R-2 | ライトボックス | デバイスモックをクリック → Esc | 開く / Esc で閉じる / `document.body.style.overflow` が `""` に戻る |
| R-3 | Timeline モーダル | 期間行の全画面ボタン | 開く。閉じるボタンと背景クリックで閉じ、`overflow` が戻る（**Esc では閉じない。§9-6**） |
| R-4 | Stakeholder モーダル | 関係者行の全画面ボタン | 同上 |
| R-5 | 前後ナビ（キーボード） | Tab で `aria-label="前のWork"` / `"次のWork"` に到達 → Enter | URL の `?id=` が変わり、ページ先頭へスクロールする |
| R-6 | 本文が空の Work | `sections` が空 | `WorkDetailContent` が null を返し、**罫線だけが浮かない** |
| R-7 | スクショ 0 / 1 / 3枚以上 | 各パターン | 端末モックの行が崩れない（ページは最大2枚表示） |
| R-8 | ツールアイコン破損 | `icon_url` が 404 の Work | テキスト Tag にフォールバックする |
| R-9 | admin プレビュー | `/admin/works/edit` の textarea に markdown を入れ、プレビューの見出しを変更前（port 3001）と比較 | **`WorkSections` のデフォルト値（`gap-[120px]` / `withDividers=false`）が変わっていない**こと。<br>※ **「見た目が変わっていない」を期待値にしない。** admin プレビューは公開側と `RenderBlock` を共有しているため、Phase 2 の見出し変更は**設計どおり admin にも及ぶ**。実測では文字サイズ・太さ・行間・字間・色は変更前と同一だが、**書体が Avenir → Noto Sans JP に変わる**（英字のみ。日本語は元から Noto にフォールバックしていたため不変）。§9-13 参照 |
| R-10 | `/works` を id 無しで開く | `http://localhost:3000/works` | エラー表示が新レイアウトで崩れない |
| R-11 | `/styleguide` の Card プレビュー | カードの rect | **392px**（754px に伸びていたら不合格） |
| R-12 | `.design-system-context.yml` | `npx --yes js-yaml .design-system-context.yml` | exit 0。`intentional_compromises` が **3件**（border色 / radius / モバイルサイドバー） |
| R-13 | 未追跡ファイル | `git status --short` | セットアップ時と同一。検証中に作ったファイルは削除済み |

---

## 9. 既知の未対応（**不合格にしない**）

以下は実装セッションが把握したうえで意図的に残したもの。指摘があっても新規の不具合として扱わない。詳細は `docs/requests/20260908-figma-master-sync.md` の §6 と各 Phase の実装記録にある。

1. **`markdown-h2` と `markdown-h3` が weight 以外まったく同じ**（17px / `#9e9e9e`）。Figma の Headline セットに 03 が存在しないことが原因の構造問題で、実装だけでは解けない。
2. **hover 背景が Figma の 2% ではなく 5%**。Figma の実値は `rgba(255,255,255,0.02)` だが対応するトークンが無いため、`Action/hover`（5%）を使っている。2% のトークン化は Figma 側へ依頼中。
3. **shadow が Figma の直書きと一致しない**。Card / Tooltip の Figma 実値は `1px 1px 8px spread 0` だが、トークン `shadow` は `1px 1px 16px spread 2`。Library を正とする方針でトークン側に寄せている。
4. **`/works` からサイドバーの「Works」を押すと着地が 327px ずれる**。遷移後に画像が読み込まれてトップページの高さが伸びるため。トップページ内のクリックは正常。フラグメント遷移全般の問題。
5. **`/works` は xl 未満でサイドバーが出ない**（ハンバーガー未移植）。戻りリンク「‹ Works」は常時出るので一覧へは戻れる。
6. **Timeline / Stakeholder モーダルが Esc で閉じない**。`Modal.tsx` にキーハンドラが無い既存の欠落。
7. **ライトボックスがスクショ5枚で横に溢れる**。`justify-center` のため左側へスクロールで到達できない。旧実装にも同じコードがあり退行ではない。
8. **モーダルがサイドバーを覆い、パネル中心が本文カラム中心と 128px ずれる**。**Figma もそうなっている**（`839:3764` の Container は 1440 の中央）ので仕様どおり。
9. **`git mv` の類似度が 43% で、既定の `-M50%` では改名として追跡されない**。`git log --follow components/WorkDetailHeader.tsx` の履歴が切れる。
10. ~~**`work.summary` とサイトリンクカードが admin から入力できるのに公開側に出ない**~~ → **2026-09-11 に解消済み**。DB カラム・admin 入力欄・型定義をすべて削除し、`.design-system-context.yml` の該当記録も削除した（`supabase/migrations/20260911100000_drop_work_summary_site_columns.sql`）。
11. **`images/hero-placeholder.jpg` が 404**。本作業と無関係の既存の欠落。
12. **System 025〜950 の 12 段・1000・Text/Caption・Border/Main・Action/hover の α が未照合**。Master のどのノードも使っておらず MCP から値が取れない（`search_design_system` は名前しか返さない）。
13. **英字の見出しの書体が Avenir → Noto Sans JP に変わった**（2026-09-10 に実測）。`text-title-pj` / `text-headline-01-jp` / `text-headline-02-jp` は Figma の `Body/JP` バインドに従い Noto 単独を指定するため、変更前の `font-body`（Avenir → Noto の自動切替）と違い英字も Noto で描画される。日本語は元から Noto にフォールバックしていたため不変。影響範囲はトップの「Introduction / Career / Skills」、Works 詳細のタイトル、本文の見出し、admin プレビュー。Figma の `Title/PJ` は `Body/JP` バインドなので**実装は Figma どおり**。**2026-09-10 にユーザー判断で現状維持（Noto）と決定した。** 英字を Avenir にしたい場合は Figma 側で `Title/EN` に付け替えるのが筋で、依頼書 §6 に列挙してある。
14. ~~**`section#skills` にだけ `mb-10` が残っている**~~ → **2026-09-10 に解消済み**。`mb-10` を削除し、最終セクション下の余白が Figma どおり **80px** になったことを実測で確認（`lastSectionBottomGap: 80`）。

---

## 10. 別セッション用プロンプト

以下をそのまま新しいセッションの最初のメッセージに貼る。

```
portfolio リポジトリ（/Users/tommyu/Dev/portfolio）で、Figma Master 同期の
PR #88 / #89 / #90 を独立に検証してほしい。あなたは実装者ではなく検証者。

【最初に読む】
1. docs/20260909-figma-master-sync-test-spec.md（テスト仕様書。これが指示書）
2. docs/requests/20260908-figma-master-sync.md（依頼書と各 Phase の実装記録。§6 と
   各 Phase の「未達・未確認」を必ず読む）
3. learnings/20260908-headless-chrome-cdp-screenshot.md（実描画の撮り方）

【対象】
ブランチ style/20260908-figma-master-layout。3 PR ぶんの変更がすべて載っている。

【やること】
テスト仕様書の §3 から §8 までを上から順に実行し、各ケースの合否を
「観測値 / 期待値 / 実行したコマンド」の3点セットで記録する。
§9 は「落としてはいけない既知の未対応」なので、不合格として報告しない。

【判定の原則】
- 期待値は実測値（getComputedStyle / getBoundingClientRect / exit code）で判定する。
  スクリーンショットの目視だけで合格にしない。
- 裏を取れなかった項目は合格にせず「未確認」と明記する。
- 実装は直さない。見つけた問題を報告するだけ。

【環境】
- dev サーバーは Claude Code の preview ツール（preview_start に name: "portfolio-dev"）で
  起動する。npm run dev を Bash で直接叩かない。
- dev サーバーが動いている状態で .next を消さない（Turbopack のキャッシュ DB が壊れて
  全ページ 500 になる）。本番ビルドが要るなら git worktree で隔離するか
  NEXT_DIST_DIR=.next-verify を使う。
- prettier を走らせない（このリポジトリの依存でも設定でもない）。
- 未追跡ファイル（.codex/config.toml / _to_delete/ / figma-skills-a-plan.js /
  docs/figma-color-token-sync-prompt.md / supabase/.temp/ /
  learnings/20260906-cowork-figma-unreachable.md）は触らない。
- /styleguide のサンプルデータを一時改変してよいが、必ず元に戻して git diff が
  空であることを確認する。
- 実データの Work は http://localhost:3000/works?id=c5b71719-c894-4678-9785-26887c0021b3
  （見つからなければトップページの Works カードをクリックして URL を取る）。

【特に厚く見てほしいところ】
- §4-2 と §4-3: text style ユーティリティ 19 種。19 件を機械的に突き合わせること。
  目視で「合っていそう」は不可。
- §4-5 T-8: text style ユーティリティに古い text-[Npx] / leading-* / tracking-* /
  font-bold が併記されていないか。併記すると組込みが後に出て勝ち、text style が
  黙って無効化される。型エラーも lint 警告も出ないので grep でしか見つからない。
- §7-3: レスポンシブ。ここは実際にブロッカーが2件出て直した箇所なので、
  375 / 768 / 1024 / 1090 / 1280 / 1440 の6幅すべてで実測すること。
- §8 R-1: トップページのサイドバーの href が #introduction のままか
  （/#introduction になっていたら退行）。

【報告の形式】
1. 合否サマリー表（ID / 判定 / 観測値）
2. 不合格・未確認の項目それぞれについて「指摘 / ラベル（VERIFIED か REASONED か
   未確認）/ 再現手順（実行したコマンドと出力）」
3. §9 に該当するため報告しなかったものがあれば、その ID を列挙
4. 最後に総合判定（合格 / 修正必要）

【閉じ方】
本文の最後は **完了**（何が終わったか1行）か **次のアクション**（誰が何をするか1つ）
で閉じる。前置き・結び・謝罪は書かない。実行結果と「未確認」の明記は省かない。
```

---

## 11. 変更ファイル一覧（レビューの取っかかり）

| ファイル | PR | 主な変更 |
|---|---|---|
| `lib/design-tokens.ts` | #88 | 照合状況のコメントのみ（値の変更なし） |
| `app/globals.css` | #88 | `@utility text-*` 19種 / `@source not` を5件に |
| `.design-system-context.yml` | #88 #90 | 意図的な妥協を計4件に |
| `components/Headline.tsx` | #89 #90 | SectionTitle を 34px・下線削除・`pb-8` / markdown-h1,h2 をユーティリティへ |
| `components/WorkMarkdown.tsx` | #89 | 実際に描画される h1 / h2 をユーティリティへ |
| `lib/figma-button-variants.ts` | #89 | primary の `h-10 max-w-200` / hover をトークンへ / Function の枠線と hover |
| `lib/figma-variants.ts` | #89 | `_Item` の Active から背景を削除 / hover をトークンへ |
| `components/Tag.tsx` | #89 | tool の背景削除・枠線・py・文字サイズ |
| `components/WorkCard.tsx` | #89 #90 | 背景削除・枠線・shadow・タイトル 13px / 固定幅を廃止 |
| `components/SideMenuBar.tsx` | #89 #90 | Tooltip の実値化・`aria-current` / `hrefBase` prop |
| `components/TabBar.tsx` | #89 | 外枠・padding・Active・hover |
| `components/Modal.tsx` | #89 | padding・radius・枠線・shadow・閉じるボタン位置・ドット |
| `src/components/WorksList.tsx` | #90 | 2列 392px の grid へ |
| `components/WorkDetailHeader.tsx` | #90 | `WorkDetailLeftPanel.tsx` から改名。メタ表・summary/サイトリンク削除 |
| `components/WorkDetailClient.tsx` | #90 | 単一カラム・SideMenuBar 追加・ナビの出し分け |
| `components/WorkDetailContent.tsx` | #90 | 幅と padding を廃止・罫線1本・gap 48 |
| `app/page.tsx` | #90 | Hero の死にクラス削除 |
| `app/styleguide/StyleguideLayout.tsx` | #88 #89 #90 | Text Styles をユーティリティ描画・各 description・TabBar アイコン差し替え・Card プレビュー幅 |
