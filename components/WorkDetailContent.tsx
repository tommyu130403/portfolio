import type { FC } from "react";
import { WorkSections } from "./WorkMarkdown";
import { normalizeSections } from "@/lib/work-content";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

type WorkDetailContentProps = {
  work: Work;
};

/**
 * Works 詳細・本文（800px カラム）。
 * 上部ブロック（WorkDetailHeader）との間に横罫線を1本挟み、
 * セクション（見出し01 24px + 本文 markdown）を gap-12 で並べる（セクション間に罫線は無い）。
 * 概要内の「背景／課題」等は markdown の `###`（見出し02・mint）で表現される。
 * Timeline / Stakeholders は上部ブロックの「全画面」ボタン → モーダルで表示する（本文には描画しない）。
 */
const WorkDetailContent: FC<WorkDetailContentProps> = ({ work }) => {
  const sections = normalizeSections(work.sections);

  if (sections.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-12">
      <div className="h-px w-full bg-border" aria-hidden />
      <WorkSections sections={sections} headingVariant="markdown-h1" gapClass="gap-12" />
    </div>
  );
};

export default WorkDetailContent;
