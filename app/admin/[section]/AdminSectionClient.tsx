"use client";

import { AdminLayout, type AdminSectionId } from "../AdminLayout";
import { SupabaseSessionGate } from "../SupabaseSessionGate";
import type { IconCatalog } from "../iconCatalogTypes";

/** 各設定セクション専用ページのクライアント本体（認証ゲート + AdminLayout） */
export default function AdminSectionClient({
  section,
  logoSlugs,
  iconCatalog,
}: {
  section: AdminSectionId;
  logoSlugs: string[];
  iconCatalog: IconCatalog;
}) {
  return (
    <SupabaseSessionGate>
      <AdminLayout section={section} logoSlugs={logoSlugs} iconCatalog={iconCatalog} />
    </SupabaseSessionGate>
  );
}
