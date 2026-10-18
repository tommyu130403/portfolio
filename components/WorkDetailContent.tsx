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
 * セクションは Figma 787:9916 の 2 列（本文の容器幅 720px 以上: 左に見出し 160px・右に本文 markdown、未満は縦積み）で、
 * セクション間にも罫線を挟み、罫線の上下は gap-12（48px）。
 * 概要内の「背景／課題」等は markdown の `###`（見出し02・01 と同形）で表現される。
 * Timeline / Stakeholders は上部ブロックの「全画面」ボタン → モーダルで表示する（本文には描画しない）。
 */
const WorkDetailContent: FC<WorkDetailContentProps> = ({ work }) => {
  // 見出しも本文も空のセクション（旧データ）は捨てる。残すと罫線が二重に並ぶ（admin プレビューと同じ扱い）
  const sections = normalizeSections(work.sections).filter((s) => s.heading || s.md.trim());

  if (sections.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-12">
      <div className="h-px w-full bg-border" aria-hidden />
      <WorkSections sections={sections} />
    </div>
  );
};

export default WorkDetailContent;
