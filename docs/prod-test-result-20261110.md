# 本番運用テスト結果 — 段階 1(A・B)(2026-11-10)

[prod-test-plan-2026-11.md](prod-test-plan-2026-11.md) の §4-1 段階 1(A 閲覧の制限・B 公開物からの漏えい)の実施記録です。確かめていない項目は「未実施」とし、合格として扱いません。

- 対象: 公開サイト `https://tommyu130403.github.io/portfolio/`(`main` 59d3bd6 時点の配信)、本番 DB(Supabase `portfolio`)、開発用 DB(`portfolio_dev`)
- 実施者: Claude(本文の各行に明記)。本番 DB は読み取りのみ。書き換えの試行は開発用 DB で行い、各試行を例外で巻き戻した(A10 の `guest-admin` だけは本番で、書き込みを伴わない形で呼んだ)
- 公開リポジトリに入れてはいけない具体値(A7・B2 の中身)は、この文書には件数だけを書き、判断用の一覧はオーナーに別途渡した

## 用語

| 用語 | 意味 |
|---|---|
| RLS | データベースの行ごとの閲覧ルール。違反すると 42501 という番号のエラーになる |
| anon / authenticated | 未ログインの立場 / ログイン済みの立場 |
| JWT・`sub` | ログインの証明書と、その中の「誰か」を表す欄 |
| SECURITY DEFINER | 作成者の権限で動く関数。中で「オーナーか」を判定しないと危ない |
| token hook | ログインの証明書を発行するときに割り込む仕組み。期限切れのゲストをここで止める |
| WARN / INFO | Supabase の点検の注意・参考。合否の基準は ERROR だけ |
| 署名付き URL | 期限付きで画像を見られる URL。発行されなければ画像は見られない |
| HTTP の番号 | 200 = 成功、400・401・403・404 = 拒否や見つからない、429 = 回数制限 |

## 結果の一覧

| ID | 合否 | 実施者 | 証拠の要約 |
|---|---|---|---|
| A1 | 合格 | Claude | 空のプロフィールの Chrome でトップと作品詳細を開き、ログイン画面のみ。作品名・本文・画像 0 |
| A2 | 合格 | Claude | 本番 DB で役割を未ログイン(anon)に切替え、読取権限のある作品・経歴などの全 11 表と、画像置き場の主な 2 表(画像・置き場の一覧)が 0 行。他の表は権限なし |
| A3 | 合格 | オーナー(ログイン)→ Claude | 画面に非公開作品の題名・本文・画像 0。DB でも非公開作品 0 行。非公開専用の画像は、ゲストのログインで署名付き URL の発行を頼むと「Object not found」で発行されない(公開作品の画像は発行される)。出た文言は英語のエラー文で、計画どおり H2 の不合格として扱う |
| A4 | 合格 | オーナー(ログイン)→ Claude | `/admin`・`/styleguide` とも「このアカウントには管理権限がありません。」。開発用 DB でゲストの書き換え 9 件すべて拒否(うち画像の直接削除 1 件は、ゲストに限らず全員を止める仕組みによる拒否)。画像置き場の閲覧ルールに削除・更新の規則は無い |
| A5 | 合格 | オーナー → Claude | 止めた ID でのログインに「閲覧期限が切れています。オーナーにお問い合わせください」。ログイン状態は作られず、DB でも停止済み |
| A6 | 合格 | オーナー・Claude | 管理画面で token hook が有効・新規登録がオフ(オーナーの目視)。新規登録オフは公開設定 `/auth/v1/settings` の `disable_signup: true` でも確認 |
| A7 | 合格 | Claude(一覧)→ オーナー | 12 表の一覧を作成。オーナーが全行を「見せてよい」と判断(2026-11-10)。初回は一部の表を表単位で見せていたため、ツール名 34・スキル 4・スキル項目 15・経歴 5・プロフィール 1 の各行を並べた一覧を渡し直して判断を得た |
| A8 | 合格 | Claude | 本番の点検機能で ERROR 0 件(WARN 4 種・INFO 1 種は下に記録) |
| A9 | 合格 | Claude | 開発用で存在しない ID・誤ったパスワードを 10 回。10 回とも `400 invalid_credentials`、トークン発行 0 |
| A10 | 合格 | Claude | 開発用 DB でオーナー専用の関数 15 件すべて拒否。本番でゲストのトークンから `guest-admin`・`owner_list_guests` を呼んで 403 |
| B1 | 合格(再実施) | Claude・オーナー(設定) | 全履歴 626 コミットで鍵の形の文字列は実質 0 件(検証役が GitHub 上のコミット 624 件でも 0 件を再現。件数の差は手元にだけあるブランチの分)。初回は Secret scanning が無効で不合格、オーナーが有効にした後の再確認で有効・検出 0 件 |
| B2 | 合格 | Claude(洗い出し)→ オーナー | ①非公開作品に触れる 6 ファイルは「残す」。②人名らしき呼び方 0 件、数値 97 件は実数値のまま「残す」。下書き 1 件にある会社の募集ページへのリンクは「消す」(削除は別の作業)。いずれもオーナー判断(2026-11-10) |
| B3 | 合格 | Claude | 配信 JS 22 本とページ・静的ファイル 17 本で管理者用の鍵・使っていない設定名・見本データの文言が 0 件。接続用の鍵は公開用 1 種のみ |
| B4 | 合格 | Claude → オーナー | 作業用ページ `/tmp-preview` は 404。不要ファイル 5 つ(200 で配信中)はオーナーが「消す」と決定。削除は別の作業 |
| B5 | 合格 | Claude | `/admin`・`/styleguide` の HTML は題名のみ。JS は B3 で検査済み。作品 ID・メール・本文データ 0 件 |

