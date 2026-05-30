# 実装指示: 認証ロール分離・Dev/Prod データ分離

## 概要

以下の変更を行う。コードは書かず、まず本ドキュメントを読んで全体像を把握してから実装を開始すること。

### 変更の目的
- ゲスト／オーナーの 2 ロール認証を導入する
- `/admin/`・`/styleguide/` をオーナー認証済みユーザーのみアクセス可能にする
- 開発環境と本番環境で別の Supabase プロジェクトを使えるよう env 構成を整備する

### 確定した設計決定

| 項目 | 決定内容 |
|------|----------|
| ロール昇格（guest → owner） | ログアウト → 再ログイン |
| 開発環境の認証 | スキップ（常時 owner 相当） |
| 開発環境のデータ | Supabase 別プロジェクト（env 変数で切り替え） |

---

## 変更ファイル一覧

| 種別 | パス | 内容 |
|------|------|------|
| 新設 | `lib/auth.tsx` | AuthContext / AuthProvider / useAuth |
| 新設 | `components/OwnerGate.tsx` | owner ロール必須ガード |
| 改修 | `components/PasswordGate.tsx` | AuthGate に改名・2 ロール対応 |
| 改修 | `components/SideMenuBar.tsx` | IS_DEV 条件 → useAuth() に置換 |
| 改修 | `app/layout.tsx` | AuthProvider を追加 |
| 改修 | `app/page.tsx` | PasswordGate → AuthGate に import 更新 |
| 改修 | `app/admin/page.tsx` | OwnerGate でラップ |
| 改修 | `app/styleguide/page.tsx` | OwnerGate でラップ |
| 改修 | `.env.example` | 新 env var に更新 |
| 改修 | `.github/workflows/deploy.yml` | 新 env var に更新 |

> **styleguide への追記不要**: `AuthGate` と `OwnerGate` は認証ゲートの utility コンポーネントであり、デザインシステムの構成要素ではないため、`StyleguideLayout.tsx` への追記は不要とする。

---

## 詳細実装指示

### 1. `lib/auth.tsx`（新設）

#### 型・定数

```ts
type AuthRole = "guest" | "owner";
type AuthState = { role: AuthRole; expires: number } | null;

const SESSION_KEY = "portfolio_auth";       // 既存 SESSION_KEY と同名で上書き
const SESSION_MS  = 24 * 60 * 60 * 1000;  // 24h（変更なし）
const IS_DEV      = process.env.NODE_ENV === "development";
```

#### Context の shape

```ts
type AuthContextValue = {
  role: AuthRole | null;   // null = 未ログイン（dev では常に "owner"）
  login:  (role: AuthRole) => void;
  logout: () => void;
};
```

#### AuthProvider の挙動

- `IS_DEV === true` のとき: localStorage を参照せず `role = "owner"` で固定。login / logout は no-op。
- `IS_DEV === false` のとき:
  - マウント時に localStorage の `SESSION_KEY` を読む。`{ role, expires }` が存在し `expires > Date.now()` なら復元。
  - `login(role)`: `{ role, expires: Date.now() + SESSION_MS }` を localStorage に保存し state を更新。
  - `logout()`: localStorage から `SESSION_KEY` を削除し `role = null` に戻す。

#### export

```ts
export function AuthProvider({ children }: { children: React.ReactNode })
export function useAuth(): AuthContextValue   // Context が未提供なら throw
```

---

### 2. `components/PasswordGate.tsx` → `components/AuthGate.tsx` に改名

> ファイル名を `AuthGate.tsx` に変更する。既存の `PasswordGate.tsx` は削除する。

#### 削除するもの（既存コードから）

- `saveSession()` 関数（AuthProvider に移管）
- `isSessionValid()` 関数（AuthProvider に移管）
- `IS_PRODUCTION` 定数
- `SESSION_KEY` / `SESSION_MS` 定数

#### 新しい AuthGate の挙動

```tsx
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { role, login } = useAuth();

  // dev では AuthProvider が常に role="owner" を返すのでそのまま表示
  // prod でも role が確定するまでは loading 表示（SSR ちらつき防止）

  // role が null でなければ children を表示
  // role が null なら LoginForm を表示
}
```

#### ログインフォームのロール判定ロジック

ハッシュ照合は以下の優先順で行う:

1. 入力値を SHA-256 化
2. `NEXT_PUBLIC_OWNER_PASSWORD_HASH` と一致 → `login("owner")` を呼ぶ
3. `NEXT_PUBLIC_GUEST_PASSWORD_HASH` と一致 → `login("guest")` を呼ぶ
4. どちらにも一致しない → エラーメッセージを表示

どちらのハッシュも env に設定されていない場合（＝開発中など）: children をそのまま表示する（既存の `!expectedHash` 時の挙動を踏襲）。

#### UI・見た目

