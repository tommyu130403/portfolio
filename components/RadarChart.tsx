import type { FC } from "react";

export type RadarChartData = {
  /** 軸のラベル */
  label: string;
  /** 値（0-1の範囲、1が最大値） */
  value: number;
  /** この軸をハイライトするか */
  highlighted?: boolean;
};

export type RadarLegendItem = {
  /** 凡例ラベル */
  label: string;
  /** インジケーターの色 */
  color: string;
};

export type RadarChartProps = {
  /** チャートのデータ（任意個のデータポイント） */
  data: RadarChartData[];
  /** チャートのサイズ（px） */
  size?: number;
  /** 現在のスキルレベルの色（フィル） */
  fillColor?: string;
  /** 現在のスキルレベルの色（ボーダー） */
  borderColor?: string;
  /** ハイライトされたラベルの色 */
  highlightColor?: string;
  /** 通常のラベルの色 */
  labelColor?: string;
  /** 付属の凡例に渡す項目（未指定なら凡例は表示されない） */
  legendItems?: RadarLegendItem[];
};

type RadarLegendProps = {
  items: RadarLegendItem[];
};

/**
 * RadarChart に付属する凡例コンポーネント。
 * Figma の「現在のスキルレベル」「学習するスキルレベル」の表示を想定。
 */
const RadarLegend: FC<RadarLegendProps> = ({ items }) => {
  if (!items.length) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#9E9E9E]">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const RadarChartComponent: FC<RadarChartProps> = ({
  data,
  size = 500,
  fillColor = "#326960",
  borderColor = "#62EFE4",
  highlightColor = "#62EFE4",
  labelColor = "#9E9E9E",
  legendItems,
}) => {
  const center = size / 2;
  const radius = size * 0.4; // チャートの半径
  const numAxes = data.length || 1;
  const numGridLevels = 6; // グリッドのレベル数

  // 各軸の角度を計算
  const angleStep = (2 * Math.PI) / numAxes;

  // グリッドの色設定
  const gridColors = [
    "#616161", // 内側（実線）
    "#515151", // 点線
    "#424242", // 実線
    "#515151", // 点線
    "#3B3B3B", // 実線
    "#515151", // 点線（外側）
  ];

  // データポイントを座標に変換
  const getPoint = (index: number, value: number) => {
    const angle = index * angleStep - Math.PI / 2; // 12時の位置から開始
    const r = radius * value;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // データポリゴンのパスを生成
  const dataPoints = data.slice(0, numAxes).map((item, index) =>
    getPoint(index, item.value)
  );
  const pathData = dataPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ") + " Z";

  // ラベルの位置を計算
  const getLabelPosition = (index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const labelRadius = radius * 1.15; // グリッドの外側
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
      angle: angle,
    };
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* グリッド線（同心円状の多角形） */}
        {Array.from({ length: numGridLevels }).map((_, level) => {
          const levelRadius = (radius * (level + 1)) / numGridLevels;
          const isDotted = level % 2 === 1; // 奇数レベルは点線
          const points = Array.from({ length: numAxes }).map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            return {
              x: center + levelRadius * Math.cos(angle),
              y: center + levelRadius * Math.sin(angle),
            };
          });

          const gridPath =
            points
              .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`)
              .join(" ") + " Z";

          return (
            <path
              key={level}
              d={gridPath}
              fill="none"
              stroke={gridColors[level]}
              strokeWidth={1}
              strokeDasharray={isDotted ? "2 2" : "0"}
              opacity={0.6}
            />
          );
        })}

        {/* 軸線（中心から外側へ） */}
        {Array.from({ length: numAxes }).map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const endX = center + radius * Math.cos(angle);
          const endY = center + radius * Math.sin(angle);

          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={endX}
              y2={endY}
              stroke="#424242"
              strokeWidth={1}
              opacity={0.3}
            />
          );
        })}

        {/* データポリゴン（フィル） */}
        <path
          d={pathData}
          fill={fillColor}
          opacity={0.8}
        />

        {/* データポリゴン（ボーダー） */}
        <path
          d={pathData}
          fill="none"
          stroke={borderColor}
          strokeWidth={2}
        />

        {/* ラベル */}
        {data.slice(0, numAxes).map((item, index) => {
          const { x, y } = getLabelPosition(index);
          const isHighlighted = item.highlighted ?? false;

          return (
            <text
              key={index}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isHighlighted ? highlightColor : labelColor}
              fontSize={12}
              className="font-light"
            >
              {item.label}
            </text>
          );
        })}
      </svg>
      {legendItems && legendItems.length > 0 && (
        <RadarLegend items={legendItems} />
      )}
    </div>
  );
};

type RadarChartComponentType = FC<RadarChartProps> & {
  Legend: typeof RadarLegend;
};

export const RadarChart = Object.assign(RadarChartComponent, {
  Legend: RadarLegend,
}) as RadarChartComponentType;

export default RadarChart;

