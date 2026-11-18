"use client";

import { type FC, type ReactNode, useMemo, useState } from "react";
import WorkVizModal from "./WorkVizModal";
import { VizButton, parseStakeholderBreakdown, type WorkDetailEditRegion, type WorkToolItem } from "./WorkDetailHeader";
import { EditButton } from "./WorkMarkdown";
import { parseTimeline, parseStakeholders } from "./WorkViz";
import { periodFromRow } from "@/lib/timeline-scale";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

const MAX_TOOLS = 4;

/** 帯の列数（コンテナ幅で決める）。項目数ごとに静的なクラスを持つ（Tailwind が生成できるよう文字列は固定） */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 @min-[480px]:grid-cols-2",
  3: "grid-cols-1 @min-[480px]:grid-cols-2 @min-[880px]:grid-cols-3",
  4: "grid-cols-1 @min-[480px]:grid-cols-2 @min-[880px]:grid-cols-4",
};
/** 3 項目の 2 列表示では最後の 1 つが行を埋める（地色の穴を作らない） */
const LAST_OF_THREE = "@min-[480px]:col-span-2 @min-[880px]:col-span-1";

const Cell: FC<{ label: string; children: ReactNode; action?: ReactNode; className?: string }> = ({ label, children, action, className = "" }) => (
  <div className={`flex min-w-0 flex-col gap-1 bg-surface px-6 py-4 ${className}`}>
    <p className="text-body-03-jp text-fg-muted">{label}</p>
    <div className="flex min-w-0 items-center gap-2">
      <p className="min-w-0 text-body-01-jp-bold text-fg [word-break:break-word]">
        {children}
      </p>
      {action}
    </div>
  </div>
);

/**
 * 作品詳細 v2 の要約帯（役割・期間・体制・ツール）。値が空の項目は出さない（編集モードでは「—」で出して編集可能にする）。
 * 角丸は外枠の overflow-hidden で切る（編集ボタンは流れの中に置くので切れない）。
 * 仕切りは gap-px + 地色の線で引くので、狭い幅で 1 列に折り返しても線が残る。
 * 期間・体制の「全画面」ボタンは WorkDetailHeader と同じ部品・パーサーでモーダルを開く
 */
const WorkSummaryStrip: FC<{ work: Work; tools: WorkToolItem[]; onEdit?: (region: WorkDetailEditRegion) => void }> = ({ work, tools, onEdit }) => {
  const [vizModal, setVizModal] = useState<"timeline" | "stakeholders" | null>(null);
  const timeline = useMemo(() => parseTimeline(work.timeline), [work.timeline]);
  const stakeholders = useMemo(() => parseStakeholders(work.stakeholders), [work.stakeholders]);
  const { start_date, end_date, is_current } = work;
  const timelinePeriod = useMemo(
    () => periodFromRow({ start_date, end_date, is_current }),
    [start_date, end_date, is_current],
  );

  const toolText = tools.length > 0 ? `${tools.slice(0, MAX_TOOLS).map((t) => t.name).join("・")}${tools.length > MAX_TOOLS ? " ほか" : ""}` : "";
  const role = work.role?.trim() ?? "";
  const period = work.period?.trim() ?? "";
  const breakdown = useMemo(() => parseStakeholderBreakdown(work.stakeholder_breakdown), [work.stakeholder_breakdown]);
  // 内訳は全画面ボタンで見せ、セルには総人数だけ出す。人数を合計できない（0 名）ときは空にして「—」
  const totalCount = breakdown ? breakdown.reduce((sum, s) => sum + s.count, 0) : 0;
  const stakeholderText = totalCount > 0 ? `計 ${totalCount} 名` : "";

  const edit = (label: string, region: WorkDetailEditRegion) =>
    onEdit && <EditButton label={label} onClick={() => onEdit(region)} className="ml-auto shrink-0" />;
  const withEdit = (viz: ReactNode, label: string, region: WorkDetailEditRegion) => {
    const editBtn = edit(label, region);
    return viz || editBtn ? (
      <>
        {viz}
        {editBtn}
      </>
    ) : undefined;
  };

  const showRole = !!role || !!onEdit;
  const showPeriod = !!period || !!timeline || !!onEdit;
  const showStakeholders = !!stakeholderText || !!stakeholders || !!onEdit;
  const showTools = !!toolText || !!onEdit;

  const visibleCount = [showRole, showPeriod, showStakeholders, showTools].filter(Boolean).length;
  if (visibleCount === 0) return null;
  const lastOfThree = visibleCount === 3 ? LAST_OF_THREE : "";
  // 最後に出る項目だけに行を埋めるクラスを付ける
  const lastKey = showTools ? "tools" : showStakeholders ? "stakeholders" : showPeriod ? "period" : "role";
  const cls = (key: string) => (key === lastKey ? lastOfThree : "");

  return (
    <>
      <div className="@container w-full">
        <div className={`grid w-full gap-px overflow-hidden rounded-r8 border border-border bg-border ${GRID_COLS[visibleCount]}`}>
          {showRole && <Cell label="役割" className={cls("role")} action={edit("役割", "roles")}>{role || "—"}</Cell>}
          {showPeriod && (
            <Cell
              label="期間"
              className={cls("period")}
              action={withEdit(
                timeline && <VizButton label="タイムライン(RACI)を表示" onClick={() => setVizModal("timeline")} />,
                "期間",
                "period",
              )}
            >
              {period || "—"}
            </Cell>
          )}
          {showStakeholders && (
            <Cell
              label="体制"
              className={cls("stakeholders")}
              action={withEdit(
                stakeholders && <VizButton label="関係者の体制を表示" onClick={() => setVizModal("stakeholders")} />,
                "関係者",
                "stakeholders",
              )}
            >
              {stakeholderText || "—"}
            </Cell>
          )}
          {showTools && <Cell label="ツール" className={cls("tools")} action={edit("ツール", "tags")}>{toolText || "—"}</Cell>}
        </div>
      </div>
      {vizModal && (
        <WorkVizModal
          kind={vizModal}
          timeline={timeline}
          period={timelinePeriod}
          stakeholders={stakeholders}
          onClose={() => setVizModal(null)}
        />
      )}
    </>
  );
};

export default WorkSummaryStrip;