## 項目ごとの証拠

### A1 未ログインの画面(合格)
- 手順: Chrome を空のプロフィール(`--headless=new --user-data-dir=<新規>`)で起動し、`/portfolio/` と `/portfolio/works?id=0d524339-…`(公開作品)を開いて画面を保存。内蔵ブラウザはオーナーのログイン状態が残っていたため使っていない。
- 結果: 両方とも「アクセスするにはログインが必要です」と ID・パスワード欄だけ。画面の文字を抜き出すと、作品詳細は「Works | Yu Tomita Portfolio Yu Tomita アクセスするにはログインが必要です アクセス ログインできないときのお問い合わせ」、`<img>` 0 個。
- 写し: [a1-top-logged-out.png](prod-test-evidence-20261110/a1-top-logged-out.png)、[a1-work-logged-out.png](prod-test-evidence-20261110/a1-work-logged-out.png)

### A2 未ログインでの DB 直接読み取り(合格)
- 手順: 本番 DB で `begin read only; set local role anon;` のうえで件数を数えた。
- 結果: `current_user = anon`。career_items・contents_vocab・profile・skill_cards・skill_experience・skill_experience_tools・tools_vocab・work_categories・work_contents・work_tools・works・storage.objects・storage.buckets がすべて 0 行。
- 残りの表(companies・contact_messages・phase_names・roles・stakeholder_groups・work_roles・work_stakeholder_counts、private スキーマ全表)は anon に読み取り権限そのものが無い。

### A3 非公開作品(合格)
- 画面: オーナーが確認用のゲスト ID を発行し、アプリ内のブラウザでゲストとしてログイン(Claude はトークンの利用者が `guest.invalid` の利用者であることだけを確認)。`/portfolio/works?id=0a7083bb-…`(非公開作品)を開くと、画面の文字は「Cannot coerce the result to a single JSON object」と「‹ Works 一覧へ戻る」だけ。画像は 0(署名付き URL 0)。写し: [a3-guest-unpublished-work.jpg](prod-test-evidence-20261110/a3-guest-unpublished-work.jpg)
- 英語のエラー文が出たため、計画の注記どおり H2 の不合格として段階 3 に引き継ぐ(A3 の合否には含めない)。
- 手順: 本番 DB で `begin read only; set local role authenticated;`、有効なゲスト 1 名(オーナーでない)の ID をログイン証明(JWT)の利用者欄 `sub` に設定して読み取り。
- 結果: `is_reader = true`・`is_owner = false`。works は 12 行(公開数と一致)、非公開 0 行。非公開作品 3 件の制作内容・役割 0 行。画像はゲストに 49 件見え、本番の画像 75 件のうち非公開作品だけが参照する 1 件は `is_public_portfolio_image = false`(読めない)。DB 確認に使ったゲストは、画面確認に使った確認用 ID とは別の有効なゲスト。
- 署名付き URL(期限付きで画像を見られる URL)の追加試験(2026-11-10): オーナーが新しい確認用ゲスト ID でログインし、そのゲストの立場で Storage API(画像置き場の窓口)に発行を頼んだ。非公開作品だけが使う画像は HTTP 400「Object not found / NoSuchKey」で発行されず、比較のための公開作品の画像は HTTP 200 で発行された。役割は `portfolio_access_role` = `reader`、利用者は `guest.invalid` の利用者。

