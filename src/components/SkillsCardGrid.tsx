"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import type { IconProps } from "@/components/Icon";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";

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
  id: string;
  icon: { set: NonNullable<IconProps["set"]>; name: string };
  title: string;
  titleJP: string;
  skills: SkillBarConfig[];
  tools: ToolTagConfig[];
};

// DB rows
type SkillCardRow        = Tables<"skill_cards">;
type SkillExperienceRow  = Tables<"skill_experience">;
type SkillToolRow        = Tables<"skill_tools">;
type SkillLevelTokenRow  = Tables<"skill_level_tokens">;

// ──────────────────────────────────────────────
// Supabase fetch helper
// ──────────────────────────────────────────────
type SkillLevelTokenMap = Record<string, { value: string; description: string }>;

async function fetchLevelTokenMap(): Promise<SkillLevelTokenMap> {
  const { data } = await supabase
    .from("skill_level_tokens")
    .select("key,value,description")
    .like("key", "Level.%");

  const rows = (data as Pick<SkillLevelTokenRow, "key" | "value" | "description">[] | null) ?? [];
  return Object.fromEntries(
    rows.map((r) => [
      r.key,
      { value: r.value, description: r.description },
    ]),
  );
}

async function fetchSkillCards(): Promise<SkillCardConfig[]> {
  const [{ data: cards }, { data: bars }, { data: tools }] = await Promise.all([
    supabase.from("skill_cards").select("*").order("sort_order", { ascending: true }),
    supabase.from("skill_experience").select("*").order("sort_order",  { ascending: true }),
    supabase.from("skill_tools").select("*").order("sort_order", { ascending: true }),
  ]);

  if (!cards) return [];

  // 表示用カードからは「辞書用カード（Skill Vocab / Tool Vocab）」を除外する。
  // これらは admin ページ上でのボキャブラリ追加のためのコンテナであり、
  // ポートフォリオ公開ページの Skills セクションには不要なため。
  const visibleCards = (cards as SkillCardRow[]).filter((card) => {
    const t  = card.title?.trim() ?? "";
    const tj = card.title_jp?.trim() ?? "";
    const isVocab =
      t === "Skill Vocab" ||
      t === "Tool Vocab" ||
      tj === "スキル辞書" ||
      tj === "ツール辞書";
    return !isVocab;
  });

  return visibleCards.map((card) => ({
    id:      card.id,
    icon:    { set: card.icon_set as NonNullable<IconProps["set"]>, name: card.icon_name },
    title:   card.title,
    titleJP: card.title_jp,
    skills: (bars as SkillExperienceRow[] ?? [])
      .filter((b) => b.card_id === card.id)
      .map((b) => ({
        label:       b.label_short ?? b.label,
        segments:    b.segments,
        level:       b.level,
        description: b.description ?? undefined,
      })),
    tools: (tools as SkillToolRow[] ?? [])
      .filter((t) => t.card_id === card.id)
      .map((t) => ({ name: t.name, years: t.years })),
  }));
}

// ──────────────────────────────────────────────
// _SkillExperienceBar
// ──────────────────────────────────────────────
const SkillExperienceBar = ({
  label,
  segments,
  level,
  description,
  levelTokenMap,
}: SkillBarConfig & { levelTokenMap?: SkillLevelTokenMap }) => {
  const [expanded, setExpanded] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const levelKeyMatch = String(level ?? "").match(/^Lv\.(\d+)\b/);
  const levelKey = levelKeyMatch ? `Level.${levelKeyMatch[1]}` : undefined;
  const levelToken = levelKey ? levelTokenMap?.[levelKey] : undefined;
  const levelLabel = levelToken?.value ?? level;
  const levelTooltip = levelToken?.description;

  return (
    <div className="flex flex-col w-full relative">
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
            <div
              className="bg-[rgba(0,0,0,0.25)] flex items-center justify-center px-2 py-1 rounded-full shrink-0 relative"
              onMouseEnter={() => setTooltipOpen(true)}
              onMouseLeave={() => setTooltipOpen(false)}
              onFocus={() => setTooltipOpen(true)}
              onBlur={() => setTooltipOpen(false)}
              tabIndex={0}
            >
              <span className="text-[10px] leading-4 text-[#9e9e9e] whitespace-nowrap">{levelLabel}</span>
              {levelTooltip && (
                <div
                  className={[
                    "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
                    tooltipOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                    "transition-opacity duration-150",
                    "z-50",
                    "bg-[#212121] border border-[#424242] rounded-[14px] overflow-hidden",
                    "shadow-[1px_1px_16px_2px_rgba(0,0,0,0.25)]",
                    "px-4 py-3",
                    "w-[360px] max-w-[calc(100vw-32px)]",
                  ].join(" ")}
                  role="tooltip"
                  onMouseEnter={() => setTooltipOpen(true)}
                  onMouseLeave={() => setTooltipOpen(false)}
                >
                  <p className="text-[12px] leading-[1.5] tracking-[0.36px] text-[#9e9e9e]">
                    {levelTooltip}
                  </p>
                </div>
              )}
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
              name="left"
              className={[
                "h-[16px] w-[16px] transition-transform duration-200",
                expanded ? "rotate-90" : "-rotate-90",
              ].join(" ")}
            />
          </button>
        )}
      </div>
      {/* 展開時の説明 */}
      {expanded && description && (
        <div
          className={[
            "absolute left-0 right-0 top-full mt-3",
            "bg-[#212121] border border-[#424242] rounded-[14px] overflow-hidden",
            "shadow-[1px_1px_16px_2px_rgba(0,0,0,0.25)]",
            "z-20",
          ].join(" ")}
        >
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
const SkillCard = ({
  icon,
  title,
  titleJP,
  skills,
  tools,
  levelTokenMap,
}: SkillCardConfig & { levelTokenMap?: SkillLevelTokenMap }) => (
  <div className="bg-[#1a1a1a] rounded-[14px] overflow-hidden w-full h-full">
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
            <SkillExperienceBar key={i} {...skill} levelTokenMap={levelTokenMap} />
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
// SkillsCardGrid — 2カラムグリッド
// ──────────────────────────────────────────────
export default function SkillsCardGrid() {
  const [cards, setCards]         = useState<SkillCardConfig[]>([]);
  const [loading, setLoading]     = useState(true);
  const [levelTokenMap, setLevelTokenMap] = useState<SkillLevelTokenMap>({});

  useEffect(() => {
    Promise.all([fetchSkillCards(), fetchLevelTokenMap()]).then(([data, map]) => {
      setCards(data);
      setLevelTokenMap(map);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-6 w-full">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-[14px] bg-[#1a1a1a] h-[300px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 w-full">
      {cards.map((card) => (
        <SkillCard key={card.id} {...card} levelTokenMap={levelTokenMap} />
      ))}
    </div>
  );
}