既存の `PasswordGate` のフォーム UI（パスワード入力・ボタン・エラー表示）をそのまま流用する。見た目の変更は不要。

---

### 3. `components/OwnerGate.tsx`（新設）

```tsx
"use client";

export function OwnerGate({ children }: { children: React.ReactNode }) {
  // useAuth() で role を取得
  // role が確定するまで（hydration 中）: 何も表示しない（<div className="min-h-screen bg-[#212121]" />）
  // role === "owner": children を表示
  // role !== "owner"（null または "guest"）: useEffect 内で window.location.replace("/") を実行し、
  //   その間は <div className="min-h-screen bg-[#212121]" /> を表示する
}
```

> `useRouter()` ではなく `window.location.replace("/")` を使う。静的エクスポートで Next.js Router が初期化されていないケースを避けるため。

---

### 4. `app/layout.tsx`（改修）

`AuthProvider` を `body` 直下の最外ラッパーとして追加する。

```tsx
import { AuthProvider } from "@/lib/auth";

// body の中:
<AuthProvider>
  {children}
</AuthProvider>
```

フォントクラスの `className` は `body` タグに残す（変更なし）。

---

### 5. `app/page.tsx`（改修）

- `import { PasswordGate } from "@/components/PasswordGate"` →  
  `import { AuthGate } from "@/components/AuthGate"` に変更
- JSX 内の `<PasswordGate>` → `<AuthGate>` に変更

それ以外の変更は不要。

---

### 6. `app/admin/page.tsx`（改修）

ファイル先頭に以下を追加し、ページ最外を `OwnerGate` でラップする。

```tsx
import { OwnerGate } from "@/components/OwnerGate";

// return の最外:
return (
  <OwnerGate>
    {/* 既存の JSX をそのまま内包 */}
  </OwnerGate>
);
```

admin ページは `AdminLayout` をレンダリングしているので、そのコンポーネント構造は変えない。

---

### 7. `app/styleguide/page.tsx`（改修）

このファイルは Server Component（`fs`・`path` を使用）。`OwnerGate` は Client Component なので、Server Component から import してラップすることは可能。

```tsx
import { OwnerGate } from "@/components/OwnerGate";

// return の最外:
return (
  <OwnerGate>
    <StyleguideLayout ... />
  </OwnerGate>
);
```

Server Component 側のデータ取得ロジック（`fs.readdirSync` 等）は変更しない。

---

### 8. `components/SideMenuBar.tsx`（改修）

#### 削除するもの

```ts
// 削除
const IS_DEV = process.env.NODE_ENV === "development";
const PROD_PREVIEW_KEY = "portfolio_prod_preview";
```

```tsx
// 削除: isProdPreview state と useEffect と toggleProdPreview 関数
const [isProdPreview, setIsProdPreview] = useState(false);
useEffect(() => { ... }, []);
const toggleProdPreview = () => { ... };
```

```tsx
// 削除: Developer セクション（IS_DEV 条件のブロック全体）
{IS_DEV && !isProdPreview && (
  <>
    ...Admin / Styleguide の SideMenuItem...
  </>
)}
```

```tsx
// 削除: 本番プレビュートグルボタン全体
{IS_DEV && (
  <button type="button" onClick={toggleProdPreview} ...>
    ...
  </button>
)}
```

#### 追加するもの

ファイル先頭（既存 import 群の末尾）に追加:

```tsx
import { useAuth } from "@/lib/auth";
```

コンポーネント内（`collapsed` 等の既存 state の直後）に追加:

```tsx
const { role, logout } = useAuth();
```

ナビゲーション内の「Divider + Developer セクション」を以下に置き換え:

```tsx
{role === "owner" && (
  <>
    <div className="my-2 h-px w-full rounded-[2px] bg-[#424242] shrink-0" />
    <p className="text-[10px] uppercase tracking-[0.4px] text-white/50 whitespace-nowrap px-0">
      Developer
    </p>
    <SideMenuItem
      icon={{ set: "Base", name: "config" }}
      label="Admin"
      href="/admin"
      collapsed={collapsed}
    />
    <SideMenuItem
      icon={{ set: "Edit", name: "format-brush" }}
      label="Styleguide"
      href="/styleguide"
      collapsed={collapsed}
    />
  </>
)}
```

「本番プレビュートグルボタン」があった箇所（aside 最下部）に以下を追加:

```tsx
{/* ログアウトボタン: dev では表示しない（auth なし） */}
{process.env.NODE_ENV !== "development" && role !== null && (
  <button
    type="button"
    onClick={logout}
    className="flex items-center gap-2 w-full transition-colors duration-200"
    title="ログアウト"
  >
    <Icon set="Peoples" name="logout" className="h-[18px] w-[18px] shrink-0 text-white/30" />
    <span
      className={[
        "text-[10px] tracking-[0.4px] text-white/30 whitespace-nowrap overflow-hidden transition-all duration-300",
        collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
      ].join(" ")}
    >
      ログアウト
    </span>
  </button>
)}
```

