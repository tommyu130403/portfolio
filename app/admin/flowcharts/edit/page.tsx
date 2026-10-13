"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { OwnerGate } from "@/components/OwnerGate";
import { SupabaseSessionGate } from "../../SupabaseSessionGate";
import FlowchartEditor from "./FlowchartEditor";

function AdminFlowchartEditInner() {
  const id = useSearchParams().get("id") ?? "new";
  return (
    <AuthGate>
      <OwnerGate>
        <SupabaseSessionGate>
          <FlowchartEditor flowchartId={id} />
        </SupabaseSessionGate>
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
