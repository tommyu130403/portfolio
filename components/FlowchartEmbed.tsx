"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchFlowchart, type FlowchartData } from "@/lib/flowchart";
import Modal from "./Modal";

const FlowchartView = dynamic(() => import("./FlowchartView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/[0.03]" />,
});

export default function FlowchartEmbed({ id }: { id: string }) {
  const [result, setResult] = useState<{
    id: string;
    data: FlowchartData | null;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchFlowchart(id).then((next) => {
      if (!active) return;
      setResult({ id, data: next });
    });
    return () => {
      active = false;
    };
  }, [id]);

  const loading = result?.id !== id;
  const data = result?.id === id ? result.data : null;

  if (loading) {
    return (
      <div
        className="mb-4 h-[clamp(260px,50vh,420px)] animate-pulse rounded-[14px] bg-[#1a1a1a] p-2"
        aria-label="フローチャートを読み込み中"
      >
        <div className="h-full rounded-[10px] bg-white/[0.03]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mb-4 flex h-[clamp(260px,50vh,420px)] items-center justify-center rounded-[14px] border border-dashed border-border-light bg-[#1a1a1a] p-6">
        <p className="text-[13px] tracking-[0.39px] text-fg-muted">
          図が見つかりません
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative mb-4 h-[clamp(260px,50vh,420px)] max-w-full overflow-hidden rounded-[14px] bg-[#1a1a1a] p-2">
        <FlowchartView data={data} onRequestExpand={() => setExpanded(true)} />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border-light bg-[#0a0a0a]/90 text-white transition-colors hover:border-main-100 hover:text-main-100"
          aria-label="フローチャートを拡大"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M6 3H3v3m7-3h3v3M6 13H3v-3m7 3h3v-3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {expanded && (
        <Modal onClose={() => setExpanded(false)}>
          <div className="h-[min(75vh,720px)] min-h-[400px] w-full p-2 sm:p-4">
            <FlowchartView data={data} />
          </div>
        </Modal>
      )}
    </>
  );
}
