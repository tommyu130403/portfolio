"use client";

import { useEffect, useState } from "react";

// ─── 定数 ──────────────────────────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SESSION_KEY   = "portfolio_auth";
const SESSION_MS    = 24 * 60 * 60 * 1000; // 24h

// ─── ユーティリティ ────────────────────────────────────
async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isSessionValid(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { expires } = JSON.parse(raw) as { expires: number };
    return Date.now() < expires;
  } catch {
    return false;
  }
}

function saveSession(): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ expires: Date.now() + SESSION_MS }),
  );
}

// ─── コンポーネント ────────────────────────────────────
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const expectedHash = process.env.NEXT_PUBLIC_PASSWORD_HASH ?? "";

  // 本番以外・ハッシュ未設定の場合はパスワードなしで表示
  if (!IS_PRODUCTION || !expectedHash) return <>{children}</>;

  return <PasswordGateInner expectedHash={expectedHash}>{children}</PasswordGateInner>;
}

function PasswordGateInner({
  expectedHash,
  children,
}: {
  expectedHash: string;
  children: React.ReactNode;
}) {
  const [state, setState]     = useState<"loading" | "locked" | "unlocked">("loading");
  const [input, setInput]     = useState("");
  const [error, setError]     = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setState(isSessionValid() ? "unlocked" : "locked");
  }, []);

  if (state === "loading") {
    // ちらつき防止のため最小限の背景のみ表示
    return <div className="min-h-screen bg-[#212121]" />;
  }

  if (state === "unlocked") return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;
    setChecking(true);
    setError("");
    try {
      const hash = await sha256hex(input);
      if (hash === expectedHash) {
        saveSession();
        setState("unlocked");
      } else {
        setError("パスワードが正しくありません");
      }
    } catch {
      setError("エラーが発生しました");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#212121]">
      <div className="w-full max-w-[400px] px-8">
        <p className="mb-1 text-[12px] tracking-[0.6px] text-[#48f4be]">Portfolio</p>
        <p className="mb-2 font-mplus text-[36px] leading-tight tracking-[1.8px] text-white">
          Yu Tomita
        </p>
        <p className="mb-10 text-[14px] text-[#616161]">
          アクセスするにはパスワードが必要です
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="パスワードを入力"
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-[10px] border border-[#424242] bg-[#1a1a1a] px-4 py-3.5 text-[15px] text-white placeholder-[#424242] outline-none transition-colors focus:border-[#48f4be]"
          />
          {error && (
            <p className="text-[13px] text-[#f4487e]">{error}</p>
          )}
          <button
            type="submit"
            disabled={checking || !input}
            className="mt-1 rounded-[10px] bg-[#48f4be] py-3.5 text-[15px] font-semibold text-[#0a0a0a] transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {checking ? "確認中…" : "アクセス"}
          </button>
        </form>
      </div>
    </div>
  );
}
