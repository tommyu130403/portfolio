import { Fragment, type FC } from "react";
import Headline from "./Headline";
import { MarkdownBody } from "./WorkMarkdown";
import { parseTimeline, parseStakeholders } from "./WorkViz";
import { normalizeSections } from "@/lib/work-content";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

type WorkDetailContentProps = {
  work: Work;
};

/**
 * Works 詳細・右カラム（本文）。
 * セクション（見出し01 24px + 本文 markdown）を gap-64 で並べ、セクション間に横罫線を挿入する。
 * 概要内の「背景／課題」等は markdown の `###`（見出し02・mint）で表現される。
 */
const WorkDetailContent: FC<WorkDetailContentProps> = ({ work }) => {
  const sections = normalizeSections(work.sections);
  // ::: timeline / ::: stakeholders ディレクティブが参照する構造化データ
  const viz = { timeline: parseTimeline(work.timeline), stakeholders: parseStakeholders(work.stakeholders) };

  if (sections.length === 0) return null;

  return (
    <div className="flex w-full max-w-[1024px] flex-col gap-16 py-20">
      {sections.map((section, i) => (
        <Fragment key={i}>
          {i > 0 && <div className="h-px w-full bg-system-800" aria-hidden />}
          <section className="flex w-full flex-col gap-10">
            {section.heading && <Headline title={section.heading} variant="markdown-h1" />}
            <MarkdownBody md={section.md} viz={viz} />
          </section>
        </Fragment>
      ))}
    </div>
  );
};

export default WorkDetailContent;
