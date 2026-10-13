"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

// 旧形式 `{ role, expires }` も expires だけを見るので有効
type StoredEntry = { expires: number } | null;
export type SupabaseSessionState = "loading" | "signedOut" | "signedIn";

const SESSION_KEY = "portfolio_auth";
const SESSION_MS  = 24 * 60 * 60 * 1000;
const IS_DEV      = process.env.NODE_ENV === "development";

type AuthContextValue = {
  entered: boolean;
  supabaseSession: SupabaseSessionState;
  login:  () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(IS_DEV);
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSessionState>("loading");

  useEffect(() => {
    if (IS_DEV) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as StoredEntry;
      if (state && state.expires > Date.now()) {
        setEntered(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSupabaseSession(data.session ? "signedIn" : "signedOut");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseSession(session ? "signedIn" : "signedOut");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = IS_DEV
    ? () => {}
    : () => {
        const state: StoredEntry = { expires: Date.now() + SESSION_MS };
        localStorage.setItem(SESSION_KEY, JSON.stringify(state));
        setEntered(true);
      };

  const logout = IS_DEV
    ? () => {}
    : () => {
        localStorage.removeItem(SESSION_KEY);
        // 通信失敗時 signOut は { error } を返してセッションを消さないので、保存キーを直接消す
        const clearStoredSession = () => {
          try {
            for (const key of Object.keys(localStorage)) {
              if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
                localStorage.removeItem(key);
              }
            }
          } catch {
            // ignore
          }
          // 通信失敗時は SIGNED_OUT が通知されないので手動で更新する
          setSupabaseSession("signedOut");
        };
        supabase.auth
          .signOut({ scope: "local" })
          .then(({ error }) => {
            if (error) clearStoredSession();
          })
          .catch(clearStoredSession);
        setEntered(false);
      };

  return (
    <AuthContext.Provider value={{ entered, supabaseSession, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
