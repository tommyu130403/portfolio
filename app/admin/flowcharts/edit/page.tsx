"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { OwnerGate } from "@/components/OwnerGate";
import FlowchartEditor from "./FlowchartEditor";

function AdminFlowchartEditInner() {
  const id = useSearchParams().get("id") ?? "new";
  return (
    <AuthGate>
      <OwnerGate>
        <FlowchartEditor flowchartId={id} />
      </OwnerGate>
    </AuthGate>
  );
}

export default function AdminFlowchartEditPage() {
  return (
    <Suspense fallback={null}>
      <AdminFlowchartEditInner />
    </Suspense>
  );
}
