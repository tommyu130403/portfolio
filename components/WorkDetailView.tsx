"use client";

import { useMemo, type FC, type RefObject } from "react";
import type { WorkTocItem } from "./WorkToc";
import WorkDetailHeader, { parseStakeholderBreakdown, type WorkDetailEditRegion, type WorkToolItem } from "./WorkDetailHeader";
import WorkDetailContent, { workSectionsOf } from "./WorkDetailContent";
import WorkHero from "./WorkHero";
import WorkTocColumn from "./WorkTocColumn";
import { useWorkLayout } from "./WorkLayoutContext";
import { WorkBodyProvider, type WorkBodyData } from "./WorkBodyContext";
import { parseStakeholders } from "./WorkViz";
import { renderInline } from "./WorkInline";
import { RelatedWorks } from "./WorkFigureBlocks";
import { extractHoisted } from "@/lib/work-sections";
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

  // v2 だけ、本文の `::: summary` の lead をヒーローへ、`::: related` をページ末尾へ移す（課題・打ち手・結果の 3 枚は本文の書いた場所のまま。v1 は本文のまま。個数・順序は変えない）
  const hoisted = useMemo(() => (layout === "v2" ? extractHoisted(workSectionsOf(work)) : null), [layout, work]);

  // 本文の `::: team` が読む関係者データ（公開ページ・admin プレビューとも、ここで作品の行から渡す）
  const body = useMemo<WorkBodyData>(
    () => ({
      stakeholders: parseStakeholders(work.stakeholders),
      breakdown: parseStakeholderBreakdown(work.stakeholder_breakdown),
      // v2 ではヒーローに出す lead と同じ文を、本文の要約ブロックで繰り返さない
      heroLead: hoisted?.summary?.lead || undefined,
      onEditStakeholders: onEdit ? () => onEdit("stakeholders") : undefined,
    }),
    [work.stakeholders, work.stakeholder_breakdown, hoisted, onEdit],
  );

  const detail = <WorkDetailContent work={work} onEditSection={onEditSection} sections={hoisted?.sections} />;
  const content = contentRef ? <div ref={contentRef}>{detail}</div> : detail;

  if (layout === "v1") {
    return (
      <WorkBodyProvider value={body}>
        <WorkDetailHeader
          work={work}
          contents={contents}
          tools={tools}
          screenshots={screenshots}
          categoryHue={categoryHue}
          onEdit={onEdit}
        />
        {content}
      </WorkBodyProvider>
    );
  }

  const summary = hoisted?.summary ?? null;
  const related = hoisted?.related ?? null;
  const hasSections = (hoisted?.sections.length ?? 0) > 0;
  return (
    <WorkBodyProvider value={body}>
      <WorkHero
        work={work}
        contents={contents}
        screenshots={screenshots}
        categoryHue={categoryHue}
        onEdit={onEdit}
        lead={summary?.lead ? renderInline(summary.lead, "hoist-lead") : undefined}
      />
      {/* 冒頭(MV)と本文の間は、親の gap-12 に足して 72px / md 以上 96px(本文のセクション間と同じ)にする */}
      <div className="mt-6 md:mt-12 xl:flex xl:items-start xl:gap-12">
        {toc && (
          <div className="hidden shrink-0 xl:block xl:self-stretch">
            <WorkTocColumn items={toc.items} activeIndex={toc.activeIndex} onSelect={toc.onSelect} />
          </div>
        )}
        <div className="mx-auto min-w-0 max-w-main flex-1 xl:mx-0">
          {content}
          {related ? <RelatedWorks data={related} hoisted className={hasSections ? "mt-24" : ""} /> : null}
        </div>
      </div>
    </WorkBodyProvider>
  );
};

export default WorkDetailView;
