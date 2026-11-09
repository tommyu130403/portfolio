# ゲストIDログイン 本番手順書

対象: 本番プロジェクト `kljlxjlbetaxhtxqzrdc`。作業者: オーナー本人(SQL Editor・ダッシュボード・端末)。
dev(`aemqzbsofprgmwtpfndf`)では 2026-11-08 に同じ手順で適用・検証済み。

## 用語

| 用語 | 意味 |
|------|------|
| SQL Editor | Supabase ダッシュボードの、DB に命令文(SQL)を流す画面 |
| マイグレーション | DB の構造を変える命令文のまとまり。今回は `supabase/migrations/20261108120000_guest_id_expiry.sql` |
| Edge Function | Supabase 上で動く小さなプログラム。今回はゲストIDを発行する `guest-admin` |
| 秘密(Secret) | Edge Function だけが読める設定値。今回は共通パスワード |
| Hook | ログインのたびに Supabase が呼ぶ DB の関数。期限切れのゲストにはログインの許可証(トークン)を出さない |
| 端末 / CLI | Mac の「ターミナル」と、そこで使う Supabase のコマンド(`supabase`) |
| PR / Actions | GitHub 上の変更の提案と、マージ後に公開サイトを作り直す自動処理 |

## 全体の順番

| # | 作業 | 場所 | ここで中断したときの影響 |
|---|------|------|------------------|
| 1 | マイグレーション SQL を流す | SQL Editor | 既存ゲストは期限 NULL(無期限)のまま。今の画面はそのまま動く |
| 2 | Edge Function `guest-admin` をデプロイ | 端末 | 呼ばれるまで何も起きない |
| 3 | 秘密 `GUEST_SHARED_PASSWORD` を設定 | ダッシュボード | 同上 |
| 4 | Hook を有効にする前の確認 SQL | SQL Editor | 読むだけ |
| 5 | Hook を有効にし、オーナーで入り直す | ダッシュボード | 入れなければ Hook を無効にすれば戻る |
| 6 | 新規登録を無効にする | ダッシュボード | — |
| 7 | PR をマージし、公開を待つ | GitHub | — |
| 8 | ゲストIDを1件発行して試す | 公開サイトの /admin/guests | — |
| 9 | 旧 Gmail ゲストを外す | SQL Editor | 最後に行う |

## 1. マイグレーション

1. SQL Editor で `supabase/migrations/20261108120000_guest_id_expiry.sql` の中身を全部貼り付けて実行する。
2. 確認 SQL を実行し、期待どおりか見る。

```sql
select
  (select count(*) from information_schema.columns
     where table_schema = 'private' and table_name = 'readers' and column_name = 'expires_at') as expires_at_col,  -- 1
  has_function_privilege('supabase_auth_admin', 'public.guest_access_token_hook(jsonb)', 'execute') as hook_exec,  -- true
  has_function_privilege('anon', 'public.owner_list_guests()', 'execute') as anon_owner_list,                    -- false
  (select count(*) from private.readers where expires_at is not null) as dated_readers;                         -- 0
```

SQL Editor で流した分はマイグレーション履歴に載らない(既存の運用と同じ。記録が要るなら別途登録する)。

## 2. Edge Function のデプロイ

前提: Supabase の CLI が入っていて、`supabase login` 済みであること(このMacは dev への関数デプロイで確認済み)。端末でリポジトリのフォルダに移動してから実行する。

```bash
supabase functions deploy guest-admin --project-ref kljlxjlbetaxhtxqzrdc --use-api
```

ダッシュボードの Edge Functions に `guest-admin` が ACTIVE(稼働中)で出ることを確認する。

## 3. 共通パスワードの秘密

- dev とは別の値にする。例: 端末で `openssl rand -base64 24` を実行して出た文字列。
- ダッシュボード → Edge Functions → Secrets で、Name `GUEST_SHARED_PASSWORD`、Value に値を入れて保存する。
- 値はパスワード管理アプリ(例: iCloud キーチェーン・1Password)に「portfolio ゲスト共通パスワード」として保存する。ダッシュボードでは後から値を見られないため。
- チャット・Git・普通のメモアプリには残さない。
- 補足: 2026-11-08 時点の CLI(v2.102)では `supabase secrets set` が「Invalid access token format」で失敗した。ダッシュボードで入れる。

