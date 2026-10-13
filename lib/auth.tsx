"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type AuthRole = "guest" | "owner";
type AuthState = { role: AuthRole; expires: number } | null;

const SESSION_KEY = "portfolio_auth";
const SESSION_MS  = 24 * 60 * 60 * 1000;
const IS_DEV      = process.env.NODE_ENV === "development";

type AuthContextValue = {
  role: AuthRole | null;
  login:  (role: AuthRole) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AuthRole | null>(IS_DEV ? "owner" : null);

  useEffect(() => {
    if (IS_DEV) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as AuthState;
      if (state && state.expires > Date.now()) {
        setRole(state.role);
      }
    } catch {
      // ignore
    }
  }, []);

  const login = IS_DEV
    ? () => {}
    : (newRole: AuthRole) => {
        const state: AuthState = { role: newRole, expires: Date.now() + SESSION_MS };
        localStorage.setItem(SESSION_KEY, JSON.stringify(state));
        setRole(newRole);
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
        };
        supabase.auth
          .signOut({ scope: "local" })
          .then(({ error }) => {
            if (error) clearStoredSession();
          })
          .catch(clearStoredSession);
        setRole(null);
      };

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
