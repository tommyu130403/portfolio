"use client";

import { memo } from "react";
import {
  BaseEdge,
  Handle,
  NodeResizer,
  Position,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  FLOWCHART_GRID_SIZE,
  FLOW_NODE_MIN_SIZE,
  snapFlowchartCoordinate,
  type FlowEdgeMarker,
  type FlowNodeColor,
  type FlowNodeData,
  type FlowNodeKind,
  type ReactFlowEdge,
} from "@/lib/flowchart";

type FlowchartReactNode = Node<FlowNodeData, FlowNodeKind>;
type Point = { x: number; y: number };

const EDGE_CORNER_RADIUS = 10;
const EDGE_COLOR = "#616161";
const EDGE_SELECTED_COLOR = "#48f4be";

const HANDLE_DIRECTIONS: Record<Position, Point> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
};

function gridLead(point: Point, position: Position): {
  lead: Point;
  grid: Point;
} {
  const direction = HANDLE_DIRECTIONS[position];
  if (direction.x !== 0) {
    const lead = {
      x: snapFlowchartCoordinate(
        point.x + direction.x * FLOWCHART_GRID_SIZE,
      ),
      y: point.y,
    };
    return {
      lead,
      grid: { x: lead.x, y: snapFlowchartCoordinate(point.y) },
    };
  }
  const lead = {
    x: point.x,
    y: snapFlowchartCoordinate(
      point.y + direction.y * FLOWCHART_GRID_SIZE,
    ),
  };
  return {
    lead,
    grid: { x: snapFlowchartCoordinate(point.x), y: lead.y },
  };
}

function compactOrthogonalPoints(points: Point[]) {
  const unique = points.filter(
    (point, index) =>
      index === 0 ||
      point.x !== points[index - 1].x ||
      point.y !== points[index - 1].y,
  );
  return unique.filter((point, index) => {
    if (index === 0 || index === unique.length - 1) return true;
    const previous = unique[index - 1];
    const next = unique[index + 1];
    return !(
      (previous.x === point.x && point.x === next.x) ||
      (previous.y === point.y && point.y === next.y)
    );
  });
}

