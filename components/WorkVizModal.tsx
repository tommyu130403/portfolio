"use client";

import type { FC } from "react";
import Modal from "./Modal";
import {
  WorkProcessChart,
  WorkStakeholderDiagram,
  type TimelineData,
  type StakeholdersData,
} from "./WorkViz";

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
  stakeholders?: StakeholdersData | null;
  onClose: () => void;
};

const HEADING: Record<WorkVizModalProps["kind"], string> = {
  timeline: "Timeline / RACI",
  stakeholders: "stakeholder",
};

const WorkVizModal: FC<WorkVizModalProps> = ({ kind, timeline, stakeholders, onClose }) => (
  <Modal onClose={onClose} width={kind === "stakeholders" ? "content" : "full"}>
    {/* Slot（Figma I839:3764;120:367）: gap-16 / p-40 */}
    <div className="flex flex-col gap-4 p-10">
      {/* 見出し Afacad Bold 20px / 行間 150% / 字間 5%・色 #9E9E9E */}
      <p className="[font-family:var(--font-afacad),var(--font-noto-sans-jp),sans-serif] text-[20px] font-bold leading-[1.5] tracking-[0.05em] text-system-500">
        {HEADING[kind]}
      </p>
      {kind === "timeline"
        ? timeline && <WorkProcessChart data={timeline} />
        : stakeholders && <WorkStakeholderDiagram data={stakeholders} />}
    </div>
  </Modal>
);

export default WorkVizModal;
