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
 * 上部ブロック（WorkDetailHeader）との間は親カラムの gap 48px だけ（罫線なし・Figma 888:3167）。
 * セクションは 1 カラム（見出し + 右罫線 → 本文、セクション間 80px。WorkSections 参照）。
 * 概要内の「背景／課題」等は markdown の `###`（見出し02・01 と同形）で表現される。
 * Timeline / Stakeholders は上部ブロックの「全画面」ボタン → モーダルで表示する（本文には描画しない）。
 */
const WorkDetailContent: FC<WorkDetailContentProps> = ({ work }) => {
  // 見出しも本文も空のセクション（旧データ）は捨てる。残すと空のセクション分の余白（80px）だけが出る（admin プレビューと同じ扱い）
  const sections = normalizeSections(work.sections).filter((s) => s.heading || s.md.trim());

  if (sections.length === 0) return null;

  return <WorkSections sections={sections} />;
};

export default WorkDetailContent;
