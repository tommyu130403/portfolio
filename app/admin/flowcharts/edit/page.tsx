"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SupabaseSessionGate } from "../../SupabaseSessionGate";
import FlowchartEditor from "./FlowchartEditor";

function AdminFlowchartEditInner() {
  const id = useSearchParams().get("id") ?? "new";
  return (
    <SupabaseSessionGate>
      <FlowchartEditor flowchartId={id} />
    </SupabaseSessionGate>
  );
}

export default function AdminFlowchartEditPage() {
  return (
    <Suspense fallback={null}>
      <AdminFlowchartEditInner />
    </Suspense>
  );
}
