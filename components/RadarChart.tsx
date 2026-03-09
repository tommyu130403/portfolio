import type { FC } from "react";

export type RadarChartData = {
  /** 軸のラベル */
  label: string;
  /** 値（0-1の範囲、1が最大値） */
  value: number;
  /** この軸ラベルをハイライト色で表示するか */
  highlighted?: boolean;
};

export type RadarLegendItem = {
  /** 凡例ラベル */
  label: string;
  /** インジケーターの色 */
  color: string;
};

export type RadarChartProps = {
  /** 現在のスキルデータ */
  data: RadarChartData[];
  /** 目標スキルデータ（重ねて表示） */
  targetData?: RadarChartData[];
  /** チャートのサイズ（px）正方形の場合 */
  size?: number;
  /** SVGの幅（px）。省略時は size を使用 */
  width?: number;
  /** SVGの高さ（px）。省略時は size を使用 */
  height?: number;
  /** 現在スキルの塗り色 */
  fillColor?: string;
  /** 現在スキルのボーダー色 */
  borderColor?: string;
  /** ハイライトラベルの色 */
  highlightColor?: string;
  /** 通常ラベルの色 */
  labelColor?: string;
  /** 目標スキルのボーダー色 */
  targetBorderColor?: string;
  /** 凡例アイテム */
  legendItems?: RadarLegendItem[];
};

type RadarLegendProps = { items: RadarLegendItem[] };

const RadarLegend: FC<RadarLegendProps> = ({ items }) => {
  if (!items.length) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          <span style={{ color: item.color }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const RadarChartComponent: FC<RadarChartProps> = ({
  data,
  targetData,
  size = 500,
  width,
  height,
  fillColor = "#16352F",
  borderColor = "#48F4BE",
  highlightColor = "#48F4BE",
  labelColor = "#9E9E9E",
  targetBorderColor = "#616161",
  legendItems,
}) => {
  const svgWidth = width ?? size;
  const svgHeight = height ?? size;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const radius = Math.min(svgWidth, svgHeight) * 0.38;
  const numAxes = data.length || 1;
  const numGridLevels = 6;
  const angleStep = (2 * Math.PI) / numAxes;

  const gridColors = [
    "#616161",
    "#515151",
    "#424242",
    "#515151",
    "#3B3B3B",
    "#515151",
  ];

  const getPoint = (index: number, value: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = radius * value;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const makePolygonPath = (dataset: RadarChartData[]) => {
    const points = dataset.slice(0, numAxes).map((item, i) => getPoint(i, item.value));
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  };

  const currentPath = makePolygonPath(data);
  const targetPath = targetData ? makePolygonPath(targetData) : null;

  const getLabelPosition = (index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const labelRadius = radius * 1.28;
    return {
      x: centerX + labelRadius * Math.cos(angle),
      y: centerY + labelRadius * Math.sin(angle),
      angle,
    };
  };

  const getTextAnchor = (angle: number) => {
    const cos = Math.cos(angle);
    if (cos > 0.1) return "start";
    if (cos < -0.1) return "end";
    return "middle";
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="overflow-visible"
      >
        {/* グリッド（同心多角形） */}
        {Array.from({ length: numGridLevels }).map((_, level) => {
          const levelRadius = (radius * (level + 1)) / numGridLevels;
          const isDotted = level % 2 === 1;
          const points = Array.from({ length: numAxes }).map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            return {
              x: centerX + levelRadius * Math.cos(angle),
              y: centerY + levelRadius * Math.sin(angle),
            };
          });
          const gridPath =
            points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          return (
            <path
              key={level}
              d={gridPath}
              fill="none"
              stroke={gridColors[level]}
              strokeWidth={1}
              strokeDasharray={isDotted ? "2 2" : "0"}
              opacity={0.7}
            />
          );
        })}

        {/* 軸線 */}
        {Array.from({ length: numAxes }).map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          return (
            <line
              key={i}
              x1={centerX}
              y1={centerY}
              x2={centerX + radius * Math.cos(angle)}
              y2={centerY + radius * Math.sin(angle)}
              stroke="#424242"
              strokeWidth={1}
              opacity={0.4}
            />
          );
        })}

        {/* 目標ポリゴン（背面） */}
        {targetPath && (
          <>
            <path d={targetPath} fill="rgba(97,97,97,0.15)" />
            <path
              d={targetPath}
              fill="none"
              stroke={targetBorderColor}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.8}
            />
          </>
        )}

        {/* 現在スキルポリゴン（前面） */}
        <path d={currentPath} fill={fillColor} opacity={0.85} />
        <path d={currentPath} fill="none" stroke={borderColor} strokeWidth={2} />

        {/* ラベル */}
        {data.slice(0, numAxes).map((item, index) => {
          const { x, y, angle } = getLabelPosition(index);
          return (
            <text
              key={index}
              x={x}
              y={y}
              textAnchor={getTextAnchor(angle)}
              dominantBaseline="middle"
              fill={item.highlighted ? highlightColor : labelColor}
              fontSize={12}
              fontWeight={300}
            >
              {item.label}
            </text>
          );
        })}
      </svg>

      {legendItems && legendItems.length > 0 && <RadarLegend items={legendItems} />}
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
