"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AdminLayout, NAV_SECTIONS, type AdminSectionId } from "../AdminLayout";
import { OwnerGate } from "@/components/OwnerGate";
import { AuthGate } from "@/components/AuthGate";

/** 各設定セクションの専用ページ（/admin/profile・/admin/career・/admin/works・/admin/skills-experience） */
export default function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  if (!NAV_SECTIONS.some(({ id }) => id === section)) notFound();

  return (
    <AuthGate>
      <OwnerGate>
        <AdminLayout section={section as AdminSectionId} />
      </OwnerGate>
    </AuthGate>
  );
}