### A4 ゲストの管理画面と書き換え(合格)
- 画面: ゲストのまま `/portfolio/admin`(`/admin/profile` へ移動)と `/portfolio/styleguide` を開くと、どちらも「このアカウントには管理権限がありません。」と「ポートフォリオへ戻る」だけ。写し: [a4-guest-admin.jpg](prod-test-evidence-20261110/a4-guest-admin.jpg)、[a4-guest-styleguide.jpg](prod-test-evidence-20261110/a4-guest-styleguide.jpg)(2 枚は同じ見た目で、画像だけではどちらの URL か区別できない。URL はページ内で取得した `location.href` が `/portfolio/admin/profile` と `/portfolio/styleguide` だったことで確認)
- 手順: 開発用 DB で、有効なゲスト 1 名になりすまし、各操作を例外で巻き戻す形で実行。
- 結果: works の更新・削除 0 行、works・roles・storage.objects への追加は RLS 違反(42501)、profile・career_items の更新と roles の削除 0 行。storage.objects の直接削除は「Direct deletion from storage tables is not allowed」で拒否されたが、これは誰に対しても直接削除を止める仕組みによるもので、ゲストの権限が効いている証拠にはならない。問い合わせの一覧も 0 行。
- 画像の削除について: 本番の画像置き場(`storage.objects`)の規則は「読み取り」と「追加」の 2 つだけで、削除・更新の規則は無い(`pg_policies` で確認)。規則が無い操作はゲストを含め誰も行えない。Storage API 経由で実際に削除を頼む試験は、本番の画像を消すおそれがあるため Claude の安全装置で止まり、行っていない。計画の A4 の基準(開発用 DB での書き換えの拒否)には含まれない追加の確認。
- 試行後の独立確認: `qa` という値の行・`qa-test.txt` の画像はすべて 0 件、停止を試したゲストは有効のまま。

### A5 ゲスト ID の停止(合格)
- 手順: オーナーが A3 で使った確認用ゲスト ID を管理画面から「今すぐ止める」→「本当に止める」で停止し、その ID でログインし直した。
- 画面: ログイン画面のまま、赤字で「閲覧期限が切れています。オーナーにお問い合わせください」。ブラウザにログイン状態(`-auth-token`)は保存されていない。画面の写しは ID が写るため残していない。
- DB(本番・読み取り): その ID の `private.readers.expires_at` は 2026-11-10 06:48:55 UTC(日本時間 15:48)で、現在時刻より前(停止済み)。

### A6 Supabase の設定(合格)
- オーナーが本番プロジェクトの管理画面で目視し、「どちらも指定通り」と報告(2026-11-10): ①Authentication → Hooks の `guest_access_token_hook` が有効 ②新規登録の許可がオフ。
- 裏付け: A5 で、止めた ID のログインが期限切れの文言で弾かれた。この判定は `guest_access_token_hook` が返す `guest_access_expired`(supabase/migrations/20261108120000_guest_id_expiry.sql 166 行)で、画面は lib/guestId.ts がそれを読んで文言を出す作り。よって①が有効であることを動作でも裏付けている。②は、本番の公開設定 `/auth/v1/settings` を公開用の鍵で読み取り、`disable_signup: true` を確認した(2026-11-10)。画面の写しは無い(Claude は管理画面を開いていない)。

### A7 ゲストが読める作品以外の表(合格)
- 対象 12 表: career_items 5 行、companies 2、contents_vocab 11、phase_names 15、profile 1、roles 30、skill_cards 4、skill_experience 15、skill_experience_tools 38、stakeholder_groups 7、tools_vocab 34、work_categories 7。
- 閲覧ルールは 12 表とも「オーナーかゲストなら全行」。作品にぶら下がる表(work_contents・work_roles・work_stakeholder_counts・work_tools)は公開作品の分だけに絞られている。
- 観測: roles・phase_names・companies は作品の公開・非公開に関係なく全件見える。中身の一覧はオーナーに別途渡した。

