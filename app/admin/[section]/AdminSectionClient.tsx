"use client";

import { AdminLayout, type AdminSectionId } from "../AdminLayout";
import { OwnerGate } from "@/components/OwnerGate";
import { AuthGate } from "@/components/AuthGate";
import { SupabaseSessionGate } from "../SupabaseSessionGate";

/** 各設定セクション専用ページのクライアント本体（認証ゲート + AdminLayout） */
export default function AdminSectionClient({ section }: { section: AdminSectionId }) {
  return (
    <AuthGate>
      <OwnerGate>
        <SupabaseSessionGate>
          <AdminLayout section={section} />
        </SupabaseSessionGate>
      </OwnerGate>
    </AuthGate>
  );
}
