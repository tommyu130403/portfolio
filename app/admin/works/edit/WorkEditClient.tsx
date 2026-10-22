"use client";

import { useSearchParams } from "next/navigation";
import WorkEditor from "./WorkEditor";
import { SupabaseSessionGate } from "../../SupabaseSessionGate";
import type { IconCatalog } from "../../iconCatalogTypes";

/** Work 1件の編集画面のクライアント本体（クエリ文字列の id を読む + 認証ゲート） */
export default function WorkEditClient({ iconCatalog }: { iconCatalog: IconCatalog }) {
  const id = useSearchParams().get("id") ?? "new";
  return (
    <SupabaseSessionGate>
      <WorkEditor workId={id} iconCatalog={iconCatalog} />
    </SupabaseSessionGate>
  );
}
