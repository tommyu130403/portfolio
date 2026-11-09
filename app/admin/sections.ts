/**
 * admin の設定セクション定義。
 * サーバーコンポーネント（[section]/page.tsx の generateStaticParams）からも
 * 参照するため、"use client" を持つ AdminLayout とは別の純粋モジュールに置く。
 */
export const NAV_GROUPS = [
  { id: "content", label: "ポートフォリオ内容" },
  { id: "settings", label: "設定・データ" },
] as const;

type NavGroupId = (typeof NAV_GROUPS)[number]["id"];

export const NAV_SECTIONS = [
  { id: "profile",           label: "Introduction", labelJa: "自己紹介",     group: "content" },
  { id: "career",            label: "Career",       labelJa: "経歴",         group: "content" },
  { id: "works",             label: "Works",        labelJa: "制作・企画",   group: "content" },
  { id: "skills-experience", label: "Skills",       labelJa: "スキル",       group: "content" },
  { id: "masters",           label: "Masters",      labelJa: "マスタ管理",   group: "settings" },
  { id: "guests",            label: "Guests",       labelJa: "ゲストID",     group: "settings" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  labelJa: string;
  group: NavGroupId;
}>;

/** admin 外のページへのリンク（各グループのセクションの後に表示する）。 */
export const NAV_EXTRA_LINKS = [
  { href: "/styleguide", label: "Style Guide", labelJa: "スタイルガイド", group: "settings" },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  labelJa: string;
  group: NavGroupId;
}>;

export type AdminSectionId = (typeof NAV_SECTIONS)[number]["id"];
