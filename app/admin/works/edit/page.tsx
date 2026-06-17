"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WorkEditor from "./WorkEditor";
import { OwnerGate } from "@/components/OwnerGate";
import { AuthGate } from "@/components/AuthGate";

/**
 * Work 1件の全画面編集ページ（/admin/works/edit?id=xxx、id 省略 or "new" で新規作成）。
 * 静的エクスポート（output: export）では動的セグメントに generateStaticParams が必須となり
 * 任意の Work ID を事前生成できないため、ルートは静的のままクエリ文字列で id を受け取る。
 */
function AdminWorkEditInner() {
  const id = useSearchParams().get("id") ?? "new";
  return (
    <AuthGate>
      <OwnerGate>
        <WorkEditor workId={id} />
      </OwnerGate>
    </AuthGate>
  );
}

export default function AdminWorkEditPage() {
  // useSearchParams() は静的プリレンダー時に Suspense 境界を要求する
  return (
    <Suspense fallback={null}>
      <AdminWorkEditInner />
    </Suspense>
  );
}
