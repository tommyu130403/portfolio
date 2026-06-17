import { notFound } from "next/navigation";
import { NAV_SECTIONS, type AdminSectionId } from "../sections";
import AdminSectionClient from "./AdminSectionClient";

/**
 * 各設定セクションの専用ページ（/admin/profile・/admin/career・/admin/works・/admin/skills-experience）。
 * セクションは有限のため、静的エクスポート（output: export）向けに全 id を事前生成する。
 */
export function generateStaticParams() {
  return NAV_SECTIONS.map(({ id }) => ({ section: id }));
}

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!NAV_SECTIONS.some(({ id }) => id === section)) notFound();

  return <AdminSectionClient section={section as AdminSectionId} />;
}
