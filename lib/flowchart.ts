import type { Edge, Node } from "@xyflow/react";
import { supabase } from "@/src/lib/supabase";

export type FlowNodeKind =
  | "start"
  | "end"
  | "step"
  | "decision"
  | "note"
  | "card";

export type FlowHandlePosition = "top" | "right" | "bottom" | "left";
export type FlowTextAlign = "left" | "center" | "right";
export type FlowVerticalAlign = "top" | "middle" | "bottom";
export type FlowCardDivider = "none" | "horizontal" | "vertical";
export type FlowEdgeMarker = "none" | "arrow" | "circle";
export type FlowNodeColor = "default" | "primary" | "secondary";

export type FlowNode = {
  id: string;
  kind: FlowNodeKind;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  fontSize?: number;
  textAlign?: FlowTextAlign;
  verticalAlign?: FlowVerticalAlign;
  divider?: FlowCardDivider;
  color?: FlowNodeColor;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: FlowHandlePosition;
  targetHandle?: FlowHandlePosition;
  label?: string;
  dashed?: boolean;
  sourceMarker?: FlowEdgeMarker;
  targetMarker?: FlowEdgeMarker;
};

export type FlowchartData = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type FlowNodeData = {
  kind: FlowNodeKind;
  label: string;
  sublabel?: string;
  fontSize: number;
  textAlign: FlowTextAlign;
  verticalAlign: FlowVerticalAlign;
  divider: FlowCardDivider;
  color: FlowNodeColor;
};

export type ReactFlowNode = Node<FlowNodeData, FlowNodeKind>;
export type FlowEdgeData = {
  dashed: boolean;
  sourceMarker: FlowEdgeMarker;
  targetMarker: FlowEdgeMarker;
};
export type ReactFlowEdge = Edge<FlowEdgeData>;

export const FLOWCHART_GRID_SIZE = 20;
export const FLOWCHART_DEFAULT_FONT_SIZE = 14;
export const FLOWCHART_MIN_FONT_SIZE = 8;
export const FLOWCHART_MAX_FONT_SIZE = 72;
export const FLOW_NODE_DEFAULT_SIZE: Record<
  FlowNodeKind,
  { width: number; height: number }
> = {
  start: { width: 160, height: 60 },
  end: { width: 160, height: 60 },
  step: { width: 160, height: 60 },
  decision: { width: 160, height: 160 },
  note: { width: 160, height: 60 },
  card: { width: 280, height: 120 },
};
export const FLOW_NODE_MIN_SIZE: Record<
  FlowNodeKind,
  { width: number; height: number }
> = {
  start: { width: 100, height: 40 },
  end: { width: 100, height: 40 },
  step: { width: 100, height: 40 },
  decision: { width: 120, height: 120 },
  note: { width: 100, height: 40 },
  card: { width: 160, height: 80 },
};
export const FLOWCHART_SNAP_GRID: [number, number] = [
  FLOWCHART_GRID_SIZE,
  FLOWCHART_GRID_SIZE,
];

export function snapFlowchartCoordinate(value: number) {
  return FLOWCHART_GRID_SIZE * Math.round(value / FLOWCHART_GRID_SIZE);
}

const FLOW_NODE_KINDS: FlowNodeKind[] = [
  "start",
  "end",
  "step",
  "decision",
  "note",
  "card",
];

const FLOW_HANDLE_POSITIONS: FlowHandlePosition[] = [
  "top",
  "right",
  "bottom",
  "left",
];
const FLOW_TEXT_ALIGNS: FlowTextAlign[] = ["left", "center", "right"];
const FLOW_VERTICAL_ALIGNS: FlowVerticalAlign[] = [
  "top",
  "middle",
  "bottom",
];
const FLOW_CARD_DIVIDERS: FlowCardDivider[] = [
  "none",
  "horizontal",
  "vertical",
];
const FLOW_EDGE_MARKERS: FlowEdgeMarker[] = ["none", "arrow", "circle"];
const FLOW_NODE_COLORS: FlowNodeColor[] = [
  "default",
  "primary",
  "secondary",
];

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function parsePositiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function parseFontSize(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(
        FLOWCHART_MAX_FONT_SIZE,
        Math.max(FLOWCHART_MIN_FONT_SIZE, number),
      )
    : undefined;
}

export function isFlowHandlePosition(
  value: unknown,
): value is FlowHandlePosition {
  return (
    typeof value === "string" &&
    FLOW_HANDLE_POSITIONS.includes(value as FlowHandlePosition)
  );
}

