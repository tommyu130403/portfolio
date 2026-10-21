"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/src/lib/supabase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { supabaseSession, accessRole } = useAuth();
  if (supabaseSession === "loading" || (supabaseSession === "signedIn" && accessRole === "loading")) {
    return <div className="min-h-screen bg-surface" />;
  }
  if (supabaseSession === "signedOut") return <LoginForm />;
  if (accessRole === "owner" || accessRole === "reader") return <>{children}</>;
  return <AccessDenied error={accessRole === "error"} />;
}

function AccessDenied({ error }: { error: boolean }) {
  const { logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface text-white">
      <p role="alert">{error ? "閲覧権限を確認できませんでした。" : "このアカウントには閲覧権限がありません。"}</p>
      <button
        type="button"
        onClick={() => {
          void logout()
            .then((message) => setLogoutError(message ?? ""))
            .catch(() => setLogoutError("ログアウトできませんでした"));
        }}
        className="text-primary hover:underline"
      >別のアカウントでログイン</button>
      {logoutError && <p className="text-danger-300" role="alert">{logoutError}</p>}
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [input, setInput]       = useState("");
  const [error, setError]       = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !input) return;
    setChecking(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: input });
      if (signInError) setError("メールアドレスまたはパスワードが正しくありません");
    } catch {
      setError("エラーが発生しました");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
      <div className="w-full max-w-[400px] px-8">
        <p className="mb-1 text-[12px] tracking-[0.6px] text-primary">Portfolio</p>
        <p className="mb-2 font-mplus text-[36px] leading-tight tracking-[1.8px] text-white">
          Yu Tomita
        </p>
        <p className="mb-10 text-[14px] text-fg-muted">
          アクセスするにはログインが必要です
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            autoFocus
            autoComplete="username"
            className="w-full rounded-[10px] border border-border-light bg-[#1a1a1a] px-4 py-3.5 text-[15px] text-white outline-none transition-colors focus:border-primary"
          />
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="パスワードを入力"
            autoComplete="current-password"
            className="w-full rounded-[10px] border border-border-light bg-[#1a1a1a] px-4 py-3.5 text-[15px] text-white outline-none transition-colors focus:border-primary"
          />
          {error && (
            <p className="text-[13px] text-danger-300">{error}</p>
          )}
          <button
            type="submit"
            disabled={checking || !email || !input}
            className="mt-1 rounded-[10px] bg-primary py-3.5 text-[15px] font-semibold text-[#0a0a0a] transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {checking ? "確認中…" : "アクセス"}
          </button>
        </form>
      </div>
    </div>
  );
}
