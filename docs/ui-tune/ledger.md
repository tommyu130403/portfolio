# UI 台帳 — portfolio

生成日: 2026-11-06 / 生成元: ui-tune skill(初回起動)。2 回目以降はこのファイルと `ledger.json` を読む。
呼び方の約束: 画面は `P##`、画面内のエリアは `P##-名前`、画面をまたいで使う部品は `C##-名前`。
会話では「P01-HERO の上の余白」「C01-HEADLINE の文字サイズ」のように ID で指す。
機械が読む版は `ledger.json`(セレクタはそこが正)。スライダーの止まる位置は `tokens.json`。データの関係図は `er.md`。

## 画面一覧

| ID | 画面名 | URL | ファイル | 備考 |
|---|---|---|---|---|
| P01 | トップ | / | app/page.tsx | ログイン必須(AuthGate) |
| P02 | 作品詳細 | /works?id=… | app/works/page.tsx | 本体は components/WorkDetailClient.tsx |
| P03 | スタイルガイド | /styleguide | app/styleguide/page.tsx | 本体は app/styleguide/StyleguideLayout.tsx |
| P04 | 管理トップ | /admin | app/admin/page.tsx | /admin/profile へ自動転送 |
| P05 | 管理セクション | /admin/<section> | app/admin/[section]/page.tsx | profile / career / works / skills-experience / masters |
| P06 | 作品エディタ | /admin/works/edit?id=… | app/admin/works/edit/page.tsx | |
| P08 | 一時プレビュー | /tmp-preview | app/tmp-preview/page.tsx | 検証用 |

## エリア一覧

| ID | 名称 | 画面 | ファイル | セレクタ | 主な見た目の値 |
|---|---|---|---|---|---|
| P01-SIDEMENU | 左のサイドメニュー(lg 以上) | P01 | app/page.tsx | `div.sticky.top-0.shrink-0` | w-[96px] |
| P01-HERO | ヒーロー(顔写真・肩書き・名前・一言) | P01 | app/page.tsx | `main section:nth-of-type(1)` | gap-6 / sm:gap-16 / 写真 rounded-[32px] |
| P01-INTRO | 自己紹介(Intro) | P01 | app/page.tsx | `#introduction` | gap-10 / text-[15px] |
| P01-CAREER | 経歴(Career ガントチャート) | P01 | app/page.tsx | `#career` | gap-6 |
| P01-WORKS | 制作・企画(Works 一覧) | P01 | app/page.tsx | `#works` | — |
| P01-SKILLS | スキル(Skills カード) | P01 | app/page.tsx | `#skills` | — |
| P02-MAIN | 作品詳細の本文全体 | P02 | components/WorkDetailClient.tsx | `main` | — |
| P03-NAV | スタイルガイドの目次 | P03 | app/styleguide/StyleguideLayout.tsx | `aside nav` | gap-1(部品見本の nav と区別するため aside 配下に限定) |
| P03-COLORS | 色一覧 | P03 | app/styleguide/StyleguideLayout.tsx | `#colors` | — |
| P03-TYPO | 文字スタイル一覧 | P03 | app/styleguide/StyleguideLayout.tsx | `#typography` | — |
| P03-TOKENS | トークン一覧(角丸・サイズ) | P03 | app/styleguide/StyleguideLayout.tsx | `#tokens` | — |
| P03-ICONS | アイコン一覧 | P03 | app/styleguide/StyleguideLayout.tsx | `#icons` | — |
| P03-LOGOS | ロゴ一覧 | P03 | app/styleguide/StyleguideLayout.tsx | `#logos` | — |
| P03-COMPONENTS | コンポーネント一覧 | P03 | app/styleguide/StyleguideLayout.tsx | `#components` | — |
| P05-SIDEBAR | 管理画面の左ナビ | P05 | app/admin/AdminLayout.tsx | `aside` | w-[220px] / px-4 py-8 |
| P05-PROFILE | プロフィール・自己紹介の編集(/admin/profile) | P05 | app/admin/AdminLayout.tsx | `#profile` | — |
| P05-CAREER | 経歴の編集(/admin/career) | P05 | app/admin/AdminLayout.tsx | `#career` | — |
| P05-WORKS | 制作・企画の一覧と編集(/admin/works) | P05 | app/admin/WorksSection.tsx | `#works` | — |
| P05-SKILLS | スキルカルーセルの編集(/admin/skills-experience) | P05 | app/admin/AdminLayout.tsx | `#skills-experience` | — |
| P05-MASTERS | マスタ管理(/admin/masters) | P05 | app/admin/masters/MastersSection.tsx | `#masters` | — |
| P06-SIDEBAR | 作品エディタの左ナビ | P06 | app/admin/AdminLayout.tsx | `aside` | — |
| P06-MAIN | 作品エディタの本文 | P06 | app/admin/AdminLayout.tsx | `main` | — |

P01 のセクション間の間隔(120px)は `main > div` の `gap-[120px]`。「セクション同士の間」はこれを指す(P01-HERO 等の外側余白ではない)。
P05 は 1 画面 1 セクションなので、エリア ID が「どの URL か」も表す。P02・P08 と、P06 の中の細かいブロックは未分割。触るときに追記する。

## 共通部品一覧

| ID | 名称 | ファイル | 使われる画面 | 備考 |
|---|---|---|---|---|
| C01-HEADLINE | セクション見出し(日本語ラベル + 英語タイトル) | components/Headline.tsx | P01, P03 | label + title |
| C02-WORKCARD | 作品カード | components/WorkCard.tsx | P01, P03, P06 | |
| C03-TAG | タグ | components/Tag.tsx | P01, P03, P05, P06 | |
| C04-SIDEMENU | サイドメニュー本体 | components/SideMenuBar.tsx | P01, P03 | P01-SIDEMENU の中身 |
| C05-BUTTON-FUNCTION | 機能ボタン | components/ButtonFunction.tsx | P01, P03 | 経歴チャート内で使用 |
| C06-SECTION-TITLE | 管理画面のセクション見出し | app/admin/SectionTitle.tsx | P05 | label + title |

共通部品は一意なセレクタを持たないため、パネルからは「要素を選ぶ」で部品をクリックして選ぶ(ID 入力では選べない)。

## 更新履歴

| 日付 | 変更 |
|---|---|
| 2026-11-06 | 初回生成(画面 8・エリア 16・共通部品 5) |
| 2026-11-06 | 第三者検証の指摘で P03-NAV のセレクタを `aside nav` に、P06-MAIN のファイルを AdminLayout.tsx に修正。P01-INTRO の見出しを Intro に変更(試験反映) |
| 2026-11-06 | admin のエリアを追加(P05 を 6 セクションに分割、P06・P07 の骨組み、C06)。エリア 25・共通部品 6 |
| 2026-11-09 | フローチャート機能の廃止に伴い P07・P05-FLOWCHARTS・P07-LEFT・P07-RIGHT を削除。画面 7・エリア 22・共通部品 6 |
