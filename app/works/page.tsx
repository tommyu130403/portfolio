"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WorkDetailClient from "@/components/WorkDetailClient";
import { AuthGate } from "@/components/AuthGate";

/**
 * Works 1件の全画面詳細ページ（/works?id=xxx）。
 * 静的エクスポート（output: export）では動的セグメントに generateStaticParams が必須となり
 * 任意の Work ID を事前生成できないため、ルートは静的のままクエリ文字列で id を受け取る
 * （/admin/works/edit と同じ方針）。
 */
function WorkDetailInner() {
  const id = useSearchParams().get("id");
  return (
    <AuthGate>
      <WorkDetailClient id={id} />
    </AuthGate>
  );
}

export default function WorkDetailPage() {
  // useSearchParams() は静的プリレンダー時に Suspense 境界を要求する
  return (
    <Suspense fallback={null}>
      <WorkDetailInner />
    </Suspense>
  );
}
