"use client";

import type { FC } from "react";
import Modal from "./Modal";
import {
  WorkProcessChart,
  WorkStakeholderDiagram,
  type TimelineData,
  type StakeholdersData,
} from "./WorkViz";
import type { TimelinePeriod } from "@/lib/timeline-scale";

/**
 * Work 詳細・メタ表の「全画面」ボタンで開く構造化ビジュアルのモーダル。
 * Figma:
 *  - timeline    … `/works/{id}：timeline`（839:3499）見出し「Timeline / RACI」+ _Process
 *  - stakeholders… `/works/{id}：stakeholder`（848:2944）見出し「stakeholder」+ _Stakeholder
 * 汎用 Modal（backdrop blur / コンテナ / 閉じるボタン）を流用し、中身に見出し＋viz を描画する。
 */
type WorkVizModalProps = {
  kind: "timeline" | "stakeholders";
  timeline?: TimelineData | null;
  period?: TimelinePeriod | null;
  stakeholders?: StakeholdersData | null;
  onClose: () => void;
};

const HEADING: Record<WorkVizModalProps["kind"], string> = {
  timeline: "Timeline / RACI",
  stakeholders: "stakeholder",
};

const WorkVizModal: FC<WorkVizModalProps> = ({ kind, timeline, period, stakeholders, onClose }) => (
  <Modal onClose={onClose} width="full">
    {/* Slot（Figma I848:2948;120:367）: gap-24 / p-40。Timeline も同じ形にそろえる（2026-11-10 オーナー判断） */}
    <div className="flex flex-col gap-6 p-10">
      {/* 見出し Afacad Bold 20px / 行間 100% / 字間 5%・色 fg（Text/Body/Primary） */}
      <p className="[font-family:var(--font-afacad),var(--font-noto-sans-jp),sans-serif] text-[20px] font-bold leading-none tracking-[0.05em] text-fg">
        {HEADING[kind]}
      </p>
      {kind === "timeline"
        ? timeline && <WorkProcessChart data={timeline} period={period} />
        : stakeholders && <WorkStakeholderDiagram data={stakeholders} />}
    </div>
  </Modal>
);

export default WorkVizModal;
