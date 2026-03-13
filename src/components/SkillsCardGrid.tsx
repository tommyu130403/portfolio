"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";
import Icon from "@/components/Icon";
import type { IconProps } from "@/components/Icon";

type UserSkillRow = Tables<"user_skills">;
type SkillKey = keyof Omit<UserSkillRow, "id" | "user_id" | "is_target" | "updated_at">;

type SkillBarConfig = {
  key: SkillKey;
  label: string;
};

type SkillCardConfig = {
  icon: { set: NonNullable<IconProps["set"]>; name: string };
  title: string;
  skills: SkillBarConfig[];
};

const SKILL_CARDS: SkillCardConfig[] = [
  {
    icon: { set: "Edit", name: "writing-fluently" },
    title: "Product Design",
    skills: [
      { key: "visual", label: "ビジュアル" },
      { key: "prototype", label: "プロトタイプ" },
      { key: "interaction", label: "インタラクション" },
      { key: "accessibility", label: "アクセシビリティ" },
      { key: "implementation", label: "実装" },
    ],
  },
  {
    icon: { set: "Peoples", name: "every-user" },
    title: "User Research",
    skills: [
      { key: "qualitative_research", label: "定性調査" },
      { key: "quantitative_research", label: "定量調査" },
      { key: "ia", label: "IA" },
    ],
  },
  {
    icon: { set: "Abstract", name: "coordinate-system" },
    title: "Strategy",
    skills: [
      { key: "strategy", label: "戦略" },
      { key: "facilitation", label: "ファシリテーション" },
    ],
  },
  {
    icon: { set: "Edit", name: "writing-fluently" },
    title: "Communication",
    skills: [
      { key: "presentation", label: "プレゼンテーション" },
      { key: "writing", label: "ライティング" },
    ],
  },
];

// ──────────────────────────────────────────────
// _SkillExperienceBar
// ──────────────────────────────────────────────
type SkillExperienceBarProps = {
  label: string;
  /** 0-5 の整数値。2倍して最大10セグメントで表示 */
  value: number;
};

const SkillExperienceBar = ({ label, value }: SkillExperienceBarProps) => {
  const segmentCount = Math.min(10, Math.max(0, Math.round(value * 2)));

  return (
    <div className="flex gap-3 items-center">
      {/* ラベル */}
      <div className="flex gap-1 items-center shrink-0">
        <Icon set="Edit" name="more-four" className="h-[14px] w-[14px] shrink-0" />
        <span className="text-[11px] leading-none text-white whitespace-nowrap">{label}</span>
      </div>
      {/* バー */}
      {segmentCount > 0 && (
        <div className="flex gap-px items-center shrink-0">
          {Array.from({ length: segmentCount }).map((_, i) => {
            const isFirst = i === 0;
            const isLast = i === segmentCount - 1;

            let rounded = "";
            if (isFirst && isLast) {
              rounded = "rounded-tl-[1px] rounded-bl-[1px] rounded-tr-[2px] rounded-br-[2px]";
            } else if (isFirst) {
              rounded = "rounded-tl-[1px] rounded-bl-[1px]";
            } else if (isLast) {
              rounded = "rounded-tl-[1px] rounded-bl-[1px] rounded-tr-[2px] rounded-br-[2px]";
            }

            return (
              <div
                key={i}
                className={`bg-[#b3ffe7] h-[4px] w-[16px] shrink-0 ${rounded}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// _SkillCard
// ──────────────────────────────────────────────
type SkillCardProps = SkillCardConfig & {
  skillRow: UserSkillRow | null;
};

const SkillCard = ({ icon, title, skills, skillRow }: SkillCardProps) => (
  <div className="bg-[rgba(0,0,0,0.25)] rounded-[14px] overflow-hidden w-full">
    <div className="flex flex-col gap-[23px] p-8">
      {/* ヘッダー */}
      <div className="flex gap-2 items-center">
        <Icon set={icon.set} name={icon.name} className="h-[22px] w-[22px] shrink-0" />
        <span className="text-[17px] font-bold text-[#48f4be] whitespace-nowrap">{title}</span>
      </div>
      {/* スキルバー一覧 */}
      <div className="flex flex-col gap-2">
        {skills.map((skill) => (
          <SkillExperienceBar
            key={skill.key}
            label={skill.label}
            value={(skillRow?.[skill.key] as number | null) ?? 0}
          />
        ))}
      </div>
    </div>
  </div>
);

// ──────────────────────────────────────────────
// SkillsCardGrid (export)
// ──────────────────────────────────────────────
export default function SkillsCardGrid() {
  const [skillRow, setSkillRow] = useState<UserSkillRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_skills")
        .select("*")
        .order("updated_at", { ascending: false });

      const current = data?.find((row) => row.is_target === false || row.is_target === null);
      setSkillRow(current ?? null);
      setLoading(false);
    };

    void fetchSkills();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-6 w-full">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[200px] animate-pulse rounded-[14px] bg-[#424242]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 w-full">
      {SKILL_CARDS.map((card) => (
        <SkillCard key={card.title} {...card} skillRow={skillRow} />
      ))}
    </div>
  );
}
