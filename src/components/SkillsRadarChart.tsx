"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";
import RadarChart, {
  type RadarChartData,
  type RadarLegendItem,
} from "@/components/RadarChart";

type UserSkillRow = Tables<"user_skills">;

const normalizeSkillValue = (value: number | null): number => {
  if (value == null) return 0;
  const normalized = value / 5;
  return Math.min(1, Math.max(0, normalized));
};

// 12スキルを時計回り（12時から）の順で定義
const SKILL_AXES: {
  key: keyof Omit<UserSkillRow, "id" | "user_id" | "is_target" | "updated_at">;
  label: string;
  highlighted?: boolean;
}[] = [
  { key: "prototype", label: "プロトタイプ" },
  { key: "visual", label: "ビジュアル", highlighted: true },
  { key: "implementation", label: "実装" },
  { key: "interaction", label: "インタラクション", highlighted: true },
  { key: "accessibility", label: "アクセシビリティ" },
  { key: "writing", label: "ライティング" },
  { key: "ia", label: "IA", highlighted: true },
  { key: "qualitative_research", label: "定性調査" },
  { key: "quantitative_research", label: "定量調査" },
  { key: "strategy", label: "戦略" },
  { key: "facilitation", label: "ファシリテーション" },
  { key: "presentation", label: "プレゼンテーション", highlighted: true },
];

const mapRowToRadarData = (row: UserSkillRow): RadarChartData[] =>
  SKILL_AXES.map((axis) => ({
    label: axis.label,
    value: normalizeSkillValue(row[axis.key] as number | null),
    highlighted: axis.highlighted,
  }));

const LEGENDS: RadarLegendItem[] = [
  { label: "現在のスキルレベル", color: "#48f4be" },
  { label: "目指すスキルレベル", color: "#616161" },
];

export default function SkillsRadarChart() {
  const [currentData, setCurrentData] = useState<RadarChartData[] | null>(null);
  const [targetData, setTargetData] = useState<RadarChartData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkills = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("user_skills")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch user_skills:", error);
        setError(error.message);
        setLoading(false);
        return;
      }

      const current = data?.find((row) => row.is_target === false || row.is_target === null);
      const target = data?.find((row) => row.is_target === true);

      setCurrentData(current ? mapRowToRadarData(current) : null);
      setTargetData(target ? mapRowToRadarData(target) : null);
      setLoading(false);
    };

    void fetchSkills();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[500px] w-full max-w-[645px] items-center justify-center">
        <p className="text-sm text-[#9e9e9e]">スキルデータを読み込み中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[500px] w-full max-w-[645px] items-center justify-center">
        <p className="text-sm text-red-300">データ取得エラー: {error}</p>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="flex h-[500px] w-full max-w-[645px] items-center justify-center">
        <p className="text-sm text-[#9e9e9e]">スキルデータがありません。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div style={{ width: 645, height: 500 }}>
        <RadarChart
          data={currentData}
          targetData={targetData ?? undefined}
          width={645}
          height={500}
          fillColor="#16352F"
          borderColor="#48F4BE"
          highlightColor="#48F4BE"
          labelColor="#9E9E9E"
          targetBorderColor="#616161"
        />
      </div>
      <div className="flex items-center gap-6">
        {LEGENDS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs tracking-[0.6px]" style={{ color: item.color }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
