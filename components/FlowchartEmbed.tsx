"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useEffect, useState } from "react";
import { fetchFlowchartRecord, type FlowchartRecord } from "@/lib/flowchart";
import { BUTTON_FUNCTION_ICON } from "@/lib/figma-button-variants";
import { ButtonFunction } from "./ButtonFunction";
import Modal from "./Modal";

const FlowchartView = dynamic(() => import("./FlowchartView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/[0.03]" />,
});

/** 作品本文内のフローチャート id → Fig. 番号（1 始まり）。未提供なら番号なし */
export const FlowchartFigureContext = createContext<ReadonlyMap<
  string,
  number
> | null>(null);

export default function FlowchartEmbed({ id }: { id: string }) {
  const [result, setResult] = useState<{
    id: string;
    record: FlowchartRecord | null;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const figureNumbers = useContext(FlowchartFigureContext);

  useEffect(() => {
    let active = true;
    fetchFlowchartRecord(id).then((next) => {
      if (!active) return;
      setResult({ id, record: next });
    });
    return () => {
      active = false;
    };
  }, [id]);

  const loading = result?.id !== id;
  const record = result?.id === id ? result.record : null;

  if (loading) {
    return (
      <div
        className="mb-4 h-[clamp(260px,50vh,420px)] animate-pulse rounded-[14px] border border-border bg-[#1a1a1a] p-2"
        aria-label="フローチャートを読み込み中"
      >
        <div className="h-full rounded-[10px] bg-white/[0.03]" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mb-4 flex h-[clamp(260px,50vh,420px)] items-center justify-center rounded-[14px] border border-dashed border-border-light bg-[#1a1a1a] p-6">
        <p className="text-[13px] tracking-[0.39px] text-fg-muted">
          図が見つかりません
        </p>
      </div>
    );
  }

  const { data } = record;
  const title = record.title.trim();
  const figureNumber = figureNumbers?.get(id);

  return (
    <figure className="mb-4 flex flex-col gap-3">
      <div className="relative h-[clamp(260px,50vh,420px)] max-w-full overflow-hidden rounded-[14px] border border-border bg-[#1a1a1a] p-2">
        <FlowchartView data={data} onRequestExpand={() => setExpanded(true)} />
        <div className="absolute right-4 top-4 z-10">
          <ButtonFunction
            border="on"
            aria-label="フローチャートを拡大"
            onClick={() => setExpanded(true)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className={BUTTON_FUNCTION_ICON}
              aria-hidden
            >
              <path
                d="M6 3H3v3m7-3h3v3M6 13H3v-3m7 3h3v-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ButtonFunction>
        </div>
      </div>

      {title && (
        <figcaption className="flex gap-3 text-[13px] tracking-[0.39px] text-fg-muted">
          {figureNumber !== undefined && (
            <span className="font-mono text-[12px] text-system-700">
              Fig.{String(figureNumber).padStart(2, "0")}
            </span>
          )}
          {title}
        </figcaption>
      )}

      {expanded && (
        <Modal onClose={() => setExpanded(false)}>
          <div className="h-[min(75vh,720px)] min-h-[400px] w-full p-2 sm:p-4">
            <FlowchartView data={data} />
          </div>
        </Modal>
      )}
    </figure>
  );
}
