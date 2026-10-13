"use client";

import { AdminLayout, type AdminSectionId } from "../AdminLayout";
import { SupabaseSessionGate } from "../SupabaseSessionGate";

/** 各設定セクション専用ページのクライアント本体（認証ゲート + AdminLayout） */
export default function AdminSectionClient({ section }: { section: AdminSectionId }) {
  return (
    <SupabaseSessionGate>
      <AdminLayout section={section} />
    </SupabaseSessionGate>
  );
}
