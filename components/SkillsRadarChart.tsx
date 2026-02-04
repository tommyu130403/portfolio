import BaseRadarChart, {
  type RadarChartData,
  type RadarLegendItem,
} from "@/components/RadarChart";

export type { RadarChartData, RadarLegendItem };

export type RadarChartProps = {
  data: RadarChartData[];
  legendItems?: RadarLegendItem[];
};

/**
 * 汎用的に使えるレーダーチャートコンポーネント。
 * データの取得や整形は、呼び出し元（例: app/page.tsx や他のコンポーネント）で行い、
 * ここには描画ロジックのみを閉じ込めます。
 */
export default function RadarChart({ data, legendItems }: RadarChartProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <BaseRadarChart
        data={data}
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