### A8 Supabase の点検(合格)
ERROR 0 件。記録として残す WARN / INFO:
- WARN: `public.update_updated_at_column` の search_path が固定されていない
- WARN: `public.rls_auto_enable()` を未ログインでも呼べる(SECURITY DEFINER)
- WARN: `owner_list_guests`・`owner_register_guest`・`owner_stop_guest`・`rls_auto_enable` をログイン済みなら呼べる(A10 で確認したのは `owner_*` の 3 つだけ。`rls_auto_enable` は試しておらず、リポジトリのマイグレーションにも定義が無い本番だけの関数。K2 で扱う)
- WARN: 漏えい済みパスワードの検査が無効
- INFO: private スキーマの 21 表で RLS は有効だが規則なし(未ログイン・ゲストとも読み取り権限なし)。private の 3 表は RLS 自体が無効(同じく権限なし)

### A9 ログインの連続失敗(合格)
- 手順: 開発用の認証窓口へ、毎回でたらめに作った 12 文字の ID と 16 文字のパスワードで 10 回ログインを試行。
- 結果: 10 回とも HTTP 400 `invalid_credentials`、トークン無し。回数制限による拒否(429)は 10 回では出なかった(記録のみ、合否に含めない)。

### A10 オーナー専用の操作(合格)
- 手順: A4 と同じ、ゲストになりすました開発用 DB で直接呼び出し。対象は、計画に挙がった操作(ゲスト ID の発行・停止・一覧、作品の保存、役割の削除と改名)と、同じくオーナー専用のマスタの改名・変更を合わせた 15 関数。オーナー専用の `replace_experience_tools` は試していない(計画の列挙外)。
- 結果: `owner_list_guests`・`owner_register_guest`・`owner_stop_guest` は `forbidden`。`save_work_with_relations`・`delete_role`・`rename_role`・`rename_company`・`rename_phase_name`・`rename_stakeholder_group`・`set_role_titled`・`set_role_stakeholder_group`・`set_stakeholder_group_icon`・`set_stakeholder_group_note`・`delete_stakeholder_group` は「Only the owner can …」、`rename_work_category` は「権限がないか、カテゴリが見つかりません」で拒否。
- `guest-admin`: 開発用で未ログインのまま呼ぶと 401 `unauthorized`。本番でゲストのトークン(役割 `portfolio_access_role` = `reader`)から呼ぶと 403 `forbidden`。同じトークンで `owner_list_guests` も 403(42501 forbidden)。
- 計画との差: 計画は開発用での実施だが、ゲストのログインが本番にあるため本番で行った。`guest-admin` は操作の種類を読む前にオーナーかを判定する作り(`supabase/functions/guest-admin/index.ts` 74 行)なので、書き込みを伴わない存在しない操作名 `qa-noop` で呼び、発行・パスワード再設定と同じ判定を通した。発行そのものは試していない。

### B1 秘密の検索(初回不合格 → 再実施で合格)
- 検索: `git log --all -p` の追加行 626 コミット分に、JWT・`sb_secret_`・`sbp_`・GitHub トークン・AWS・秘密鍵・Anthropic / OpenAI / Google の鍵・接続文字列・パスワードの代入の形を照合。一致は 1 件で、`supabase/config.toml` の `secret = "env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)"`(環境変数の参照で値ではない)。実質 0 件。
- 設定: `gh api repos/tommyu130403/portfolio` で `secret_scanning`・`secret_scanning_push_protection`・`dependabot_security_updates` がすべて `disabled`。
- 初回の判定: 基準「Secret scanning が有効」を満たさないため不合格。
- 対処: オーナーが GitHub の Settings → Advanced Security → 「Secret Protection」を有効にし、Push protection も On にした(2026-11-10)。
- 再確認: 同じ `gh api` で `secret_scanning`・`secret_scanning_push_protection` が `enabled`。`secret-scanning/alerts` の件数は 0。ただし GitHub 側の過去分の走査が終わっているかは未確認のため、後日もう一度件数を見る。`dependabot_security_updates` は `disabled` のまま(B1 の基準外。K4 で扱う)。
- 判定: 合格。基準の「検出 0 件」は、Claude の走査(手元の全履歴)と検証役の走査(GitHub 上の PR の参照を含む全コミット)の両方で満たしている。GitHub 自身の走査結果が 0 件のままかは後日見る(合否の根拠には使っていない)。
- §4-1 のやり直し: 対処は GitHub の設定変更だけで、サイトやリポジトリの中身は変わっていない。同じ領域の B3・B4・B5 は、検証役が修正後に独立に再確認し、同じ結果だった。

