import type { FC } from "react";
import { WorkSections } from "./WorkMarkdown";
import { parseTimeline, parseStakeholders, WorkProcessChart, WorkStakeholderDiagram } from "./WorkViz";
import { normalizeSections } from "@/lib/work-content";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

type WorkDetailContentProps = {
  work: Work;
};

/**
 * Works 詳細・右カラム（本文）。
 * セクション（見出し01 24px + 本文 markdown）を gap-16 で並べ、セクション間に横罫線を挿入する。
 * 概要内の「背景／課題」等は markdown の `###`（見出し02・mint）で表現される。
 * セクションが空でも timeline/stakeholders データがあれば viz を直接描画する。
 */
const WorkDetailContent: FC<WorkDetailContentProps> = ({ work }) => {
  const sections = normalizeSections(work.sections);
  // ::: timeline / ::: stakeholders ディレクティブが参照する構造化データ
  const timeline = parseTimeline(work.timeline);
  const stakeholders = parseStakeholders(work.stakeholders);
  const viz = { timeline, stakeholders };

  // セクションも viz も無ければ右カラム自体を省略
  if (sections.length === 0 && !timeline && !stakeholders) return null;

  return (
    <div className="w-full max-w-[1024px] py-20">
      {sections.length > 0 ? (
        <WorkSections
          sections={sections}
          viz={viz}
          headingVariant="markdown-h1"
          gapClass="gap-16"
          withDividers
        />
      ) : (
        // 本文セクションが無いが構造化データはある場合のフォールバック
        <div className="flex flex-col gap-16">
          {timeline && <WorkProcessChart data={timeline} />}
          {stakeholders && <WorkStakeholderDiagram data={stakeholders} />}
        </div>
      )}
    </div>
  );
};

export default WorkDetailContent;
