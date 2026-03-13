"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import type { IconProps } from "@/components/Icon";

// ──────────────────────────────────────────────
// Data types
// ──────────────────────────────────────────────
type SkillBarConfig = {
  label: string;
  segments: number;     // 1–10 の塗りつぶしセグメント数
  level: string;        // 例: "Lv.3 Senior"
  description?: string; // 展開時に表示する説明
};

type ToolTagConfig = {
  name: string;
  years: string; // 例: "5年", "10年~"
};

type SkillCardConfig = {
  icon: { set: NonNullable<IconProps["set"]>; name: string };
  title: string;
  titleJP: string;
  skills: SkillBarConfig[];
  tools: ToolTagConfig[];
};

// ──────────────────────────────────────────────
// Static card data (portfolio content)
// ──────────────────────────────────────────────
const SKILL_CARDS: SkillCardConfig[] = [
  {
    icon: { set: "Edit", name: "writing-fluently" },
    title: "Execution",
    titleJP: "制作・実行",
    skills: [
      { label: "UIデザイン (SaaS・Application) デザイン", segments: 8, level: "Lv.4 Lead" },
      { label: "WEB (オウンドメディア・サービスサイト) デザイン", segments: 6, level: "Lv.3 Senior" },
      { label: "LP デザイン", segments: 4, level: "Lv.2 Mid" },
    ],
    tools: [
      { name: "Figma", years: "5年" },
      { name: "Illustrator", years: "10年~" },
      { name: "Photoshop", years: "10年~" },
      { name: "STUDIO", years: "3年" },
    ],
  },
  {
    icon: { set: "Edit", name: "writing-fluently" },
    title: "Technology",
    titleJP: "開発・AI共創",
    skills: [
      {
        label: "プロジェクトマネジメント (アジャイル開発・スクラム開発)",
        segments: 7,
        level: "Lv.4 Lead",
      },
      {
        label: "フロントエンド開発",
        segments: 5,
        level: "Lv.3 Senior",
        description:
          "Next.jsの環境にてReact・Typescriptなどを用いたプロダクトの実装、デザインシステム構築過程におけるコンポーネント実装など。",
      },
    ],
    tools: [{ name: "Github", years: "10年以上" }],
  },
  {
    icon: { set: "Abstract", name: "coordinate-system" },
    title: "Business",
    titleJP: "事業貢献",
    skills: [{ label: "プロダクトマネジメント", segments: 5, level: "Lv.3 Senior" }],
    tools: [],
  },
  {
    icon: { set: "Peoples", name: "every-user" },
    title: "People",
    titleJP: "育成・採用・コミュニケーション",
    skills: [],
    tools: [],
  },
  {
    icon: { set: "Peoples", name: "every-user" },
    title: "Organization",
    titleJP: "組織開発",
    skills: [],
    tools: [],
  },
  {
    icon: { set: "Abstract", name: "coordinate-system" },
    title: "Strategy",
    titleJP: "課題定義・リサーチ",
    skills: [
      { label: "UXリサーチ", segments: 5, level: "Lv.3 Senior" },
      { label: "UX設計 (UXメトリクス定義)", segments: 5, level: "Lv.3 Senior" },
      { label: "CVR改善・施策立案 (CRO・EFO・ASO)", segments: 7, level: "Lv.4 Lead" },
    ],
    tools: [
      { name: "Google Analytics", years: "7年" },
      { name: "Google Optimize", years: "7年" },
      { name: "Looker Studio", years: "3年" },
      { name: "Gemini", years: "1年未満" },
    ],
  },
];

const CARDS_PER_PAGE = 2;
const TOTAL_PAGES = Math.ceil(SKILL_CARDS.length / CARDS_PER_PAGE);

