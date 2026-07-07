import type { FC } from "react";
import { WorkSections } from "./WorkMarkdown";
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
 * Timeline / Stakeholders は左パネルの「全画面」ボタン → モーダルで表示する（本文には描画しない）。
 */
const WorkDetailContent: FC<WorkDetailContentProps> = ({ work }) => {
  const sections = normalizeSections(work.sections);

  if (sections.length === 0) return null;

  return (
    <div className="w-full max-w-[1024px] py-20">
      <WorkSections
        sections={sections}
        headingVariant="markdown-h1"
        gapClass="gap-16"
        withDividers
      />
    </div>
  );
};

export default WorkDetailContent;
