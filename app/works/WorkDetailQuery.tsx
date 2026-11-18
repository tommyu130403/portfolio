"use client";

import { useSearchParams } from "next/navigation";
import WorkDetailClient from "@/components/WorkDetailClient";
import { AuthGate } from "@/components/AuthGate";
import { WorkLayoutProvider } from "@/components/WorkLayoutContext";
import { parseLayoutParam } from "@/lib/work-detail-layout";

/**
 * クエリ文字列（?id=xxx）から Work ID を読み取り、認証ゲート越しに詳細を描画する。
 * useSearchParams() を使うため Client Component として分離し、
 * page.tsx（Server Component）側で metadata を export できるようにしている。
 */
export default function WorkDetailQuery() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const layout = parseLayoutParam(searchParams.get("layout"));
  const tree = (
    <AuthGate>
      <WorkDetailClient id={id} />
    </AuthGate>
  );
  return layout ? <WorkLayoutProvider layout={layout}>{tree}</WorkLayoutProvider> : tree;
}
