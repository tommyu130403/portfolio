"use client";

import { AdminLayout } from "./AdminLayout";
import { OwnerGate } from "@/components/OwnerGate";
import { AuthGate } from "@/components/AuthGate";

export default function AdminPage() {
  return (
    <AuthGate>
      <OwnerGate>
        <AdminLayout />
      </OwnerGate>
    </AuthGate>
  );
}
