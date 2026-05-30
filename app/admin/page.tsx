"use client";

import { AdminLayout } from "./AdminLayout";
import { OwnerGate } from "@/components/OwnerGate";

export default function AdminPage() {
  if (process.env.NODE_ENV === "production") {
    // AdminLayout (and its "use server" actions) is excluded from the production
    // bundle via dead-code elimination. OwnerGate still guards access by redirecting non-owners.
    return <OwnerGate><div className="min-h-screen bg-[#212121]" /></OwnerGate>;
  }

  return (
    <OwnerGate>
      <AdminLayout />
    </OwnerGate>
  );
}
