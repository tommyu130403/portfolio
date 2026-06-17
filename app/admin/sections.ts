/**
 * admin の設定セクション定義。
 * サーバーコンポーネント（[section]/page.tsx の generateStaticParams）からも
 * 参照するため、"use client" を持つ AdminLayout とは別の純粋モジュールに置く。
 */
export const NAV_SECTIONS = [
  { id: "profile",          label: "Profile",          labelJa: "プロフィール・自己紹介" },
  { id: "career",           label: "Career",           labelJa: "経歴" },
  { id: "works",         label: "Works",            labelJa: "制作・企画" },
  { id: "skills-experience", label: "Skills Experience", labelJa: "スキルカルーセル" },
] as const;

export type AdminSectionId = (typeof NAV_SECTIONS)[number]["id"];
