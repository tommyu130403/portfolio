import type { Metadata } from "next";
import { Suspense } from "react";
import WorkDetailQuery from "./WorkDetailQuery";

/**
 * Works 1件の全画面詳細ページ（/works?id=xxx）。
 * 静的エクスポート（output: export）では動的セグメントに generateStaticParams が必須となり
 * 任意の Work ID を事前生成できないため、ルートは静的のままクエリ文字列で id を受け取る
 * （/admin/works/edit と同じ方針）。
 *
 * このファイルは Server Component として metadata を export する。
 * ?id= 個別の OGP は静的エクスポート + クエリ方式では生成できないため、
 * ページ共通のタイトルのみを付与する。
 */
export const metadata: Metadata = {
  title: "Works",
};

export default function WorkDetailPage() {
  // useSearchParams() は静的プリレンダー時に Suspense 境界を要求する
  return (
    <Suspense fallback={null}>
      <WorkDetailQuery />
    </Suspense>
  );
}
