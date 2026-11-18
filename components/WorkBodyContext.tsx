"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StakeholdersData } from "./WorkViz";

/**
 * 作品本文の図版が、本文の外（作品の行）から読むデータ。`::: team` が関係者の体制図を描くために使う。
 * 作品詳細（公開ページ・admin プレビュー）は WorkDetailView が渡す。渡されない場所（スタイルガイド・本文だけのプレビュー）では null
 */
export type WorkBodyData = {
  /** works.stakeholders を読んだもの。読めない・無いときは null */
  stakeholders: StakeholdersData | null;
  /** works.stakeholder_breakdown を役割名と人数に分けたもの。読めない・無いときは null */
  breakdown: { name: string; count: number }[] | null;
  /** ヒーローに出している lead（v2）。同じ文の lead を持つ本文の `::: summary` は lead を繰り返さない。別の文の lead はそのまま出す */
  heroLead?: string;
  /** admin プレビューだけ。体制（関係者）の編集を開く。`::: team` の図に編集ボタンを出す */
  onEditStakeholders?: () => void;
};

const WorkBodyContext = createContext<WorkBodyData | null>(null);

export function WorkBodyProvider({ value, children }: { value: WorkBodyData; children: ReactNode }) {
  return <WorkBodyContext.Provider value={value}>{children}</WorkBodyContext.Provider>;
}

export function useWorkBody(): WorkBodyData | null {
  return useContext(WorkBodyContext);
}