## 4. Hook を有効にする前の確認

全オーナーで呼んで、誰も拒否されない(`false` が返る)ことを確かめる。

```sql
select bool_or(
  public.guest_access_token_hook(jsonb_build_object('user_id', o.user_id, 'claims', '{}'::jsonb)) ? 'error'
) as any_owner_rejected  -- false
from private.owners o;
```

`true` が返ったら先へ進まない。

## 5. Hook の有効化

1. ダッシュボード → Authentication → Hooks →「Add hook」→「Custom Access Token」。
2. Hook type: Postgres / Schema: `public` / Function: `guest_access_token_hook`。有効にして保存。
3. **このタブは閉じずに**、別のブラウザ(またはシークレットウィンドウ)で公開サイトにオーナーとしてログインし直す。
4. 入れなかったら、この手順の 1 で開いた Hooks の画面で Hook を無効にする(それで元に戻る)。

## 6. 新規登録の無効化

ダッシュボード → Authentication → Sign In / Providers →「Allow new users to sign up」をオフにする(画面名は Supabase の更新で変わることがある。本番の画面名は未確認)。
ゲストの発行は管理用の API で作るので、オフでも発行できる(dev では未確認。手順 8 で発行できることを確かめる)。

## 7. PR のマージと公開

GitHub で PR をマージし、GitHub Pages の公開(Actions)が終わるのを待つ。

## 8. 発行と動作確認

1. 公開サイトの `/admin/guests` を開き、「ゲストIDを発行」を押す。
2. 別のブラウザで、そのIDと共通パスワードでログインし、作品が見えることを確かめる。
3. 確認用に発行したIDは「今すぐ止める」で止める。止めたIDでログインすると「閲覧期限が切れています。オーナーにお問い合わせください」が出ることも確かめる。
4. 発行でエラーが出たら、画面に出た英語のエラー名(例: `create_failed: ...`)を控え、手順 2・3 をやり直す。直らなければ手順 9 に進まず、旧ゲストのまま運用する。

## 9. 旧 Gmail ゲストを外す(最後)

新方式でゲストに渡せることを確かめてから行う。

`/admin/guests` の一覧で、IDの列がメールアドレスになっている行が旧ゲスト。そのメールアドレスを下の `<旧ゲストのメールアドレス>` に入れて実行する。

```sql
delete from private.readers
where user_id = (select id from auth.users where email = '<旧ゲストのメールアドレス>')
returning user_id;  -- 1 行
```

Auth ユーザー自体を消す場合は、ダッシュボード → Authentication → Users から削除する(readers から外した時点で閲覧はできない)。

## 共通パスワードを変えるとき

1. 手順 3 と同じ画面で `GUEST_SHARED_PASSWORD` を新しい値に変える。
2. `/admin/guests` の「共通パスワードの再設定」→「共通パスワードを反映」→「本当に再設定する」を押す。
3. 期限内のゲストID(メール型の旧ゲストは除く)に新しい値が反映される。表示される「更新 n 件 / 失敗 n 件」の失敗が 0 か見る。

## 元に戻すとき

- ログインの拒否だけ止めたい: Hook を無効にする(データは期限で引き続き守られる)。
- 期限の判定ごと戻す: 先に Hook を無効にしてから、SQL Editor で次を実行する(`expires_at` 列は残っても害はない)。

```sql
create or replace function private.is_reader()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.readers where user_id = (select auth.uid())) $$;
```

## 残るリスク(許容済み)

- 期限後も、発行済みの画像URLは最大60分有効。
- ログイン中に期限を迎えた人は、最大約1時間(次のトークン更新まで)空のページを見て、その後は説明なしでログイン画面に戻る。期限切れの文言が出るのは、その間に再読み込みしたときか、ログインし直したとき。
- 一度ゲストになった人は共通パスワードを知り続ける。安全の支えは「IDを推測されないこと(12文字・約59ビット)」と「期限」。
