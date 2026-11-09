# サイトの仕組みと運用

このポートフォリオサイトが「どう動いていて」「どう運用するか」をまとめた文書です。仕組みの説明はこのファイルを正とし、claude.ai の説明ページはここの写しとして扱います。

- 読み手: オーナー本人(エンジニアでなくても読める書き方にしています)
- 最終確認: 2026-11-09 時点の `main`(PR #207 まで)をコードと照らして確認
- ログインの仕様は [guest-login-spec.md](guest-login-spec.md) に分けています

## 1. 全体像

| 部分 | 何をしているか | 置き場所 |
|------|----------------|----------|
| 公開サイト | 見た人の画面を作る。中身は空の器で、データはあとから読みに行く | GitHub Pages(GitHub の無料公開サービス) |
| データ | 経歴・作品・画像などを保存する | Supabase(データベースと画像置き場のサービス) |
| 管理画面 | オーナーがデータを書き換える画面 | 公開サイトの `/admin` |
| ソースコード | サイトの設計図。変更はすべてここを通る | GitHub のリポジトリ(公開リポジトリ) |

公開 URL: https://tommyu130403.github.io/portfolio/

> このリポジトリは誰でも読める公開状態です。パスワード・鍵・個人のメールアドレスはここに書きません。

## 2. 公開サイトの作られ方

### 2-1. 静的書き出し

本番用に作るときだけ、サイトを「静的書き出し」します。静的書き出しは、ページを先に HTML ファイルの束へ変換しておく方式です。サーバー側でプログラムを動かさないので、GitHub Pages のようなファイル置き場で公開できます。

| 項目 | 開発中(自分の Mac) | 本番(公開サイト) |
|------|---------------------|-------------------|
| 書き出し | しない | する(`out/` フォルダに出力) |
| URL の頭 | なし(`/`) | `/portfolio` が付く |
| 根拠 | [next.config.ts](../next.config.ts) の `NODE_ENV === 'production'` の分岐 | 同左 |

### 2-2. 公開までの流れ

1. 変更を PR(変更の提案)にする。
2. PR を作ると、自動点検(後述の「門」)が走る。
3. オーナーが GitHub で PR をマージする(取り込む)。
4. `main` に入ると、自動処理がサイトを作り直して GitHub Pages に公開する。

自動処理の設定: [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)(`main` への push で動く)。公開前に、Supabase の接続先が設定されているかを確かめる手順があります。接続先が空のままだと「見本データ」で作られてしまうため、そこで止めます。

### 2-3. 見本データ(fixture)

Supabase の接続先が設定されていない環境では、本物のデータの代わりに見本データでページを描きます([src/lib/fixture-client.ts](../src/lib/fixture-client.ts))。Figma への取り込みや、接続設定のない作業フォルダでの画面確認に使います。

## 3. データの置き場所

### 3-1. 開発用と本番用の 2 つ

| 用途 | Supabase の識別名(project ref) | 使われる場面 |
|------|------------------------------|--------------|
| 開発用(dev) | `aemqzbsofprgmwtpfndf` | 自分の Mac で `npm run dev` したとき |
| 本番用(prod) | `kljlxjlbetaxhtxqzrdc` | 公開サイト。型の自動生成(`npm run update-types`)もこちらを向く |

切り替えは [src/lib/supabase.ts](../src/lib/supabase.ts) が行います。開発中は開発用の接続先を、本番の書き出しでは本番の接続先を読みます。接続先の値そのものは環境変数(パソコンや GitHub に別で保存する設定値)にあり、リポジトリには入っていません。

### 3-2. 誰が何を読めるか

データベースには RLS(行ごとの閲覧ルール)をかけています。画面側で隠すのではなく、データベースが「この人には渡さない」と判断する仕組みです。画面の作りに抜けがあっても、権限のない人にはデータが届きません。

| 人 | 判定する関数 | 読めるもの | 書けるもの |
|----|--------------|------------|------------|
| オーナー | `private.is_owner()`(名簿 `private.owners`) | すべて(非公開の作品も) | すべて |
| 閲覧者(ゲスト) | `private.is_reader()`(名簿 `private.readers`) | 公開中の作品とプロフィールなど | なし |
| ログインしていない人 | — | なし | なし |

- 2 つをまとめた判定が `private.can_read_portfolio()` です(オーナーか閲覧者なら読める)。
- 作品(`works`)は、閲覧者には `is_published`(公開フラグ)がオンのものだけを返します。
- 画面の出し分けには `public.portfolio_access_role()` を使います。この関数は `owner` / `reader` / `denied` を返すだけで、データを守るのは RLS の側です。
- 定義の出どころ: [20261013130000_owner_write_policies.sql](../supabase/migrations/20261013130000_owner_write_policies.sql)、[20261020130000_prepare_reader_access.sql](../supabase/migrations/20261020130000_prepare_reader_access.sql)、[20261020131000_protect_portfolio_reads.sql](../supabase/migrations/20261020131000_protect_portfolio_reads.sql)

## 4. ページとログイン

| ページ | 入れる人 | 入口の部品 |
|--------|----------|------------|
| トップ `/`・作品詳細 `/works` | オーナーと閲覧者 | [components/AuthGate.tsx](../components/AuthGate.tsx) |
| 管理画面 `/admin` | オーナーだけ | [app/admin/SupabaseSessionGate.tsx](../app/admin/SupabaseSessionGate.tsx) |
| スタイルガイド `/styleguide` | オーナーだけ | 同上 |

ログインはすべて Supabase の認証(メールアドレスとパスワード)です。ゲスト用 ID による新しいログイン方式は [guest-login-spec.md](guest-login-spec.md) にまとめています(2026-11-09 時点で未マージ)。

## 5. 中身の編集(管理画面)

`/admin` の左メニューは [app/admin/sections.ts](../app/admin/sections.ts) で決まっています。

| メニュー | 編集する内容 |
|----------|--------------|
| プロフィール・自己紹介 | トップのプロフィール |
| 経歴 | 経歴の一覧 |
| 制作・企画 | 作品(本文・画像・公開/非公開) |
| スキルカルーセル | スキルの見せ方 |
| マスタ管理 | 選択肢の一覧(カテゴリ・制作内容・会社・役割・工程名など) |

- 管理画面で保存した内容は、その場で本番のデータベースに入ります。サイトの作り直しは要りません(公開サイトはデータを毎回読みに行くため)。
- 作品本文の書き方の決まりは [work-body-patterns.md](work-body-patterns.md) にあります。

## 6. 画像

- 画像は Supabase Storage の `Portfolio` 置き場に入れています。置き場は非公開で、URL を知っていても直接は開けません。
- 表示するときは、[components/ProtectedImage.tsx](../components/ProtectedImage.tsx) がその場で「署名付き URL」(期限付きの合い鍵 URL)をもらって表示します。
- 署名付き URL の有効期限は 60 分です。期限の 5 分前になると取り直します。
- 閲覧者が読める画像は、公開中の作品とトップのプロフィールで使っている画像だけです([20261102123000_published_portfolio_storage_reads.sql](../supabase/migrations/20261102123000_published_portfolio_storage_reads.sql))。

## 7. デザインシステムとスタイルガイド

| もの | 役割 | 場所 |
|------|------|------|
| デザイントークン | 色・文字・角丸・余白などの値の一覧 | [lib/design-tokens.ts](../lib/design-tokens.ts)、[app/globals.css](../app/globals.css) の `@theme` |
| スタイルガイド | 部品と値の見本帳 | `/styleguide`([app/styleguide/StyleguideLayout.tsx](../app/styleguide/StyleguideLayout.tsx)) |
| Figma Library | デザインの正(原本) | [CLAUDE.md](../CLAUDE.md) §5 のリンク |

- デザインの判断は Figma Library を正とします。部品や値を変えたら、同じ作業の中でスタイルガイドも更新します([CLAUDE.md](../CLAUDE.md) §4)。

## 8. 品質の門

「門」は、決まりに合わない変更を機械的に止める点検です。

| 門 | 何を見るか | いつ動くか |
|----|------------|------------|
| `npm run check` | 型の点検(`tsc`)・書き方の点検(`eslint`)・本番と同じ作り直し(`next build`) | 手元で実行 / PR を作ったとき([.github/workflows/check.yml](../.github/workflows/check.yml)) |
| commitlint | コミットの書式 `<type>: <説明>` | コミット時([.husky/commit-msg](../.husky/commit-msg)) |
| pre-push | ブランチ名 `<type>/<yyyymmdd>-<説明>` | push 時([.husky/pre-push](../.husky/pre-push)) |
| `temp/` の禁止 | `temp/` ブランチでのコミット | Claude の操作時([.claude/hooks/block-temp-commit.sh](../.claude/hooks/block-temp-commit.sh)) |

補足: 2 つの自動処理の設定には `NEXT_PUBLIC_GUEST_PASSWORD_HASH` という設定名が残っています。2026-11-09 時点のコードはこの名前を読んでいません(検索で確認)。以前のパスワード方式の名残です。

## 9. 変更の進め方(Git のルール)

| 決まり | 内容 |
|--------|------|
| 作業場所 | `main` で直接作業しない。ブランチ(作業用の枝分かれ)を切る |
| ブランチ名 | `<type>/<yyyymmdd>-<説明>`(type: `feat` / `fix` / `refactor` / `style` / `chore` / `docs`) |
| 取り込み | PR を作り、**マージは必ずオーナーが GitHub で手作業で行う**。Claude はマージしない |

詳しくは [CLAUDE.md](../CLAUDE.md) §3。

## 10. データベースの変更を本番に届ける流れ

データベースの構造を変える命令文の束を「マイグレーション」と呼びます。置き場所は [supabase/migrations/](../supabase/migrations/) です。

| 段階 | 誰が | どこで |
|------|------|--------|
| 1. マイグレーションを書く | Claude | リポジトリ |
| 2. 開発用で試す | Claude | 開発用 Supabase |
| 3. 本番に流す | **オーナー本人** | Supabase ダッシュボードの SQL Editor(命令文を流す画面) |
| 4. 結果を確かめる | オーナーと Claude | 確認用の SQL と公開画面 |

- Claude は本番のデータベースに変更を当てません。
- 順番に注意が要る変更があります。たとえば「コードの公開が先、本番の SQL が後」のように、逆にすると管理画面の保存が壊れる例がありました。各 PR の説明に書く順番に従います。
- SQL Editor で流した分は、Supabase の変更履歴(マイグレーション履歴)には自動では載りません。

## 11. ほかの記録の置き場所

| 場所 | 中身 |
|------|------|
| [docs/](./) | 設計メモ・手順書・調査結果・作品の下書き(`docs/work-drafts/`) |
| [docs/requests/](requests/) | 作業の依頼書 |
| [learnings/](../learnings/) | 作業で得た学び(1 学び 1 ファイル。書き方は [learnings/README.md](../learnings/README.md)) |
| [CLAUDE.md](../CLAUDE.md) | Claude がこのリポジトリで守るルール |
| [supabase/](../supabase/) | マイグレーション・データ投入用 SQL・控え |

## 未確認の点

- GitHub Pages の公開にかかる時間(自動処理の実測はしていません)。
- 開発用 Supabase の中身が本番とどこまで同じか(マイグレーションの適用状況は作業ごとに違います)。
