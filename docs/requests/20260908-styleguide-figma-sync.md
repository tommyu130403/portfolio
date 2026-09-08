# 依頼書 — Figma Library を正としてトークンとスタイルガイドを同期する(Phase 1 + 2)

- 作成日: 2026-09-08
- 状態: **合意済み・未実装**(方針セッションで合意。実装は別セッションで行う)
- 種別: `style`
- 目的(なぜ): スタイルガイドと実装トークンが Figma Library の現状(グレー25段・text style 19種・semantic 11種・サイト幅 800)を反映しておらず、デザインと実装の照合に使えない状態を解消する。

## 合意事項(2026-09-08 ユーザー選択)

| 項目 | 決定 |
|---|---|
| 範囲 | Phase 1(見た目を変えない追加・値修正)+ Phase 2(サイトの見た目が変わる変更)を **同時に1タスク** で行う |
| 正の定義 | **Library(`KpNwkdFy1usaO1sBR0dycv`)の変数・paint style・text style が正**。Master(`j0g2E1YFLJfikcrmW0PJC5`)だけにある Headline/03/JP・Border/Default #424242・Background/Dark-α25 は残骸として取り込まない |
| ブランチ | main から `style/20260908-styleguide-figma-sync` を切る。PR #76 とは独立 |
| §2-2 要承認 | Phase 2 の変更サマリーは方針セッションで提示済み。実装セッションでは着手前に短く再提示して OK を取る(安全側) |

