"use client";

import { createContext, useContext, type ReactNode } from "react";
import { WORK_DETAIL_LAYOUT, type WorkDetailLayout } from "@/lib/work-detail-layout";

const WorkLayoutContext = createContext<WorkDetailLayout | null>(null);

export function WorkLayoutProvider({
  layout,
  children,
}: {
  layout: WorkDetailLayout | null;
  children: ReactNode;
}) {
  return <WorkLayoutContext.Provider value={layout}>{children}</WorkLayoutContext.Provider>;
}

export function useWorkLayout(): WorkDetailLayout {
  return useContext(WorkLayoutContext) ?? WORK_DETAIL_LAYOUT;
}