export function parseFlowchart(raw: unknown): FlowchartData | null {
  const obj = (raw ?? null) as Record<string, unknown> | null;
  if (!obj || !Array.isArray(obj.nodes)) return null;

  const nodes = (obj.nodes as unknown[])
    .map((node): FlowNode | null => {
      const o = (node ?? {}) as Record<string, unknown>;
      if (
        typeof o.id !== "string" ||
        typeof o.kind !== "string" ||
        !FLOW_NODE_KINDS.includes(o.kind as FlowNodeKind) ||
        typeof o.label !== "string"
      ) {
        return null;
      }
      return {
        id: o.id,
        kind: o.kind as FlowNodeKind,
        label: o.label,
        sublabel: typeof o.sublabel === "string" ? o.sublabel : undefined,
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        w: parsePositiveNumber(o.w),
        h: parsePositiveNumber(o.h),
        fontSize: parseFontSize(o.fontSize),
        textAlign: isOneOf(o.textAlign, FLOW_TEXT_ALIGNS)
          ? o.textAlign
          : undefined,
        verticalAlign: isOneOf(o.verticalAlign, FLOW_VERTICAL_ALIGNS)
          ? o.verticalAlign
          : undefined,
        divider: isOneOf(o.divider, FLOW_CARD_DIVIDERS)
          ? o.divider
          : undefined,
        color: isOneOf(o.color, FLOW_NODE_COLORS) ? o.color : undefined,
      };
    })
    .filter((node): node is FlowNode => node !== null);

  if (nodes.length === 0) return null;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(obj.edges) ? obj.edges : [])
    .map((edge): FlowEdge | null => {
      const o = (edge ?? {}) as Record<string, unknown>;
      if (
        typeof o.id !== "string" ||
        typeof o.source !== "string" ||
        typeof o.target !== "string" ||
        !nodeIds.has(o.source) ||
        !nodeIds.has(o.target)
      ) {
        return null;
      }
      return {
        id: o.id,
        source: o.source,
        target: o.target,
        sourceHandle: isFlowHandlePosition(o.sourceHandle)
          ? o.sourceHandle
          : undefined,
        targetHandle: isFlowHandlePosition(o.targetHandle)
          ? o.targetHandle
          : undefined,
        label: typeof o.label === "string" ? o.label : undefined,
        dashed: o.dashed === true,
        sourceMarker: isOneOf(o.sourceMarker, FLOW_EDGE_MARKERS)
          ? o.sourceMarker
          : undefined,
        targetMarker: isOneOf(o.targetMarker, FLOW_EDGE_MARKERS)
          ? o.targetMarker
          : undefined,
      };
    })
    .filter((edge): edge is FlowEdge => edge !== null);

  return { nodes, edges };
}

export function toReactFlow(data: FlowchartData): {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
} {
  return {
    nodes: data.nodes.map((node) => {
      const defaults = FLOW_NODE_DEFAULT_SIZE[node.kind];
      const width = node.w ?? defaults.width;
      const height = node.h ?? defaults.height;
      const style = {
        width,
        height,
      };
      return {
        id: node.id,
        type: node.kind,
        position: {
          x: snapFlowchartCoordinate(node.x),
          y: snapFlowchartCoordinate(node.y),
        },
        data: {
          kind: node.kind,
          label: node.label,
          sublabel: node.sublabel,
          fontSize: node.fontSize ?? FLOWCHART_DEFAULT_FONT_SIZE,
          textAlign: node.textAlign ?? "center",
          verticalAlign: node.verticalAlign ?? "middle",
          divider: node.divider ?? "none",
          color: node.color ?? "default",
        },
        width,
        height,
        style,
      };
    }),
    edges: data.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? "bottom",
      targetHandle: edge.targetHandle ?? "top",
      label: edge.label,
      type: "grid",
      style: {
        stroke: "#616161",
        strokeWidth: 1.5,
        ...(edge.dashed ? { strokeDasharray: "6 5" } : {}),
      },
      data: {
        dashed: edge.dashed === true,
        sourceMarker: edge.sourceMarker ?? "none",
        targetMarker: edge.targetMarker ?? "arrow",
      },
    })),
  };
}

export function fromReactFlow(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
): FlowchartData {
  return {
    nodes: nodes.map((node) => {
      const width =
        typeof node.width === "number"
          ? node.width
          : typeof node.style?.width === "number"
            ? node.style.width
            : undefined;
      const height =
        typeof node.height === "number"
          ? node.height
          : typeof node.style?.height === "number"
            ? node.style.height
            : undefined;
      return {
        id: node.id,
        kind: node.data.kind,
        label: node.data.label,
        sublabel: node.data.sublabel || undefined,
        x: node.position.x,
        y: node.position.y,
        w: width,
        h: height,
        fontSize: node.data.fontSize,
        textAlign: node.data.textAlign,
        verticalAlign: node.data.verticalAlign,
        color: node.data.color,
        ...(node.data.kind === "card"
          ? { divider: node.data.divider }
          : {}),
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: isFlowHandlePosition(edge.sourceHandle)
        ? edge.sourceHandle
        : undefined,
      targetHandle: isFlowHandlePosition(edge.targetHandle)
        ? edge.targetHandle
        : undefined,
      label: typeof edge.label === "string" ? edge.label : undefined,
      dashed:
        (edge.data as { dashed?: boolean } | undefined)?.dashed === true,
      sourceMarker: edge.data?.sourceMarker ?? "none",
      targetMarker: edge.data?.targetMarker ?? "arrow",
    })),
  };
}

export const DEFAULT_FLOWCHART: FlowchartData = {
  nodes: [
    { id: "start", kind: "start", label: "開始", x: 120, y: 40 },
    { id: "step", kind: "step", label: "処理", x: 100, y: 190 },
    { id: "end", kind: "end", label: "終了", x: 120, y: 350 },
  ],
  edges: [
    {
      id: "start-step",
      source: "start",
      target: "step",
      sourceHandle: "bottom",
      targetHandle: "top",
    },
    {
      id: "step-end",
      source: "step",
      target: "end",
      sourceHandle: "bottom",
      targetHandle: "top",
    },
  ],
};

const flowchartFetchCache = new Map<
  string,
  Promise<FlowchartData | null>
>();

export function clearFlowchartCache(id?: string) {
  if (id) flowchartFetchCache.delete(id);
  else flowchartFetchCache.clear();
}

export function fetchFlowchart(id: string): Promise<FlowchartData | null> {
  const cached = flowchartFetchCache.get(id);
  if (cached) return cached;

  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from("flowcharts")
        .select("data")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        flowchartFetchCache.delete(id);
        return null;
      }
      if (!data) return null;
      return parseFlowchart(data.data);
    } catch {
      flowchartFetchCache.delete(id);
      return null;
    }
  })();

  flowchartFetchCache.set(id, request);
  return request;
}
