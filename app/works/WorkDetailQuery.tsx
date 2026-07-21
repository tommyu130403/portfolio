"use client";

import { useSearchParams } from "next/navigation";
import WorkDetailClient from "@/components/WorkDetailClient";
import { AuthGate } from "@/components/AuthGate";

/**
 * クエリ文字列（?id=xxx）から Work ID を読み取り、認証ゲート越しに詳細を描画する。
 * useSearchParams() を使うため Client Component として分離し、
 * page.tsx（Server Component）側で metadata を export できるようにしている。
 */
export default function WorkDetailQuery() {
  const id = useSearchParams().get("id");
  return (
    <AuthGate>
      <WorkDetailClient id={id} />
    </AuthGate>
  );
}
