"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";
import RadarChart, {
  type RadarChartData,
  type RadarLegendItem,
} from "@/components/RadarChart";

type UserSkillRow = Tables<"user_skills">;

const normalizeSkillValue = (value: number | null): number => {
  if (value == null) return 0;
  // 想定: 1〜5 段階評価を 0〜1 に正規化
  const normalized = value / 5;
  if (normalized < 0) return 0;
  if (normalized > 1) return 1;
  return normalized;
};

const mapUserSkillToRadarData = (row: UserSkillRow): RadarChartData[] => {
  return [
    {
      label: "Information Architecture",
      value: normalizeSkillValue(row.ia),
      highlighted: true,
    },
    {
      label: "Interaction Design",
      value: normalizeSkillValue(row.interaction),
      highlighted: true,
    },
    {
      label: "Visual Design",
      value: normalizeSkillValue(row.visual),
    },
    {
      label: "Prototyping",
      value: normalizeSkillValue(row.prototype),
    },
    {
      label: "Presentation",
      value: normalizeSkillValue(row.presentation),
    },
  ];
};

const legendItems: RadarLegendItem[] = [
  {
    label: "現在のスキルレベル",
    color: "#326960",
  },
];

export default function SkillsRadarChart() {
  const [row, setRow] = useState<UserSkillRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserSkills = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("user_skills")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Failed to fetch user_skills:", error);
        setError(error.message);
      } else if (data && data.length > 0) {
        setRow(data[0]);
      } else {
        setRow(null);
      }

      setLoading(false);
    };

    void fetchUserSkills();
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-[#9E9E9E]">
        スキルデータを読み込み中です…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-300">
        データの取得中にエラーが発生しました：{error}
      </p>
    );
  }

  if (!row) {
    return (
      <p className="text-sm text-[#9E9E9E]">
        user_skills テーブルにスキルデータが登録されていません。
      </p>
    );
  }

  const radarData = mapUserSkillToRadarData(row);

  return (
    <div className="flex flex-col items-center justify-center">
      <RadarChart
        data={radarData}
        size={260}
        fillColor="#16352F"
        borderColor="#48F4BE"
        highlightColor="#B3FFE7"
        labelColor="#9E9E9E"
        legendItems={legendItems}
      />
    </div>
  );
}