## 完了条件
- [ ] `lib/design-tokens.ts` の `color.system` が Figma の System 25段 + Black/White と名前・値ともに一致する(1000 は #000000)
- [ ] `textStyle` が Figma の text style 19種すべてを含み、size / weight / letterSpacing が一致する(行間 AUTO は `normal`)
- [ ] `semantic` が Figma の paint style 11種と1対1で対応する(新規4種追加、Border/Default → #3A3A3A、Border/Light → #424242、overlayLight を Action/hover 対応へ改名、Background/Dark・Dark-α25 を削除)
- [ ] `container.desktop.width.mainMax` と `--container-main` が 800 になる
- [ ] `app/globals.css` の `@theme` が上記と同じ名前・並びになる
- [ ] `/styleguide` で System 25段・19スタイル・Semantic 11種・Container 800 が表示される(プレビューで目視)
- [ ] Components 節が Figma Component ページの並び(Headline → Button → Tag → SideMenuBar → Tooltip → TabBar → Chart → Modal → Card → Table)になり、Figma のみ / 実装のみ が明記され、`Modal` が掲載される
- [ ] トップページ・Works 詳細・admin をプレビューで目視し、幅 800・枠線色の変更が崩れを起こしていない
- [ ] Figma に差分がないトークン値は変わらない(`git diff` で確認)
- [ ] `npm run check` が exit 0

## 対象ファイル(観測済み)
- `lib/design-tokens.ts` — system 14段追加 + 1000 の値変更、textStyle 9種追加 + 3種値修正、semantic 4種追加 + 2種値変更 + 1改名 + 2削除、mainMax 800、typo.guide の整理
- `app/globals.css` — `@theme` の `--color-system-*`・semantic・`--container-main`
- `app/styleguide/StyleguideLayout.tsx` — `SEMANTIC_SWATCHES`、フォント表、`ComponentsSection`(Colors / Typography / Tokens 節はトークンから自動生成のため変更不要)
- 呼び出し元 / 影響範囲: `app/page.tsx`(`max-w-main` 6箇所)、`app/admin/AdminLayout.tsx`、`border-border` を使う 9箇所、`surface-dark` / `overlay-dark` の利用箇所(削除前に grep で確認)

## 非スコープ
- Tooltip / Legend / Table / RadarChart など Figma にだけあるコンポーネントの新規実装
- `#1a1a1a` 直書き 66 箇所のトークン化
- Master ファイルの孤立スタイルと Library 説明フレームの残骸の修正(Figma 側作業)

## ゲート判定
| ゲート | 判定 | 根拠 |
|---|---|---|
| §0-1 不可逆操作 | 非該当 | ファイル編集のみ |
| §2-2 要承認 | **該当** | `border-border` 9箇所・`max-w-main` 全ページに波及。サマリーは方針セッションで提示し「Phase 1+2 同時」を選択済み。実装セッションでは着手前に短く再提示して OK を取る |
| §3 ブランチ | main から `style/20260908-styleguide-figma-sync` を新規作成 | 合意済み。PR #76 とは独立 |
| §4 スタイルガイド | 更新義務あり | トークン増減 + `@theme` 変更 |
| §5 Figma | 突き合わせ済み | Library が正と合意。Master のみのスタイルは取り込まない |
| §6-2 fable | 非該当 | 可逆・手順書あり |

## 実行計画(実装セッション用)
1. `shipper` — main を最新化し `style/20260908-styleguide-figma-sync` を作成
2. `builder` — design-tokens → globals.css → StyleguideLayout の順に更新
3. メインセッション — `/styleguide`・トップ・Works 詳細・admin をプレビューで目視
4. `qa-verifier` — 既存トークン値の不変を `git diff` で反証、削除した semantic の参照残りを grep で確認、`npm run check`
5. `shipper` — コミット・PR 作成(マージはしない)

## 未確認 / 要判断
- Figma の行間 AUTO を CSS の `normal` として扱う — REASONED(実装は従来 100%=1.0 と解釈していたが、Figma の実体は AUTO)
- Headline/03/JP は Master のみ — VERIFIED。Library の Headline/02/JP(17px)と同値なので実装からは統合(削除)
- Library の説明フレームはテンプレート残骸 — VERIFIED。Figma 側で直すのはユーザー作業
- `surface-dark` / `overlay-dark` の利用箇所数 — 未確認(実装セッションで grep)
- `npm run check` 着手前 exit 0 — VERIFIED(2026-09-08、`chore/20260907-harness-design` 上)

---

## 付録 A. 差分表(Figma Library 実測 vs 実装 — VERIFIED 2026-09-08)

取得方法: `use_figma` で Library の全変数コレクション・local text style・effect style・paint style を取得し、`lib/design-tokens.ts` / `app/globals.css` / `app/styleguide/StyleguideLayout.tsx` と1件ずつ照合。

### 一致(変更なし)
Main / Danger / Warning の全段階、Radius 6種(2/4/8/16/40/80)、Size 23種、Shadow 2種(shadow / shadow-wisper)、Device の tablet / mobile / breakpoints(1280 / 1024 / 390)、本文系 text style 7種。

### 色(primitive)
| 項目 | Figma | 実装 | 判定 |
|---|---|---|---|
| System グレー | 25段(025〜1000)+Black/White | 11段 | **新規14段**: 025 #FDFDFD / 075 #F8F8F8 / 150 #F2F2F2 / 250 #E7E7E7 / 350 #CFCFCF / 450 #AEAEAE / 550 #8A8A8A / 650 #6B6B6B / 750 #525252 / 825 #3A3A3A / 850 #323232 / 875 #292929 / 925 #191919 / 950 #111111 |
| System/1000 | #000000 | #1A1A1A | **値変更**(実装内で 66 箇所が `#1a1a1a` を直書き → 非スコープ) |
| Color コレクションの `label` / `Icon`(BOOLEAN) | あり | — | トークンではないので対象外 |

### 意味付きの色(Semantic — Figma paint style 11種)
| Figma 名 | Figma 値 | 実装(現状) | 判定 |
|---|---|---|---|
| Main/Primary | #48F4BE | primary | 一致 |
| Main/Secondary | #2B9E7A (=Main/300) | なし | **新規** |
| Text/Body/Main | #FFFFFF | fg | 一致 |
| Text/Body/Sub | #9E9E9E | fgMuted | 一致 |
| Text/Caption | #BDBDBD (=System/400) | なし | **新規** |
| Background/Default | #212121 | surface | 一致 |
| Background/Light | #292929 (=System/875) | なし | **新規** |
| Border/Default | #3A3A3A (=System/825) | border #424242 | **値変更**(`border-border` 9箇所に影響) |
| Border/Light | #424242 (=System/800) | borderStrong #9E9E9E | **値変更**(実装の borderStrong と意味がズレている) |
| Border/Main | #48F4BE 40% | なし | **新規** |
| Action/hover | #FFFFFF 5% | overlayLight(同値・別名) | **改名** |
| (Background/Dark / Dark-α25) | Library に無し | surfaceDark / overlayDark | **削除**(Master の timeline モーダルにだけ残存) |

### 文字スタイル(Figma local text style 19種 vs 実装 11種)
| Figma 名 | Figma | 実装 | 判定 |
|---|---|---|---|
| Title/PJ | Noto Sans JP Bold 34 / 行間 AUTO / 3% | 40 / 1.0 | **値変更** |
| Title/EN | Avenir Heavy 38 / AUTO / 3% | なし | **新規** |
| Headline/01/JP | Noto Bold 24 / 150% / 5% | 一致 | 一致 |
| Headline/01/EN | Avenir Heavy 24 / AUTO / 5% | なし | **新規** |
| Headline/02/JP | Noto Bold 17 / AUTO / 5% | 20 / 1.5 | **値変更** |
| Headline/02/EN | Afacad Bold 20 / 150% / 5% | Avenir 800 / 1.0 | **値変更** |
| Headline/03/JP | Library に無し(Master のみ) | 17 / 700 / 1.0 | **削除**(Headline/02/JP と同値) |
| Body/01/JP/Regular | Noto Regular 15 / 150% / 3% | 一致 | 一致 |
| Body/01/JP/Bold | Noto Bold 15 / 150% / 3% | なし | **新規** |
| Body/01/EN/Regular | Avenir Roman 17 / AUTO / 0 | なし | **新規** |
| Body/02/JP/Regular | Noto Regular 13 / 150% / 3% | 一致 | 一致 |
| Body/02/JP/Bold | Noto Bold 13 / 150% / 3% | 一致 | 一致 |
| Body/02/EN/Regular | Avenir Roman 15 / AUTO / 0 | なし | **新規** |
| Body/03/JP/Regular | Noto Regular 11 / 150% / 3% | 一致 | 一致 |
| Body/03/JP/Bold | Noto Bold 11 / 150% / 3% | なし | **新規** |
| Body/03/EN/Regular | Avenir Roman 13 / AUTO / 0 | 一致 | 一致 |
| Caption/01/JP | Noto Regular 10 / AUTO / 3% | 一致 | 一致 |
| Caption/01/EN | Avenir Roman 12 / AUTO / 0 | なし | **新規** |
| Caption/02/JP | Noto Regular 9 / AUTO / 3% | なし | **新規** |
| Caption/02/EN | Avenir Roman 11 / AUTO / 0 | なし | **新規** |

フォント変数(Typo コレクション): Special/EN = Afacad、Body/JP = Noto Sans JP、Body/EN = Avenir の3つのみ。実装の `typo.guide.jp` "Mplus 1p" は Figma に無い → 整理対象。

### 画面幅(Device コレクション)
| 項目 | Figma | 実装 | 判定 |
|---|---|---|---|
| desktop Main/Max | **800** | 1024 | **値変更**。`max-w-main` として全ページとエディタで使用。以前の同期(コミット e76e70e)時は Figma が 1024 だった |
| desktop Main/Min / Side / Screen | 728 / 256 / 1440×1024 | 一致 | 一致 |
| tablet | 1024×1366 / Main 704〜480 / Side 96 | 一致 | 一致 |
| Mobile | 390×844 / Main 390 / Side 96 | 一致 | 一致 |

### Components 節(Figma Component ページ `14:346`)
| Figma のセクション順 | Figma コンポーネント(バリアント) | 実装 / styleguide |
|---|---|---|
| Headline | SectionTitle、Headline(01 / 02) | Headline |
| Button | Button/Action(primary / secondary / ghost × default / hover、Icon)、Button/Function(Border on / off × default / hover、Icon、Label) | ButtonAction、ButtonFunction |
| Tag | Tag(Label、Icon slot、Icon2) | Tag |
| SideMenuBar | SideMenuBar(default / small)、_Item(9 variants) | SideMenuBar |
| Tooltip | Tooltip(slot) | **Figma のみ** |
| TabBar | TabBar、_TabBarItem(default / Active / hover、Icon) | TabBar |
| Chart | RadarChart、Legend(primary / secondary) | **Figma のみ**(styleguide 未掲載) |
| Modal | Modal(Slot、Carousel) | `components/Modal.tsx` は存在するが **styleguide 未掲載** |
| Card | Card(default / hover、Slot) | WorkCard(対応関係は要確認) |
| Table | _Table/CellLabel、_Table/CellContent | **Figma のみ** |
| — | — | **実装のみ**: HistoryItem、RichMarkdownEditor、FlowchartView、WorkProcessChart、WorkStakeholderDiagram、WorkVizModal、WorkDetailLeftPanel、WorkDetailContent |

## 付録 B. Figma 側で直すと良いもの(ユーザー作業・実装からは自動で書き戻せない)
- Library の Color 説明フレーム: Main の HEX ラベルが UI キットの残骸(#9C7C45 等)。色そのもの(変数)は正しい
- Library の Typography 説明フレーム: テンプレートのまま(Title EN 44 / JP 32 …)で、実際の text style と一致しない
- Master(サイトデザイン): Headline/03/JP・Border/Default #424242・Background/Dark-α25 など Library に存在しないスタイルを使っている → Library のスタイルへ付け替え

---

## 実装記録（2026-09-08 実装セッション）

状態: **実装済み・PR 作成済み・未マージ**。ブランチ `style/20260908-styleguide-figma-sync`（main `bb8bc7d` から分岐）。

### 着手前の再承認（§2-2）
Phase 2 の4件（System/1000 → #000000 / Border/Default → #3A3A3A / Border/Light → #424242 / Main.Max → 800）を影響範囲つきで再提示し、**4件すべて適用**で承認を得た。

### 実装セッションで決めたこと（依頼書に無かった判断）

| # | 判断が必要になった点 | 決定 | 根拠 |
|---|---|---|---|
| 1 | 削除する `surfaceDark` / `overlayDark` の置換先（依頼書 61 行で「未確認」としていた項目） | `bg-surface-dark` → **`bg-surface-light`**（新設 Background/Light #292929）、`bg-overlay-dark` → **`bg-black/25` 直書き** | ユーザー承認。Library に暗幕に対応する paint style が無いためスクリム側はトークン化しない。該当4箇所（`app/page.tsx` ×3 / `components/FlowchartNodes.tsx` ×1）はプレビューで目視確認済み |
| 2 | `typo.guide` の整理方法 | `typo.guide` → **`typo.special`** に改名し `jp: "Mplus 1p"` を削除 | `app/globals.css` のコメントが既に `typo.special.en` を参照しており、実装側の名前が drift していた。`--font-guide` / `--font-mplus` と `app/layout.tsx` の next/font 定義は無変更（実利用が4箇所あるため） |
| 3 | Main.Max 800 でトップページ Skills のスキル名が幅 36px に潰れた | **Figma Master `502:1344` に合わせてレイアウトを是正**：カテゴリカード 2列 → **1列**（各 800px）、カード内のスキル項目 1列 → **2列**（各 352px）、レベル文字（Expert / Advanced）を視覚的に削除し `sr-only` で読み上げにのみ残す | ユーザー承認。原因は「800 が狭い」ではなく **カテゴリと項目のカラム数が Figma と入れ替わっていた**こと。Figma の `_SkilllItem` は 352px でレベル文字を持たない。2列化は `xl:`（1280px 以上＝本文幅が 800 に達する帯）に限定 |

### 実装で追加した修正（同期に付随して見つかったもの）
- スウォッチの並び順：`Object.entries` が `"025"` のような先頭ゼロ付きキーを整数扱いしないため `100…1000 → 025 → 050 → 075` の順に描画されていた。明度順ソート（`orderedShades`）を追加
- スタイルガイドのフォント表に **`font-guide`（実装ローカル）** の行を追加。`--font-guide` は `@theme inline` 定義で CSS 変数として出力されないため、この行だけ class 経由で描画
- スタイルガイドの FlowchartView サンプルに **note ノード**を追加（`bg-surface-light` を使う唯一のノード種別が未描画で検証できなかったため）

### 完了条件の未達・未確認
- **`npm run check` は本ブランチに存在しない**（`package.json` の scripts は dev / build / start / lint / update-types / prepare）。`check` は未マージの PR #76 で追加されるもの。代替として `npx tsc --noEmit`（exit 0）・`npm run lint`（ベースラインと同一：3 errors / 17 warnings、増減なし）・`npm run build`（成功・15ルート）を個別に実行した
- **Figma の実値照合は部分的に実施（VERIFIED 2026-09-08）**。`get_variable_defs` は「Figma で選択中のノードが使っている変数」しか返さないため、Library ファイル（canvas がテンプレート残骸のみで変数を使うノードが無い）からは取得できない。Master の Skills ノード `502:1344` を選択した状態で取得し、**23 件を突合してズレゼロ**を確認した。
  - 裏取りできた重要項目: **Border/Default `#3A3A3A` / Border/Light `#424242` / Main/Max `800`**（＝見た目が変わる Phase 2 の3件）、System/825、Headline/02/EN（Afacad Bold 20 / lh 1.5 / ls 5%）、Body/02/JP/Regular、System/500・600・800・White、Main/050・100・base、Special/EN・Body/JP・Body/EN、Text/Body/Main・Sub、Main/Primary、Size 8種
  - **行間 AUTO → CSS `normal` の判断も裏取り（REASONED）**: Body/03/EN と Caption/01/JP は `lineHeight: 100` と返る。同じ出力で 150% のスタイルは `1.5` と倍率で出るため、`100` は倍率ではなく AUTO の表現。依頼書の REASONED 判断は維持
  - **未確認のまま**: System 新規14段のうち 825 以外の13段、System/1000、Action/hover の不透明度5%、新規 semantic 4種（Main/Secondary・Text/Caption・Background/Light・Border/Main）。いずれも Skills ノードが使っておらず取得範囲外。**現時点でコードからも使われていない**ため（`system-1000` を使う指定はゼロ）、値が違っても見た目への影響は無い。実際に使うときに個別確認する方針でユーザー合意済み
- 390px（モバイル）でスキル名 3 件が `line-clamp-2` で切れる。**この変更以前から存在する切れ**で、レベル文字を削除した分むしろ改善している（カード内 `padding: 40` が固定値であることが原因）。本タスクでは扱わない