> `Icon` の `set: "Peoples", name: "logout"` が存在しない場合は、存在するアイコンに差し替えること（`Icon` コンポーネントのアイコン一覧を確認する）。

---

### 9. `.env.example`（改修）

`NEXT_PUBLIC_PASSWORD_HASH=` の行を削除し、以下に置き換える:

```dotenv
# ポートフォリオ パスワード（SHA-256ハッシュ）
# 生成方法: echo -n "yourpassword" | shasum -a 256
# 本番環境では GitHub Secrets に登録する
NEXT_PUBLIC_GUEST_PASSWORD_HASH=   # ゲスト用パスワードのハッシュ
NEXT_PUBLIC_OWNER_PASSWORD_HASH=   # オーナー用パスワードのハッシュ
```

---

### 10. `.github/workflows/deploy.yml`（改修）

`npm run build` の `env:` ブロック内を更新する。

変更前:
```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
  NEXT_PUBLIC_PASSWORD_HASH: ${{ secrets.NEXT_PUBLIC_PASSWORD_HASH }}
```

変更後:
```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
  NEXT_PUBLIC_GUEST_PASSWORD_HASH: ${{ secrets.NEXT_PUBLIC_GUEST_PASSWORD_HASH }}
  NEXT_PUBLIC_OWNER_PASSWORD_HASH: ${{ secrets.NEXT_PUBLIC_OWNER_PASSWORD_HASH }}
```

---

## コード外の手動対応（実装後にユーザーが行う）

以下はコードではなく環境設定の変更のため、実装タスクには含めない。完了後にユーザーへ案内すること。

1. **Supabase dev プロジェクト作成**: Supabase で新しいプロジェクトを作成し、prod と同じスキーマを適用する。
2. **`.env.local` の更新**:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` → dev プロジェクトの値に差し替え
   - `NEXT_PUBLIC_PASSWORD_HASH` → 削除
   - `NEXT_PUBLIC_GUEST_PASSWORD_HASH` / `NEXT_PUBLIC_OWNER_PASSWORD_HASH` → 任意のパスワードのハッシュ値を設定（dev では auth スキップのため任意の値でよい）
3. **GitHub Secrets の更新**:
   - `NEXT_PUBLIC_PASSWORD_HASH` を削除
   - `NEXT_PUBLIC_GUEST_PASSWORD_HASH` / `NEXT_PUBLIC_OWNER_PASSWORD_HASH` を追加（prod 用パスワードのハッシュ値）

---

## 実装の進め方

以下の順番で実装すること。後続ステップが前のステップに依存しているため、順序を守る。

1. `lib/auth.tsx` を新設する
2. `components/AuthGate.tsx` を新設し、`components/PasswordGate.tsx` を削除する
3. `components/OwnerGate.tsx` を新設する
4. `app/layout.tsx` に `AuthProvider` を追加する
5. `app/page.tsx` の import を `PasswordGate` → `AuthGate` に更新する
6. `app/admin/page.tsx` を `OwnerGate` でラップする
7. `app/styleguide/page.tsx` を `OwnerGate` でラップする
8. `components/SideMenuBar.tsx` を改修する
9. `.env.example` を更新する
10. `.github/workflows/deploy.yml` を更新する

---

## 完了確認チェックリスト

実装後、以下をすべて確認してから PR を作成すること。

- [ ] `npm run build` がエラーなく完了する
- [ ] TypeScript の型エラーがゼロ（`npm run typecheck` または build 時に確認）
- [ ] `components/PasswordGate.tsx` が削除されており、プロジェクト内に参照が残っていない
- [ ] `IS_DEV` / `PROD_PREVIEW_KEY` / `isProdPreview` が `SideMenuBar.tsx` から完全に除去されている
- [ ] `lib/auth.tsx` が `useClient` を含まない純粋な Context ファイルになっている（`"use client"` ディレクティブは Provider / hook が Client Component である場合は必要）
- [ ] dev 環境（`NODE_ENV=development`）でビルドした場合、認証フォームが表示されない
- [ ] OwnerGate が未認証アクセスを `/` にリダイレクトする動作を確認する（prod ビルドで確認）

---

## 変更しないもの

- `src/lib/supabase.ts`（Supabase クライアントはそのまま。env 変数の値だけ dev/prod で異なる）
- `app/admin/AdminLayout.tsx`（内部ロジックは変更なし）
- `app/admin/actions.ts`（Server Actions はそのまま）
- `app/styleguide/StyleguideLayout.tsx`（AuthGate / OwnerGate はデザインコンポーネントではないため追記不要）
- その他の `components/` 配下のファイル（ButtonAction, Headline, HistoryItem 等）
