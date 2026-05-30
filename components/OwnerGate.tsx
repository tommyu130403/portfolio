"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export function OwnerGate({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return <div className="min-h-screen bg-[#212121]" />;

  if (role === "owner") return <>{children}</>;

  return <Redirect />;
}

function Redirect() {
  useEffect(() => {
    window.location.replace(process.env.NEXT_PUBLIC_BASE_PATH || "/");
  }, []);
  return <div className="min-h-screen bg-[#212121]" />;
}
