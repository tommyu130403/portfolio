"use client";

import { AdminLayout } from "./AdminLayout";

export default function AdminPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center">
        <div className="text-center px-8">
          <p className="text-[12px] tracking-[0.6px] text-[#48f4be] mb-2">Portfolio</p>
          <p className="text-white text-[24px] font-semibold mb-4">このページは利用できません</p>
          <p className="text-white/40 text-[14px]">本番環境では管理画面にアクセスできません。</p>
          <a href="/" className="mt-8 inline-block text-[14px] text-[#48f4be] underline">
            トップページへ戻る
          </a>
        </div>
      </div>
    );
  }

  return <AdminLayout />;
}
