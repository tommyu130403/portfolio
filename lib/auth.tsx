"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export type SupabaseSessionState = "loading" | "signedOut" | "signedIn";
export type PortfolioAccessRole = "loading" | "owner" | "reader" | "expired" | "denied" | "error";

type AuthContextValue = {
  supabaseSession: SupabaseSessionState;
  accessRole: PortfolioAccessRole;
  logout: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function keepOnError(prev: PortfolioAccessRole): PortfolioAccessRole {
  return prev === "owner" || prev === "reader" ? prev : "error";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSessionState>("loading");
  const [accessRole, setAccessRole] = useState<PortfolioAccessRole>("loading");
  const [authEpoch, setAuthEpoch] = useState(0);
  const sessionUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let authEventSeen = false;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active || authEventSeen) return;
        const signedIn = !error && !!data.session;
        sessionUserId.current = signedIn ? data.session!.user.id : null;
        setSupabaseSession(signedIn ? "signedIn" : "signedOut");
        if (!signedIn) setAccessRole("denied");
      })
      .catch(() => {
        if (active && !authEventSeen) {
          sessionUserId.current = null;
          setSupabaseSession("signedOut");
          setAccessRole("denied");
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      authEventSeen = true;
      const userId = session?.user.id ?? null;
      if (userId !== sessionUserId.current) {
        setAccessRole(userId ? "loading" : "denied");
        setAuthEpoch((epoch) => epoch + 1);
      } else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setAuthEpoch((epoch) => epoch + 1);
      }
      sessionUserId.current = userId;
      setSupabaseSession(session ? "signedIn" : "signedOut");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (supabaseSession !== "signedIn") return;
    let active = true;
    // The generated DB types are refreshed only after the migration is applied.
    const client = supabase as unknown as {
      rpc: (name: "portfolio_access_role") => Promise<{
        data: "owner" | "reader" | "expired" | "denied" | null;
        error: { message: string } | null;
      }>;
    };
    client.rpc("portfolio_access_role")
      .then(({ data, error }) => {
        // トークン更新時の取り直しが一時的に失敗しても、閲覧中の画面を消さない
        // (データ自体は RLS が守るので、直前の owner / reader を保つ)。
        if (active) setAccessRole((prev) => (data ? data : keepOnError(prev)));
        if (active && error) console.error("portfolio_access_role failed:", error.message);
      })
      .catch(() => {
        if (active) setAccessRole(keepOnError);
      });
    return () => { active = false; };
  }, [supabaseSession, authEpoch]);

  const logout = async (): Promise<string | null> => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    return error?.message ?? null;
  };

  return (
    <AuthContext.Provider value={{ supabaseSession, accessRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