function roundedOrthogonalPath(points: Point[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x} ${points[0].y}`;

  let path = `M${points[0].x} ${points[0].y}`;
  let current = points[0];
  const lineTo = (point: Point) => {
    if (point.x === current.x && point.y === current.y) return;
    path += ` L${point.x} ${point.y}`;
    current = point;
  };

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const incomingLength = Math.hypot(
      corner.x - previous.x,
      corner.y - previous.y,
    );
    const outgoingLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(
      EDGE_CORNER_RADIUS,
      incomingLength / 2,
      outgoingLength / 2,
    );
    const beforeCorner = {
      x: corner.x + ((previous.x - corner.x) / incomingLength) * radius,
      y: corner.y + ((previous.y - corner.y) / incomingLength) * radius,
    };
    const afterCorner = {
      x: corner.x + ((next.x - corner.x) / outgoingLength) * radius,
      y: corner.y + ((next.y - corner.y) / outgoingLength) * radius,
    };
    lineTo(beforeCorner);
    path += ` Q${corner.x} ${corner.y} ${afterCorner.x} ${afterCorner.y}`;
    current = afterCorner;
  }

  const last = points[points.length - 1];
  lineTo(last);
  return path;
}

function shouldUseStraightPath(
  source: Point,
  sourcePosition: Position,
  target: Point,
  targetPosition: Position,
) {
  const verticalPair =
    (sourcePosition === Position.Bottom &&
      targetPosition === Position.Top) ||
    (sourcePosition === Position.Top &&
      targetPosition === Position.Bottom);
  const horizontalPair =
    (sourcePosition === Position.Right &&
      targetPosition === Position.Left) ||
    (sourcePosition === Position.Left &&
      targetPosition === Position.Right);

  return (
    (verticalPair &&
      snapFlowchartCoordinate(source.x) ===
        snapFlowchartCoordinate(target.x)) ||
    (horizontalPair &&
      snapFlowchartCoordinate(source.y) ===
        snapFlowchartCoordinate(target.y))
  );
}

function EdgeMarkerDefinition({
  id,
  marker,
  color,
}: {
  id: string;
  marker: Exclude<FlowEdgeMarker, "none">;
  color: string;
}) {
  return (
    <marker
      id={id}
      markerWidth="12.5"
      markerHeight="12.5"
      viewBox="-10 -10 20 20"
      markerUnits="strokeWidth"
      orient="auto-start-reverse"
      refX="0"
      refY="0"
    >
      {marker === "arrow" ? (
        <polyline
          points="-5,-4 0,0 -5,4 -5,-4"
          fill={color}
          stroke={color}
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <circle
          cx="0"
          cy="0"
          r="3.8"
          fill={color}
          stroke="#101010"
          strokeWidth="1"
        />
      )}
    </marker>
  );
}

const GridEdge = memo(function GridEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  data,
  selected,
  style,
  interactionWidth,
}: EdgeProps<ReactFlowEdge>) {
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };
  const sourceRoute = gridLead(source, sourcePosition);
  const targetRoute = gridLead(target, targetPosition);
  const horizontalSource =
    sourcePosition === Position.Left ||
    sourcePosition === Position.Right;
  const middleX = snapFlowchartCoordinate(
    (sourceRoute.grid.x + targetRoute.grid.x) / 2,
  );
  const middleY = snapFlowchartCoordinate(
    (sourceRoute.grid.y + targetRoute.grid.y) / 2,
  );
  const middle = horizontalSource
    ? [
        { x: middleX, y: sourceRoute.grid.y },
        { x: middleX, y: targetRoute.grid.y },
      ]
    : [
        { x: sourceRoute.grid.x, y: middleY },
        { x: targetRoute.grid.x, y: middleY },
      ];
  const straightPath = shouldUseStraightPath(
    source,
    sourcePosition,
    target,
    targetPosition,
  );
  const points = straightPath
    ? [source, target]
    : compactOrthogonalPoints([
        source,
        sourceRoute.lead,
        sourceRoute.grid,
        ...middle,
        targetRoute.grid,
        targetRoute.lead,
        target,
      ]);
  const path = straightPath
    ? `M${source.x} ${source.y} L${target.x} ${target.y}`
    : roundedOrthogonalPath(points);
  const labelX = straightPath ? (source.x + target.x) / 2 : middleX;
  const labelY = straightPath ? (source.y + target.y) / 2 : middleY;
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sourceMarker = data?.sourceMarker ?? "none";
  const targetMarker = data?.targetMarker ?? "arrow";
  const markerColor = selected ? EDGE_SELECTED_COLOR : EDGE_COLOR;
  const sourceMarkerId = `flowchart-source-marker-${safeId}`;
  const targetMarkerId = `flowchart-target-marker-${safeId}`;
  const edgeStyle = selected
    ? {
        ...style,
        stroke: EDGE_SELECTED_COLOR,
        strokeWidth: 2.5,
        filter: "drop-shadow(0 0 3px rgba(72, 244, 190, 0.65))",
      }
    : style;

  return (
    <>
      <defs>
        {sourceMarker !== "none" && (
          <EdgeMarkerDefinition
            id={sourceMarkerId}
            marker={sourceMarker}
            color={markerColor}
          />
        )}
        {targetMarker !== "none" && (
          <EdgeMarkerDefinition
            id={targetMarkerId}
            marker={targetMarker}
            color={markerColor}
          />
        )}
      </defs>
      <BaseEdge
        id={id}
        path={path}
        labelX={labelX}
        labelY={labelY}
        label={label}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        style={edgeStyle}
        markerStart={
          sourceMarker === "none" ? undefined : `url(#${sourceMarkerId})`
        }
        markerEnd={
          targetMarker === "none" ? undefined : `url(#${targetMarkerId})`
        }
        interactionWidth={interactionWidth}
      />
    </>
  );
});