### B2 公開リポジトリの下書きと SQL(合格)
- `docs/work-drafts/` の下書き 12 件は、すべて本番で公開中の作品の ID。非公開作品の下書きは 0 件。
- `docs/` 内の SQL 2 件、`supabase/data/` 16 件。非公開作品の ID を含むファイルが 6 件(`supabase/data` 2、`supabase/backups` 3、`supabase/migrations` 1)。
- メールアドレスは見本用と `guest.invalid` のみ。会社名(片仮名・英字)はリポジトリ全体で 3 ファイルに出る: `lib/service-brands.ts`・`app/styleguide/StyleguideLayout.tsx` と、公開中の作品の下書き `docs/work-drafts/ee9dcea3-…md`(4 行目の、会社の募集ページへのリンク)。
- 個人名・社外秘の数値は機械で判定できないため、オーナーに一覧を渡して判断を依頼した。
- 判断(2026-11-10): ①非公開作品に触れる 6 ファイルは、6 件とも「残す」。
- ②の洗い出し: 下書き・`supabase/data`・`supabase/backups`・`docs` 直下の SQL の計 37 ファイルを機械的に調べ、人名らしき呼び方(〜さん・〜様・〜氏など。「仕様」などの誤検出は除外)0 件、「株式会社」などの社名表記 0 件(ただし上記のリンクにドメインとして会社名がある)、数値(%・円・人・件など)97 件。数値の一覧はオーナーに別途渡した。
- 判断(2026-11-10): 数値 97 件も実数値のまま「残す」。会社の募集ページへのリンクは「消す」。あわせてオーナーは、作品本文の外部リンク(サイト内リンクを除く)を一括で外す方針を示した。削除は別の作業で行い、この記録では行っていない。

### B3 配信ファイルの検査(合格)
- 取得: トップ・`/admin`・`/styleguide`・`/works` の HTML から参照される JS 22 本と、ページ・静的ファイル 17 本。
- 結果: `service_role`・`GUEST_PASSWORD_HASH`・`sb_secret_`・`SUPABASE_SERVICE`・`PRIVATE KEY` が 0 件。見本データ(`src/lib/fixtures/data.ts`)の文言 8 種が 0 件。接続先は本番 1 か所、接続用の鍵は `sb_publishable_`(公開用)1 種のみで JWT 形式の鍵は 0 件。

### B4 作業用ページと不要ファイル(合格)
| パス | 応答 |
|---|---|
| `/tmp-preview` | 404(合格) |
| `/robots.txt` | 404 |
| `/file.svg`・`/globe.svg`・`/next.svg`・`/vercel.svg`・`/window.svg` | 200(Next.js の見本画像。害は無いが不要) |

- 判断(2026-11-10): 見本画像 5 つは「消す」。削除(`public/` から外す)は修正にあたるため、この記録では行っていない。

### B5 `/admin`・`/styleguide` の中身(合格)
- `/admin`(9 KB)・`/styleguide`(20 KB)・`/works`・トップの HTML から script と style を除いた文字は題名だけ。作品 ID(UUID 形式)・メールアドレス・`"sections"` の出現はすべて 0 件。両ページが読み込む JS は B3 の 22 本に含まれ、そこでも作品 ID 0 件・メールは見本の `name@example.com` のみ(会社名は `lib/service-brands.ts` のブランド定義に由来し、DB のデータではない)。

## 不合格の記録

| ID | 内容 | 状態 |
|---|---|---|
| B1(初回) | GitHub の Secret scanning とプッシュ時の保護が無効 | オーナーが有効にし、再実施で合格 |
| H2(段階 3 の項目) | 非公開作品の URL を開くと英語のエラー文「Cannot coerce the result to a single JSON object」だけが出る(A3 で観測) | 未修正。段階 3 で扱う |

## 段階 1 の判定

全 15 項目が合格(B1 は再実施後)。判断待ち・未実施は 0 件。§4-1 の「段階 1 → 2 へ進む条件(全項目が合格)」を満たす。

| 後の作業 | 内容 |
|---|---|
| B4 の後始末 | `public/` の見本画像 5 つを削除する(別の依頼) |
| B1 の追跡 | 後日、GitHub の秘密検出の件数がまだ 0 件かを見る |
| H2 | 段階 3 で、非公開作品の URL に出る英語のエラー文を扱う |
| 外部リンク | 作品本文と下書きの外部リンク(会社の募集ページなど)を一括で外す(別の作業として実施中) |
| 確認用 ID | 追加試験で発行した確認用のゲスト ID を止める(オーナー) |
