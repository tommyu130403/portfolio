"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import type { IconProps } from "@/components/Icon";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";

// ──────────────────────────────────────────────
// 4-step proficiency scale (案A)
// ──────────────────────────────────────────────
const SKILL_LEVELS = [
  { n: 1, en: "Beginner",     jp: "基礎知識あり / 学習中",             fill: "rgba(72,244,190,0.30)" },
  { n: 2, en: "Intermediate", jp: "サポートのもと実務遂行可能",          fill: "rgba(72,244,190,0.52)" },
  { n: 3, en: "Advanced",     jp: "独力で完遂し、他者をサポート可能",    fill: "rgba(72,244,190,0.78)" },
  { n: 4, en: "Expert",       jp: "プロセスをリードし、組織を牽引可能",  fill: "#48F4BE" },
];

// Map existing segments scale (1–10) to 4-step proficiency
function segmentsToLevel(segments: number): number {
  return Math.min(4, Math.max(1, Math.ceil(segments / 2.5)));
}

// ──────────────────────────────────────────────
// Data types
// ──────────────────────────────────────────────
type SkillBarConfig = {
  label: string;
  segments: number;
};

type SkillCardConfig = {
  id: string;
  icon: { set: NonNullable<IconProps["set"]>; name: string };
  title: string;
  titleJP: string;
  skills: SkillBarConfig[];
};

type SkillCardRow       = Tables<"skill_cards">;
type SkillExperienceRow = Tables<"skill_experience">;

// ──────────────────────────────────────────────
// Supabase fetch
// ──────────────────────────────────────────────
async function fetchSkillCards(): Promise<SkillCardConfig[]> {
  const [{ data: cards }, { data: bars }] = await Promise.all([
    supabase.from("skill_cards").select("*").order("sort_order", { ascending: true }),
    supabase.from("skill_experience").select("*").order("sort_order", { ascending: true }),
  ]);

  if (!cards) return [];

  const visibleCards = (cards as SkillCardRow[]).filter((card) => {
    const t  = card.title?.trim() ?? "";
    const tj = card.title_jp?.trim() ?? "";
    return (
      t !== "Skill Vocab" && t !== "Tool Vocab" &&
      tj !== "スキル辞書" && tj !== "ツール辞書"
    );
  });

  return visibleCards.map((card) => ({
    id:      card.id,
    icon:    { set: card.icon_set as NonNullable<IconProps["set"]>, name: card.icon_name },
    title:   card.title,
    titleJP: card.title_jp,
    skills: (bars as SkillExperienceRow[] ?? [])
      .filter((b) => b.card_id === card.id)
      .map((b) => ({ label: b.label_short ?? b.label, segments: b.segments })),
  }));
}

// ──────────────────────────────────────────────
// SegBar — 4-segment proficiency bar
// ──────────────────────────────────────────────
function SegBar({ level, glow }: { level: number; glow: boolean }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {[1, 2, 3, 4].map((i) => {
        const on = i <= level;
        return (
          <div
            key={i}
            style={{
              width: 22,
              height: 8,
              borderRadius: 999,
              flexShrink: 0,
              background: on ? "#48F4BE" : "rgba(0,0,0,0.25)",
              border: on ? "none" : "1px solid #424242",
              boxSizing: "border-box",
              boxShadow: on && glow ? "0 0 8px rgba(72,244,190,0.45)" : "none",
              transition: "background 0.2s, box-shadow 0.2s",
            }}
          />
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// SkillRow — one skill inside a card
// ──────────────────────────────────────────────
function SkillRow({ skill }: { skill: SkillBarConfig }) {
  const [hover, setHover] = useState(false);
  const level = segmentsToLevel(skill.segments);
  const levelInfo = SKILL_LEVELS[level - 1];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 12px",
        margin: "0 -12px",
        borderRadius: 8,
        background: hover ? "rgba(255,255,255,0.05)" : "transparent",
        transition: "background 0.18s",
        cursor: "default",
      }}
    >
      <span
        className="text-[14px] tracking-[0.3px] overflow-hidden text-ellipsis whitespace-nowrap"
        style={{
          flex: 1,
          minWidth: 0,
          color: hover ? "#FFFFFF" : "rgba(255,255,255,0.86)",
          transition: "color 0.18s",
        }}
      >
        {skill.label}
      </span>
      <SegBar level={level} glow={hover} />
      <span
        className="text-[12px] tracking-[0.4px] whitespace-nowrap shrink-0"
        style={{
          width: 92,
          textAlign: "right",
          color: level === 4 ? "#48F4BE" : "#9E9E9E",
          fontWeight: level === 4 ? 700 : 500,
        }}
      >
        {levelInfo.en}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────
// SkillCard
// ──────────────────────────────────────────────
function SkillCard({ card }: { card: SkillCardConfig }) {
  return (
    <div
      style={{
        background: "#1A1A1A",
        border: "1px solid #424242",
        borderRadius: 14,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon
            set={card.icon.set}
            name={card.icon.name}
            tintColor="#48F4BE"
            style={{ width: 18, height: 18, flexShrink: 0 }}
          />
          <span className="text-[15px] font-bold tracking-[0.3px] whitespace-nowrap text-white">
            {card.title}
          </span>
        </div>
        <span className="font-noto text-[11px] tracking-[0.33px]" style={{ color: "#616161" }}>
          {card.titleJP}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#424242", margin: "0 -28px" }} />

      {/* Skill rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {card.skills.map((skill, i) => (
          <SkillRow key={i} skill={skill} />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// ProficiencyLegend — shared legend below grid
// ──────────────────────────────────────────────
function ProficiencyLegend() {
  return (
    <div
      style={{
        background: "#1A1A1A",
        border: "1px solid #424242",
        borderRadius: 14,
        padding: "24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <span className="font-guide text-[10px] tracking-[0.4px] uppercase" style={{ color: "#616161" }}>
        Proficiency Scale · 習熟度の基準
      </span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 20,
        }}
      >
        {SKILL_LEVELS.map((lv) => (
          <div key={lv.n} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 8,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: lv.fill,
                  border: lv.n === 1 ? "1px solid #424242" : "none",
                  boxSizing: "border-box",
                }}
              />
              <span className="text-[12px] font-bold tracking-[0.4px] text-white">
                {lv.en}
              </span>
            </div>
            <span className="font-noto text-[11px] leading-[1.5] tracking-[0.33px]" style={{ color: "#9E9E9E" }}>
              {lv.jp}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// SkillsCardGrid — 案A: Refined Cards
// ──────────────────────────────────────────────
export default function SkillsCardGrid() {
  const [cards, setCards] = useState<SkillCardConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSkillCards().then((data) => {
      setCards(data);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {cards.map((card) => (
          <SkillCard key={card.id} card={card} />
        ))}
      </div>
      <ProficiencyLegend />
    </div>
  );
}