function Ports() {
  return (
    <>
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-[#161616] !bg-system-500"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-[#161616] !bg-system-500"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-[#161616] !bg-main-100"
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-[#161616] !bg-system-500"
      />
    </>
  );
}

const VERTICAL_JUSTIFY: Record<FlowNodeData["verticalAlign"], string> = {
  top: "justify-start",
  middle: "justify-center",
  bottom: "justify-end",
};

const NODE_COLOR_CLASS: Record<
  Exclude<FlowNodeColor, "default">,
  { surface: string; mutedText: string }
> = {
  primary: {
    surface: "border-main-100 bg-main-100 text-[#0a0a0a]",
    mutedText: "text-main-700",
  },
  secondary: {
    surface: "border-main-100 bg-[#0a2218] text-main-100",
    mutedText: "text-main-050",
  },
};

function nodeSurfaceClass(color: FlowNodeColor, defaultClassName: string) {
  return color === "default"
    ? defaultClassName
    : NODE_COLOR_CLASS[color].surface;
}

function nodeMutedTextClass(
  color: FlowNodeColor,
  defaultClassName: string,
) {
  return color === "default"
    ? defaultClassName
    : NODE_COLOR_CLASS[color].mutedText;
}

function ResizeHandles({
  kind,
  selected,
}: {
  kind: FlowNodeKind;
  selected: boolean;
}) {
  const decision = kind === "decision";
  const minimum = FLOW_NODE_MIN_SIZE[kind];
  return (
    <NodeResizer
      isVisible={selected}
      color={EDGE_SELECTED_COLOR}
      minWidth={minimum.width}
      minHeight={minimum.height}
      maxWidth={1200}
      maxHeight={800}
      keepAspectRatio={decision}
      handleStyle={{
        width: 9,
        height: 9,
        border: "1px solid #101010",
        borderRadius: 3,
      }}
      lineStyle={{ borderWidth: 1 }}
    />
  );
}

function NodeText({
  data,
  mutedClassName = "text-fg-muted",
}: {
  data: FlowNodeData;
  mutedClassName?: string;
}) {
  const sublabelSize = Math.max(8, data.fontSize - 3);
  return (
    <>
      <p
        className="font-bold leading-[1.4] tracking-[0.03em]"
        style={{ fontSize: data.fontSize, textAlign: data.textAlign }}
      >
        {data.label}
      </p>
      {data.sublabel && (
        <p
          className={`mt-1 leading-[1.45] tracking-[0.03em] ${nodeMutedTextClass(
            data.color,
            mutedClassName,
          )}`}
          style={{ fontSize: sublabelSize, textAlign: data.textAlign }}
        >
          {data.sublabel}
        </p>
      )}
    </>
  );
}

function Frame({
  data,
  kind,
  shapeClassName,
  className,
  selected,
}: {
  data: FlowNodeData;
  kind: FlowNodeKind;
  shapeClassName: string;
  className: string;
  selected: boolean;
}) {
  return (
    <div
      className={`relative flex h-full w-full flex-col px-5 py-2 ${VERTICAL_JUSTIFY[data.verticalAlign]} ${shapeClassName} ${nodeSurfaceClass(data.color, className)} ${
        selected ? "ring-2 ring-main-100 ring-offset-2 ring-offset-[#101010]" : ""
      }`}
    >
      <ResizeHandles kind={kind} selected={selected} />
      <Ports />
      <NodeText data={data} />
    </div>
  );
}

const StartNode = memo(function StartNode({
  data,
  selected,
}: NodeProps<FlowchartReactNode>) {
  return (
    <Frame
      data={data}
      kind="start"
      selected={selected}
      shapeClassName="rounded-full border"
      className="border-border bg-surface text-fg"
    />
  );
});

const EndNode = memo(function EndNode({
  data,
  selected,
}: NodeProps<FlowchartReactNode>) {
  return (
    <Frame
      data={data}
      kind="end"
      selected={selected}
      shapeClassName="rounded-full border"
      className="border-border bg-surface text-fg"
    />
  );
});

const StepNode = memo(function StepNode({
  data,
  selected,
}: NodeProps<FlowchartReactNode>) {
  return (
    <Frame
      data={data}
      kind="step"
      selected={selected}
      shapeClassName="rounded-[12px] border shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
      className="border-[#2a2a2a] bg-[#161616] text-white"
    />
  );
});

const NoteNode = memo(function NoteNode({
  data,
  selected,
}: NodeProps<FlowchartReactNode>) {
  return (
    <Frame
      data={data}
      kind="note"
      selected={selected}
      shapeClassName="rounded-[12px] border border-dashed"
      className="border-border bg-surface-light text-fg-muted"
    />
  );
});

const CardNode = memo(function CardNode({
  data,
  selected,
}: NodeProps<FlowchartReactNode>) {
  const sublabelSize = Math.max(8, data.fontSize - 2);
  const alignStyle = {
    textAlign: data.textAlign,
  } as const;
  const verticalClass = VERTICAL_JUSTIFY[data.verticalAlign];
  const title = (
    <p
      className="relative z-[1] font-bold leading-[1.45] tracking-[0.03em]"
      style={{ ...alignStyle, fontSize: data.fontSize }}
    >
      {data.label}
    </p>
  );
  const body = data.sublabel ? (
    <p
      className={`relative z-[1] whitespace-pre-wrap leading-[1.65] tracking-[0.03em] ${nodeMutedTextClass(
        data.color,
        "text-fg-caption",
      )}`}
      style={{ ...alignStyle, fontSize: sublabelSize }}
    >
      {data.sublabel}
    </p>
  ) : null;

  return (
    <div
      className={`relative h-full min-h-[80px] w-full min-w-[160px] rounded-[14px] border px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.2)] ${nodeSurfaceClass(
        data.color,
        "border-border bg-surface text-fg",
      )} ${
        selected ? "ring-2 ring-main-100 ring-offset-2 ring-offset-[#101010]" : ""
      }`}
    >
      <ResizeHandles kind="card" selected={selected} />
      <Ports />
      {data.divider === "vertical" ? (
        <div className="grid h-full grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-4">
          <div className={`flex min-w-0 flex-col ${verticalClass}`}>
            {title}
          </div>
          <div className="bg-system-800" aria-hidden />
          <div className={`flex min-w-0 flex-col ${verticalClass}`}>
            {body}
          </div>
        </div>
      ) : data.divider === "horizontal" ? (
        <div className="flex h-full flex-col">
          <div className={`flex min-h-0 flex-1 flex-col ${verticalClass}`}>
            {title}
          </div>
          <div className="my-3 h-px shrink-0 bg-system-800" aria-hidden />
          <div className={`flex min-h-0 flex-1 flex-col ${verticalClass}`}>
            {body}
          </div>
        </div>
      ) : (
        <div className={`flex h-full flex-col ${verticalClass}`}>
          {title}
          {body && <div className="mt-2">{body}</div>}
        </div>
      )}
    </div>
  );
});

const DecisionNode = memo(function DecisionNode({
  data,
  selected,
}: NodeProps<FlowchartReactNode>) {
  return (
    <div
      className={`relative flex h-full min-h-[120px] w-full min-w-[120px] items-center justify-center rounded-[12px] ${
        selected ? "ring-2 ring-main-100 ring-offset-2 ring-offset-[#101010]" : ""
      }`}
    >
      <ResizeHandles kind="decision" selected={selected} />
      <Ports />
      <div
        className={`absolute inset-[15%] rotate-45 rounded-[8px] border ${nodeSurfaceClass(
          data.color,
          "border-system-700 bg-[#242424] text-fg",
        )}`}
      />
      <div
        className={`relative z-[1] flex h-full w-full max-w-[70%] flex-col px-2 py-[20%] ${VERTICAL_JUSTIFY[data.verticalAlign]} ${
          data.color === "primary"
            ? "text-[#0a0a0a]"
            : data.color === "secondary"
              ? "text-main-100"
              : "text-fg"
        }`}
      >
        <NodeText data={data} />
      </div>
    </div>
  );
});

export const flowchartNodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  step: StepNode,
  decision: DecisionNode,
  note: NoteNode,
  card: CardNode,
};

export const flowchartEdgeTypes: EdgeTypes = {
  grid: GridEdge,
};
