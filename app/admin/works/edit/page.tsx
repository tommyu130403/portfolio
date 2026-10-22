import { Suspense } from "react";
import { getIconCatalog } from "../../iconCatalog";
import WorkEditClient from "./WorkEditClient";

/**
 * Work 1件の全画面編集ページ（/admin/works/edit?id=xxx、id 省略 or "new" で新規作成）。
 * 静的エクスポート（output: export）では動的セグメントに generateStaticParams が必須となり
 * 任意の Work ID を事前生成できないため、ルートは静的のままクエリ文字列で id を受け取る。
 */
export default function AdminWorkEditPage() {
  const iconCatalog = getIconCatalog();
  // useSearchParams() は静的プリレンダー時に Suspense 境界を要求する
  return (
    <Suspense fallback={null}>
      <WorkEditClient iconCatalog={iconCatalog} />
    </Suspense>
  );
}
