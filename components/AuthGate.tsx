"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { role, login } = useAuth();
  const ownerHash = process.env.NEXT_PUBLIC_OWNER_PASSWORD_HASH ?? "";
  const guestHash = process.env.NEXT_PUBLIC_GUEST_PASSWORD_HASH ?? "";

  if (!ownerHash && !guestHash) return <>{children}</>;

  if (role !== null) return <>{children}</>;

  return <LoginForm ownerHash={ownerHash} guestHash={guestHash} login={login} />;
}

function LoginForm({
  ownerHash,
  guestHash,
  login,
}: {
  ownerHash: string;
  guestHash: string;
  login: (role: "guest" | "owner") => void;
}) {
  const [input, setInput]       = useState("");
  const [error, setError]       = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;
    setChecking(true);
    setError("");
    try {
      const hash = await sha256hex(input);
      if (ownerHash && hash === ownerHash) {
        login("owner");
      } else if (guestHash && hash === guestHash) {
        login("guest");
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