// ──────────────────────────────────────────────
// _SkillExperienceBar
// ──────────────────────────────────────────────
const SkillExperienceBar = ({ label, segments, level, description }: SkillBarConfig) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col w-full">
      {/* メイン行: ラベル + バー + トグル */}
      <div className="flex items-center justify-between w-full gap-3">
        {/* 左: ラベル・バー・レベルバッジ */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <p className="text-[10px] leading-none text-white">{label}</p>
          <div className="flex gap-2 items-center">
            {/* セグメントバー */}
            <div className="flex gap-px items-center shrink-0">
              {Array.from({ length: segments }).map((_, i) => {
                const isLast = i === segments - 1;
                return (
                  <div
                    key={i}
                    className={[
                      "bg-[#b3ffe7] h-[8px] w-[24px] shrink-0",
                      isLast
                        ? "rounded-tl-[1px] rounded-bl-[1px] rounded-tr-[8px] rounded-br-[8px]"
                        : "rounded-[1px]",
                    ].join(" ")}
                  />
                );
              })}
            </div>
            {/* レベルバッジ */}
            <div className="bg-[rgba(0,0,0,0.25)] flex items-center justify-center px-2 py-1 rounded-full shrink-0">
              <span className="text-[10px] leading-4 text-[#9e9e9e] whitespace-nowrap">{level}</span>
            </div>
          </div>
        </div>
        {/* トグルボタン (説明がある場合のみ) */}
        {description && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className={[
              "flex items-center justify-center shrink-0 size-[24px] rounded-[8px] transition-colors",
              expanded ? "bg-[rgba(255,255,255,0.05)]" : "",
            ].join(" ")}
          >
            <Icon
              set="Arrows"
              name="down-small"
              className={[
                "h-[16px] w-[16px] transition-transform duration-200",
                expanded ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>
        )}
      </div>
      {/* 展開時の説明 */}
      {expanded && description && (
        <div className="mt-3 bg-[#212121] border border-[#424242] rounded-[14px] overflow-hidden">
          <div className="p-4">
            <p className="text-[12px] leading-[1.5] tracking-[0.36px] text-[#9e9e9e]">{description}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// _SkillTag
// ──────────────────────────────────────────────
const SkillTag = ({ name, years }: ToolTagConfig) => (
  <div className="bg-[rgba(0,0,0,0.25)] flex gap-2 items-center px-2 py-1 rounded-[8px] shrink-0">
    <div className="flex gap-1 items-center">
      <Icon set="Edit" name="more-four" className="h-3 w-3 shrink-0" />
      <span className="text-[10px] leading-none text-white whitespace-nowrap">{name}</span>
    </div>
    <div className="h-[18px] w-px bg-[#424242]" />
    <span className="text-[10px] leading-none text-[#9e9e9e] whitespace-nowrap">{years}</span>
  </div>
);

// ──────────────────────────────────────────────
// _SkillCard
// ──────────────────────────────────────────────
const SkillCard = ({ icon, title, titleJP, skills, tools }: SkillCardConfig) => (
  <div className="bg-[rgba(0,0,0,0.25)] rounded-[14px] overflow-hidden w-full h-full">
    <div className="flex flex-col gap-10 px-6 py-10 h-full">
      {/* ヘッダー: アイコン + EN タイトル + JP サブタイトル */}
      <div className="flex gap-2 items-center shrink-0">
        <Icon set={icon.set} name={icon.name} className="h-8 w-8 shrink-0" />
        <div className="flex gap-2 items-end">
          <span className="font-bold text-[24px] leading-normal text-[#48f4be] whitespace-nowrap">
            {title}
          </span>
          <span className="text-[11px] leading-normal tracking-[0.33px] text-[#48f4be] whitespace-nowrap pb-[2px]">
            {titleJP}
          </span>
        </div>
      </div>

      {/* スキルバー一覧 */}
      {skills.length > 0 && (
        <div className="flex flex-col gap-6">
          {skills.map((skill, i) => (
            <SkillExperienceBar key={i} {...skill} />
          ))}
        </div>
      )}

      {/* ツールタグ */}
      {tools.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-auto">
          {tools.map((tool) => (
            <SkillTag key={tool.name} {...tool} />
          ))}
        </div>
      )}
    </div>
  </div>
);

// ──────────────────────────────────────────────
// SkillsCardGrid — horizontal carousel
// ──────────────────────────────────────────────
export default function SkillsCardGrid() {
  const [page, setPage] = useState(0);

  const pages = Array.from({ length: TOTAL_PAGES }, (_, i) =>
    SKILL_CARDS.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE)
  );

  const goTo = (next: number) => {
    if (next < 0 || next >= TOTAL_PAGES) return;
    setPage(next);
  };

  return (
    <div className="w-full flex flex-col">
      {/* カルーセルエリア（ボタン込み）— px-[52px] でボタン分のスペースを確保 */}
      <div className="relative w-full px-[52px]">
        {/* 前へボタン */}
        {page > 0 && (
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            className="absolute left-[8px] top-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-[36px] rounded-[8px] bg-[#212121] border border-[#424242] p-[6px]"
          >
            <Icon set="Arrows" name="left" className="h-6 w-6" />
          </button>
        )}

        {/* カルーセルトラック */}
        <div className="overflow-hidden w-full">
          <div
            className="flex w-full transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${page * 100}%)` }}
          >
            {pages.map((pair, i) => (
              <div key={i} className="flex gap-6 w-full shrink-0">
                {pair.map((card) => (
                  <div key={card.title} className="flex-1 min-w-0">
                    <SkillCard {...card} />
                  </div>
                ))}
                {/* 奇数枚の場合のスペーサー */}
                {pair.length < CARDS_PER_PAGE && <div className="flex-1 min-w-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* 次へボタン */}
        {page < TOTAL_PAGES - 1 && (
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            className="absolute right-[8px] top-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-[36px] rounded-[8px] bg-[#212121] border border-[#424242] p-[6px]"
          >
            <Icon set="Arrows" name="right" className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* ページドット */}
      <div className="flex gap-2 justify-center mt-6">
        {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className={[
              "size-[6px] rounded-full transition-colors",
              i === page ? "bg-[#48f4be]" : "bg-[#424242]",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
