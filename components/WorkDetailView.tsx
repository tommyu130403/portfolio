"use client";

import type { FC, RefObject } from "react";
import type { WorkTocItem } from "./WorkToc";
import WorkDetailHeader, { type WorkDetailEditRegion, type WorkToolItem } from "./WorkDetailHeader";
import WorkDetailContent from "./WorkDetailContent";
import WorkHero from "./WorkHero";
import WorkSummaryStrip from "./WorkSummaryStrip";
import WorkTocColumn from "./WorkTocColumn";
import { useWorkLayout } from "./WorkLayoutContext";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

type WorkDetailViewProps = {
  work: Work;
  contents: string[];
  tools: WorkToolItem[];
  screenshots: string[];
  categoryHue?: number | null;
  /** admin プレビュー専用。上部ブロックの編集ボタン */
  onEdit?: (region: WorkDetailEditRegion) => void;
  /** admin プレビュー専用。見出しの編集ボタン */
  onEditSection?: (index: number) => void;
  /** 本文を包む要素に付ける ref（目次が見出しを探す範囲）。渡さなければ包まない */
  contentRef?: RefObject<HTMLDivElement | null>;
  /** v2 の PC で本文の左に出す目次カラムのデータ。渡したときだけカラムを出す */
  toc?: { items: WorkTocItem[]; activeIndex: number; onSelect: (index: number) => void };
};

/**
 * 作品詳細の上部ブロック + 本文を、レイアウト（v1 / v2）に応じて組み立てる。
 * v1 は従来どおり Header + 本文を余計な要素なしで返す（親の gap-12 と目次の ref がそのまま効く）。
 */
const WorkDetailView: FC<WorkDetailViewProps> = ({
  work,
  contents,
  tools,
  screenshots,
  categoryHue,
  onEdit,
  onEditSection,
  contentRef,
  toc,
}) => {
  const layout = useWorkLayout();

  const content = contentRef ? (
    <div ref={contentRef}>
      <WorkDetailContent work={work} onEditSection={onEditSection} />
    </div>
  ) : (
    <WorkDetailContent work={work} onEditSection={onEditSection} />
  );

  if (layout === "v1") {
    return (
      <>
        <WorkDetailHeader
          work={work}
          contents={contents}
          tools={tools}
          screenshots={screenshots}
          categoryHue={categoryHue}
          onEdit={onEdit}
        />
        {content}
      </>
    );
  }

  return (
    <>
      <WorkHero work={work} contents={contents} screenshots={screenshots} categoryHue={categoryHue} onEdit={onEdit} />
      <WorkSummaryStrip work={work} tools={tools} onEdit={onEdit} />
      <div className="xl:flex xl:items-start xl:gap-12">
        {toc && (
          <div className="hidden shrink-0 xl:block xl:self-stretch">
            <WorkTocColumn items={toc.items} activeIndex={toc.activeIndex} onSelect={toc.onSelect} />
          </div>
        )}
        <div className="min-w-0 max-w-main flex-1">{content}</div>
      </div>
    </>
  );
};

export default WorkDetailView;
