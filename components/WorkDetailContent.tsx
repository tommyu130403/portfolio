import type { FC } from "react";
import { WorkSections, type WorkSection } from "./WorkMarkdown";
import { normalizeSections } from "@/lib/work-content";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

type WorkDetailContentProps = {
  work: Work;
  /** admin プレビュー専用。見出しの編集ボタンを出す（引数 = 空セクションを除いた並びでの何番目か） */
  onEditSection?: (index: number) => void;
  /** 渡すと work.sections の代わりにこの並びを描く（v2 で要約・関連をページ上下へ移したあとの並び。個数と順序は元と同じ） */
  sections?: WorkSection[];
};

/** 公開ページ・admin プレビュー共通の本文の並び。見出しも本文も空のセクション（旧データ）は捨てる */
export const workSectionsOf = (work: Work): WorkSection[] => normalizeSections(work.sections).filter((s) => s.heading || s.md.trim());

/**
 * Works 詳細・本文（800px カラム）。
 * 上部ブロック（WorkDetailHeader）との間は親カラムの gap 48px だけ（罫線なし・Figma 888:3167）。
 * セクションは 1 カラム（見出し + 右罫線 → 本文、セクション間 80px。WorkSections 参照）。
 * 概要内の「背景／課題」等は markdown の `###`（見出し02・01 と同形）で表現される。
 * Timeline / Stakeholders は上部ブロックの「全画面」ボタン → モーダルで表示する（本文には描画しない）。
 */
const WorkDetailContent: FC<WorkDetailContentProps> = ({ work, onEditSection, sections: given }) => {
  // 見出しも本文も空のセクション（旧データ）は捨てる。残すと空のセクション分の余白（80px）だけが出る（admin プレビューと同じ扱い）
  const sections = given ?? workSectionsOf(work);

  if (sections.length === 0) return null;

  return <WorkSections sections={sections} onEditSection={onEditSection} />;
};

export default WorkDetailContent;
