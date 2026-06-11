"use client";

import { use } from "react";
import WorkEditor from "./WorkEditor";
import { OwnerGate } from "@/components/OwnerGate";
import { AuthGate } from "@/components/AuthGate";

/** Work 1件の全画面編集ページ（/admin/works/[id]、id="new" で新規作成） */
export default function AdminWorkEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGate>
      <OwnerGate>
        <WorkEditor workId={id} />
      </OwnerGate>
    </AuthGate>
  );
}
