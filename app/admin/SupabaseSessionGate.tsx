"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type SessionState = "loading" | "signedOut" | "signedIn";

/**
 * 管理画面の書き込みは Supabase Auth のログイン済みユーザー (private.owners 登録者) だけが
 * DB 側で許可される。ここでセッションを確認し、未ログインならログインフォームを出す。
 */
export function SupabaseSessionGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>("loading");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setState(data.session ? "signedIn" : "signedOut");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? "signedIn" : "signedOut");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") return <div className="min-h-screen bg-surface" />;
  if (state === "signedOut") return <LoginForm />;
  return <>{children}</>;
}

function LoginForm() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setChecking(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
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
        <p className="mb-10 text-[14px] text-fg-muted">管理画面ログイン</p>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            autoComplete="current-password"
            className="w-full rounded-[10px] border border-border-light bg-[#1a1a1a] px-4 py-3.5 text-[15px] text-white outline-none transition-colors focus:border-primary"
          />
          {error && (
            <p className="text-[13px] text-danger-300">{error}</p>
          )}
          <button
            type="submit"
            disabled={checking || !email || !password}
            className="mt-1 rounded-[10px] bg-primary py-3.5 text-[15px] font-semibold text-[#0a0a0a] transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {checking ? "確認中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
