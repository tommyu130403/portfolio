"use client";

import { AdminLayout, type AdminSectionId } from "../AdminLayout";
import { OwnerGate } from "@/components/OwnerGate";
import { AuthGate } from "@/components/AuthGate";

/** 各設定セクション専用ページのクライアント本体（認証ゲート + AdminLayout） */
export default function AdminSectionClient({ section }: { section: AdminSectionId }) {
  return (
    <AuthGate>
      <OwnerGate>
        <AdminLayout section={section} />
      </OwnerGate>
    </AuthGate>
  );
}
