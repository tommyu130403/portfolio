"use client";

import "@xyflow/react/dist/style.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type FinalConnectionState,
  type HandleType,
  type NodeChange,
  type OnReconnect,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AdminShell,
  FieldLabel,
  Input,
  SaveButton,
} from "../../AdminLayout";
import { getFlowchart, saveFlowchart } from "../../actions";
import {
  flowchartEdgeTypes,
  flowchartNodeTypes,
} from "@/components/FlowchartNodes";
import {
  DEFAULT_FLOWCHART,
  FLOWCHART_DEFAULT_FONT_SIZE,
  FLOWCHART_GRID_SIZE,
  FLOWCHART_MAX_FONT_SIZE,
  FLOWCHART_MIN_FONT_SIZE,
  FLOWCHART_SNAP_GRID,
  FLOW_NODE_DEFAULT_SIZE,
  FLOW_NODE_MIN_SIZE,
  fromReactFlow,
  isFlowHandlePosition,
  parseFlowchart,
  snapFlowchartCoordinate,
  toReactFlow,
  type FlowCardDivider,
  type FlowEdgeMarker,
  type FlowHandlePosition,
  type FlowNodeColor,
  type FlowNodeKind,
  type FlowTextAlign,
  type FlowVerticalAlign,
  type ReactFlowEdge,
  type ReactFlowNode,
} from "@/lib/flowchart";

const NODE_OPTIONS: {
  kind: FlowNodeKind;
  label: string;
  defaultLabel: string;
}[] = [
  { kind: "start", label: "開始", defaultLabel: "開始" },
  { kind: "step", label: "処理", defaultLabel: "新しい処理" },
  { kind: "decision", label: "分岐", defaultLabel: "条件" },
  { kind: "end", label: "終了", defaultLabel: "終了" },
  { kind: "note", label: "注記", defaultLabel: "注記" },
  { kind: "card", label: "カード", defaultLabel: "カードタイトル" },
];

const HANDLE_OPTIONS: {
  value: FlowHandlePosition;
  label: string;
}[] = [
  { value: "top", label: "上" },
  { value: "right", label: "右" },
  { value: "bottom", label: "下" },
  { value: "left", label: "左" },
];

const MARKER_OPTIONS: { value: FlowEdgeMarker; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "arrow", label: "矢印" },
  { value: "circle", label: "丸" },
];

const FONT_SIZE_PRESETS = [
  { label: "小", value: 12 },
  { label: "中", value: FLOWCHART_DEFAULT_FONT_SIZE },
  { label: "大", value: 18 },
] as const;

const NODE_COLOR_OPTIONS: {
  value: FlowNodeColor;
  label: string;
  swatchClassName: string;
}[] = [
  {
    value: "default",
    label: "標準",
    swatchClassName: "border-border bg-surface",
  },
  {
    value: "primary",
    label: "Primary",
    swatchClassName: "border-primary bg-primary",
  },
  {
    value: "secondary",
    label: "Secondary",
    swatchClassName: "border-main-100 bg-[#0a2218]",
  },
];

type LayoutAction =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "distribute-horizontal"
  | "distribute-vertical";

const LAYOUT_ACTIONS: {
  action: LayoutAction;
  label: string;
  minNodes: number;
}[] = [
  { action: "left", label: "左揃え", minNodes: 2 },
  { action: "center", label: "左右中央", minNodes: 2 },
  { action: "right", label: "右揃え", minNodes: 2 },
  { action: "top", label: "上揃え", minNodes: 2 },
  { action: "middle", label: "上下中央", minNodes: 2 },
  { action: "bottom", label: "下揃え", minNodes: 2 },
  { action: "distribute-horizontal", label: "横等間隔", minNodes: 3 },
  { action: "distribute-vertical", label: "縦等間隔", minNodes: 3 },
];

function nodeSize(node: ReactFlowNode) {
  const defaults = FLOW_NODE_DEFAULT_SIZE[node.data.kind];
  return {
    width:
      node.width ??
      (typeof node.style?.width === "number"
        ? node.style.width
        : node.measured?.width ?? defaults.width),
    height:
      node.height ??
      (typeof node.style?.height === "number"
        ? node.style.height
        : node.measured?.height ?? defaults.height),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function edgeAppearance(
  dashed: boolean,
  sourceMarker: FlowEdgeMarker = "none",
  targetMarker: FlowEdgeMarker = "arrow",
) {
  return {
    type: "grid",
    style: {
      stroke: "#616161",
      strokeWidth: 1.5,
      ...(dashed ? { strokeDasharray: "6 5" } : {}),
    },
    data: { dashed, sourceMarker, targetMarker },
  };
}

function FlowchartEditorInner({
  flowchartId,
}: {
  flowchartId: string;
}) {
  const router = useRouter();
  const isNew = flowchartId === "new";
  const initialGraph = useMemo(() => toReactFlow(DEFAULT_FLOWCHART), []);
  const defaultEdgeOptions = useMemo(() => edgeAppearance(false), []);
  const [nodes, setNodes, applyNodeChanges] =
    useNodesState<ReactFlowNode>(initialGraph.nodes);
  const [edges, setEdges, applyEdgeChanges] =
    useEdgesState<ReactFlowEdge>(initialGraph.edges);
  const [title, setTitle] = useState("新しいフローチャート");
  const [description, setDescription] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<
    { type: "node" | "edge"; id: string } | null
  >(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow<ReactFlowNode, ReactFlowEdge>();

  useEffect(() => {
    if (isNew) return;
    let active = true;
    getFlowchart(flowchartId).then((result) => {
      if (!active) return;
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      if (!result.data) {
        setMissing(true);
        setLoading(false);
        return;
      }
      const parsed = parseFlowchart(result.data.data);
      if (!parsed) {
        setError("保存データを読み込めませんでした");
        setLoading(false);
        return;
      }
      const graph = toReactFlow(parsed);
      setTitle(result.data.title);
      setDescription(result.data.description ?? "");
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [flowchartId, isNew, setEdges, setNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<ReactFlowNode>[]) => {
      const normalizedChanges = changes.map((change) =>
        change.type === "dimensions" &&
        change.resizing === false &&
        change.dimensions
          ? {
              ...change,
              setAttributes: true as const,
              dimensions: {
                width: Math.max(
                  FLOWCHART_GRID_SIZE,
                  snapFlowchartCoordinate(change.dimensions.width),
                ),
                height: Math.max(
                  FLOWCHART_GRID_SIZE,
                  snapFlowchartCoordinate(change.dimensions.height),
                ),
              },
            }
          : change,
      );
      applyNodeChanges(normalizedChanges);
      const resizedIds = new Set(
        changes.flatMap((change) =>
          change.type === "dimensions" && change.resizing === false
            ? [change.id]
            : [],
        ),
      );
      if (resizedIds.size > 0) {
        setNodes((current) =>
          current.map((node) =>
            resizedIds.has(node.id)
              ? {
                  ...node,
                  position: {
                    x: snapFlowchartCoordinate(node.position.x),
                    y: snapFlowchartCoordinate(node.position.y),
                  },
                  style: {
                    ...node.style,
                    ...(typeof node.width === "number"
                      ? { width: node.width }
                      : {}),
                    ...(typeof node.height === "number"
                      ? { height: node.height }
                      : {}),
                  },
                }
              : node,
          ),
        );
      }
      if (
        changes.some(
          (change) =>
            ["add", "remove", "position"].includes(change.type) ||
            (change.type === "dimensions" &&
              (change.resizing !== undefined || change.setAttributes)),
        )
      ) {
        setDirty(true);
        setSaved(false);
      }
    },
    [applyNodeChanges, setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<ReactFlowEdge>[]) => {
      applyEdgeChanges(changes);
      if (
        changes.some((change) => ["add", "remove"].includes(change.type))
      ) {
        setDirty(true);
        setSaved(false);
      }
    },
    [applyEdgeChanges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            ...edgeAppearance(false),
          },
          current,
        ),
      );
      setDirty(true);
      setSaved(false);
    },
    [setEdges],
  );

  const enableReconnect = useCallback<OnReconnect<ReactFlowEdge>>(() => {
    // The final drop target is applied in onReconnectEnd so loose-mode handles
    // cannot swap the semantic source and target endpoints.
  }, []);

  const onReconnectEnd = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      edge: ReactFlowEdge,
      handleType: HandleType,
      connectionState: FinalConnectionState,
    ) => {
      // React Flow reports the fixed opposite handle type. The dropped node
      // and side are consistently exposed as the `to` endpoint.
      const reconnectingEnd =
        handleType === "source" ? ("target" as const) : ("source" as const);
      const nextNodeId = connectionState.toNode?.id;
      const nextHandleId = connectionState.toHandle?.id;
      if (
        connectionState.isValid !== true ||
        !nextNodeId ||
        !isFlowHandlePosition(nextHandleId)
      ) {
        return;
      }

      const changed =
        reconnectingEnd === "source"
          ? edge.source !== nextNodeId || edge.sourceHandle !== nextHandleId
          : edge.target !== nextNodeId || edge.targetHandle !== nextHandleId;
      if (!changed) return;

      setEdges((current) =>
        current.map((currentEdge) =>
          currentEdge.id === edge.id
            ? {
                ...currentEdge,
                ...(reconnectingEnd === "source"
                  ? { source: nextNodeId, sourceHandle: nextHandleId }
                  : { target: nextNodeId, targetHandle: nextHandleId }),
              }
            : currentEdge,
        ),
      );
      setSelected({ type: "edge", id: edge.id });
      setDirty(true);
      setSaved(false);
    },
    [setEdges],
  );

  const addNode = (kind: FlowNodeKind, defaultLabel: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const position = rect
      ? screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      : { x: 200, y: 160 };
    const id = crypto.randomUUID();
    const size = FLOW_NODE_DEFAULT_SIZE[kind];
    setNodes((current) => [
      ...current,
      {
        id,
        type: kind,
        position: {
          x: snapFlowchartCoordinate(position.x - size.width / 2),
          y: snapFlowchartCoordinate(position.y - size.height / 2),
        },
        data: {
          kind,
          label: defaultLabel,
          fontSize: FLOWCHART_DEFAULT_FONT_SIZE,
          textAlign: "center",
          verticalAlign: "middle",
          divider: "none",
          color: "default",
        },
        width: size.width,
        height: size.height,
        style: {
          width: size.width,
          height: size.height,
        },
        selected: true,
      },
    ]);
    setSelected({ type: "node", id });
    setDirty(true);
    setSaved(false);
  };

  const patchNode = (
    id: string,
    patch: Partial<ReactFlowNode["data"]>,
  ) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== id) return node;
        const data = { ...node.data, ...patch };
        const style =
          patch.kind === "card" && node.data.kind !== "card"
            ? {
                ...node.style,
                width: Math.max(nodeSize(node).width, 280),
                height: Math.max(nodeSize(node).height, 112),
              }
            : patch.kind &&
                patch.kind !== "card" &&
                node.data.kind === "card"
              ? { ...node.style }
              : node.style;
        return {
          ...node,
          type: data.kind,
          data,
          style,
          ...(style && typeof style.width === "number"
            ? { width: style.width }
            : {}),
          ...(style && typeof style.height === "number"
            ? { height: style.height }
            : {}),
        };
      }),
    );
    setDirty(true);
    setSaved(false);
  };

  const patchNodeSize = (
    id: string,
    dimension: "width" | "height",
    value: number,
  ) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === id
          ? {
              ...node,
              [dimension]: value,
              style: { ...node.style, [dimension]: value },
            }
          : node,
      ),
    );
    setDirty(true);
    setSaved(false);
  };

  const patchEdge = (
    id: string,
    patch: {
      label?: string;
      dashed?: boolean;
      sourceHandle?: FlowHandlePosition;
      targetHandle?: FlowHandlePosition;
      sourceMarker?: FlowEdgeMarker;
      targetMarker?: FlowEdgeMarker;
    },
  ) => {
    setEdges((current) =>
      current.map((edge) => {
        if (edge.id !== id) return edge;
        const dashed =
          patch.dashed ??
          (edge.data?.dashed === true);
        const sourceMarker =
          patch.sourceMarker ?? edge.data?.sourceMarker ?? "none";
        const targetMarker =
          patch.targetMarker ?? edge.data?.targetMarker ?? "arrow";
        return {
          ...edge,
          ...(patch.label !== undefined ? { label: patch.label } : {}),
          ...(patch.sourceHandle !== undefined
            ? { sourceHandle: patch.sourceHandle }
            : {}),
          ...(patch.targetHandle !== undefined
            ? { targetHandle: patch.targetHandle }
            : {}),
          ...edgeAppearance(dashed, sourceMarker, targetMarker),
        };
      }),
    );
    setDirty(true);
    setSaved(false);
  };

  const alignNodes = (action: LayoutAction) => {
    setNodes((current) => {
      const selectedNodes = current.filter((node) => node.selected);
      const targets = selectedNodes.length >= 2 ? selectedNodes : current;
      const minimum = action.startsWith("distribute") ? 3 : 2;
      if (targets.length < minimum) return current;

      const ids = new Set(targets.map((node) => node.id));
      const metrics = targets.map((node) => ({
        node,
        ...nodeSize(node),
      }));
      const left = Math.min(...metrics.map(({ node }) => node.position.x));
      const right = Math.max(
        ...metrics.map(({ node, width }) => node.position.x + width),
      );
      const top = Math.min(...metrics.map(({ node }) => node.position.y));
      const bottom = Math.max(
        ...metrics.map(({ node, height }) => node.position.y + height),
      );
      const positions = new Map<string, { x: number; y: number }>();

      if (action === "distribute-horizontal") {
        const sorted = [...metrics].sort(
          (a, b) => a.node.position.x - b.node.position.x,
        );
        const totalWidth = sorted.reduce((sum, item) => sum + item.width, 0);
        const gap = Math.max(
          FLOWCHART_GRID_SIZE,
          snapFlowchartCoordinate(
            (right - left - totalWidth) / (sorted.length - 1),
          ),
        );
        let cursor = left;
        sorted.forEach((item) => {
          positions.set(item.node.id, {
            x: snapFlowchartCoordinate(cursor),
            y: item.node.position.y,
          });
          cursor += item.width + gap;
        });
      } else if (action === "distribute-vertical") {
        const sorted = [...metrics].sort(
          (a, b) => a.node.position.y - b.node.position.y,
        );
        const totalHeight = sorted.reduce((sum, item) => sum + item.height, 0);
        const gap = Math.max(
          FLOWCHART_GRID_SIZE,
          snapFlowchartCoordinate(
            (bottom - top - totalHeight) / (sorted.length - 1),
          ),
        );
        let cursor = top;
        sorted.forEach((item) => {
          positions.set(item.node.id, {
            x: item.node.position.x,
            y: snapFlowchartCoordinate(cursor),
          });
          cursor += item.height + gap;
        });
      } else {
        metrics.forEach(({ node, width, height }) => {
          let x = node.position.x;
          let y = node.position.y;
          if (action === "left") x = left;
          if (action === "center") x = (left + right - width) / 2;
          if (action === "right") x = right - width;
          if (action === "top") y = top;
          if (action === "middle") y = (top + bottom - height) / 2;
          if (action === "bottom") y = bottom - height;
          positions.set(node.id, {
            x: snapFlowchartCoordinate(x),
            y: snapFlowchartCoordinate(y),
          });
        });
      }

      return current.map((node) =>
        ids.has(node.id)
          ? { ...node, position: positions.get(node.id) ?? node.position }
          : node,
      );
    });
    setDirty(true);
    setSaved(false);
  };

  const selectedNode =
    selected?.type === "node"
      ? nodes.find((node) => node.id === selected.id) ?? null
      : null;
  const selectedEdge =
    selected?.type === "edge"
      ? edges.find((edge) => edge.id === selected.id) ?? null
      : null;
  const selectedNodeSize = selectedNode ? nodeSize(selectedNode) : null;
  const selectedNodeMinimum = selectedNode
    ? FLOW_NODE_MIN_SIZE[selectedNode.data.kind]
    : null;
  const selectedNodeCount = nodes.filter((node) => node.selected).length;
  const layoutTargetCount =
    selectedNodeCount >= 2 ? selectedNodeCount : nodes.length;

  const handleSelectionChange = useCallback<
    OnSelectionChangeFunc<ReactFlowNode, ReactFlowEdge>
  >(({ nodes: nextNodes, edges: nextEdges }) => {
    const next = nextNodes[0]
      ? { type: "node" as const, id: nextNodes[0].id }
      : nextEdges[0]
        ? { type: "edge" as const, id: nextEdges[0].id }
        : null;
    setSelected((current) =>
      current?.type === next?.type && current?.id === next?.id
        ? current
        : next,
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const result = await saveFlowchart({
      ...(!isNew ? { id: flowchartId } : {}),
      title,
      description,
      data: fromReactFlow(nodes, edges),
    });
    setSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? "保存に失敗しました");
      return;
    }
    setDirty(false);
    setSaved(true);
    setTitle(result.data.title);
    if (isNew) {
      router.replace(`/admin/flowcharts/edit?id=${result.data.id}`);
    }
  };

  if (missing) {
    return (
      <AdminShell section="flowcharts">
        <p className="text-[14px] text-[#9e9e9e]">
          フローチャートが見つかりませんでした。
        </p>
        <Link
          href="/admin/flowcharts"
          className="mt-4 inline-block text-[13px] text-main-100 hover:underline"
        >
          ← 一覧へ戻る
        </Link>
      </AdminShell>
    );
  }

  if (loading) {
    return (
      <AdminShell section="flowcharts" wide>
        <div className="h-full animate-pulse rounded-[12px] bg-[#1a1a1a]" />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      section="flowcharts"
      wide
      hasUnsavedChanges={dirty}
    >
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <Link
          href="/admin/flowcharts"
          className="shrink-0 text-[12px] tracking-[0.6px] text-main-100 hover:underline"
          onClick={(event) => {
            if (
              dirty &&
              !window.confirm(
                "未保存の変更があります。破棄して一覧へ戻りますか？",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          ← Flowcharts
        </Link>
        <Input
          className="min-w-[240px] flex-1"
          value={title}
          onChange={(value) => {
            setTitle(value);
            setDirty(true);
            setSaved(false);
          }}
          placeholder="フローチャートタイトル"
        />
        {dirty && (
          <span className="text-[11px] text-[#f4c248]">
            未保存の変更があります
          </span>
        )}
        <SaveButton
          onClick={handleSave}
          loading={saving}
          saved={saved}
          error={error}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)_260px] overflow-hidden rounded-[14px] border border-[#2a2a2a] bg-[#101010]">
        <aside className="overflow-y-auto border-r border-[#2a2a2a] p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.66px] text-[#616161]">
            Nodes
          </p>
          <div className="flex flex-col gap-2">
            {NODE_OPTIONS.map((option) => (
              <button
                key={option.kind}
                type="button"
                onClick={() => addNode(option.kind, option.defaultLabel)}
                className="rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-left text-[13px] text-white transition-colors hover:border-main-100 hover:text-main-100"
              >
                ＋ {option.label}
              </button>
            ))}
          </div>
          <div className="mt-6 border-t border-[#2a2a2a] pt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.66px] text-[#616161]">
              Layout
            </p>
            <p className="mb-3 text-[10px] leading-[1.5] text-[#616161]">
              複数選択時は選択対象、それ以外は全体を整列します。
            </p>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUT_ACTIONS.map((option) => (
                <button
                  key={option.action}
                  type="button"
                  onClick={() => alignNodes(option.action)}
                  disabled={layoutTargetCount < option.minNodes}
                  className="rounded-[7px] border border-[#424242] bg-[#1a1a1a] px-2 py-1.5 text-[10px] text-[#bdbdbd] transition-colors hover:border-main-100 hover:text-main-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div ref={canvasRef} className="min-h-0 min-w-0">
          <style jsx global>{`
            .flowchart-editor
              .react-flow__edge:not(.selected)
              .react-flow__edgeupdater {
              pointer-events: none;
            }

            .flowchart-editor
              .react-flow__edge.selected
              .react-flow__edgeupdater {
              fill: rgba(72, 244, 190, 0.18);
              stroke: #48f4be;
              stroke-width: 1.5;
              transition:
                fill 120ms ease,
                stroke-width 120ms ease;
            }

            .flowchart-editor
              .react-flow__edge.selected
              .react-flow__edgeupdater:hover {
              fill: rgba(72, 244, 190, 0.4);
              stroke-width: 2;
            }
          `}</style>
          <ReactFlow
            className="flowchart-editor"
            nodes={nodes}
            edges={edges}
            nodeTypes={flowchartNodeTypes}
            edgeTypes={flowchartEdgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={enableReconnect}
            onReconnectEnd={onReconnectEnd}
            onSelectionChange={handleSelectionChange}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={["Backspace", "Delete"]}
            minZoom={0.2}
            maxZoom={2.5}
            snapToGrid
            snapGrid={FLOWCHART_SNAP_GRID}
            connectionMode={ConnectionMode.Loose}
            edgesReconnectable
            reconnectRadius={10}
            defaultEdgeOptions={defaultEdgeOptions}
            colorMode="dark"
            proOptions={{ hideAttribution: false }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={FLOWCHART_GRID_SIZE}
              size={1}
              color="#424242"
            />
            <Controls />
          </ReactFlow>
        </div>

        <aside className="overflow-y-auto border-l border-[#2a2a2a] p-4">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.66px] text-[#616161]">
            Inspector
          </p>
          {!selectedNode && !selectedEdge && (
            <p className="text-[12px] leading-[1.6] text-[#616161]">
              ノードまたはエッジを選択すると、ここで内容を編集できます。
            </p>
          )}
          {selectedNode && (
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel>ラベル</FieldLabel>
                <Input
                  value={selectedNode.data.label}
                  onChange={(value) =>
                    patchNode(selectedNode.id, { label: value })
                  }
                />
              </div>
              <div>
                <FieldLabel>
                  {selectedNode.data.kind === "card" ? "本文" : "補足"}
                </FieldLabel>
                {selectedNode.data.kind === "card" ? (
                  <textarea
                    value={selectedNode.data.sublabel ?? ""}
                    onChange={(event) =>
                      patchNode(selectedNode.id, {
                        sublabel: event.target.value || undefined,
                      })
                    }
                    rows={5}
                    className="w-full resize-y rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
                    placeholder="カードに表示する本文"
                  />
                ) : (
                  <Input
                    value={selectedNode.data.sublabel ?? ""}
                    onChange={(value) =>
                      patchNode(selectedNode.id, {
                        sublabel: value || undefined,
                      })
                    }
                  />
                )}
              </div>
              <div>
                <FieldLabel>種別</FieldLabel>
                <select
                  value={selectedNode.data.kind}
                  onChange={(event) =>
                    patchNode(selectedNode.id, {
                      kind: event.target.value as FlowNodeKind,
                    })
                  }
                  className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
                >
                  {NODE_OPTIONS.map((option) => (
                    <option key={option.kind} value={option.kind}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>配色</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {NODE_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        patchNode(selectedNode.id, { color: option.value })
                      }
                      aria-pressed={selectedNode.data.color === option.value}
                      className={`flex min-w-0 flex-col items-center gap-1.5 rounded-[7px] border px-1 py-2 text-[9px] transition-colors ${
                        selectedNode.data.color === option.value
                          ? "border-main-100 bg-main-100/10 text-main-100"
                          : "border-[#424242] bg-[#1a1a1a] text-[#bdbdbd] hover:border-main-100"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`h-4 w-8 rounded-full border ${option.swatchClassName}`}
                      />
                      <span className="truncate">{option.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] leading-[1.5] text-[#616161]">
                  Primary・Secondaryは全オブジェクトで共通です。
                </p>
              </div>
              <div>
                <FieldLabel>文字サイズ</FieldLabel>
                <div className="mb-2 grid grid-cols-3 gap-2">
                  {FONT_SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        patchNode(selectedNode.id, {
                          fontSize: preset.value,
                        })
                      }
                      className={`rounded-[7px] border px-2 py-1.5 text-[11px] transition-colors ${
                        selectedNode.data.fontSize === preset.value
                          ? "border-main-100 bg-main-100/10 text-main-100"
                          : "border-[#424242] bg-[#1a1a1a] text-[#bdbdbd] hover:border-main-100"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={FLOWCHART_MIN_FONT_SIZE}
                    max={FLOWCHART_MAX_FONT_SIZE}
                    value={selectedNode.data.fontSize}
                    onChange={(event) =>
                      patchNode(selectedNode.id, {
                        fontSize: clamp(
                          Number(event.target.value),
                          FLOWCHART_MIN_FONT_SIZE,
                          FLOWCHART_MAX_FONT_SIZE,
                        ),
                      })
                    }
                    className="min-w-0 flex-1 rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
                  />
                  <span className="text-[11px] text-[#9e9e9e]">px</span>
                </div>
              </div>
              <div>
                <FieldLabel>文字の横揃え</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["left", "左"],
                      ["center", "中央"],
                      ["right", "右"],
                    ] as [FlowTextAlign, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        patchNode(selectedNode.id, { textAlign: value })
                      }
                      className={`rounded-[7px] border px-2 py-1.5 text-[11px] transition-colors ${
                        selectedNode.data.textAlign === value
                          ? "border-main-100 bg-main-100/10 text-main-100"
                          : "border-[#424242] bg-[#1a1a1a] text-[#bdbdbd] hover:border-main-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>文字の縦揃え</FieldLabel>
                <select
                  value={selectedNode.data.verticalAlign}
                  onChange={(event) =>
                    patchNode(selectedNode.id, {
                      verticalAlign: event.target.value as FlowVerticalAlign,
                    })
                  }
                  className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
                >
                  <option value="top">上</option>
                  <option value="middle">中央</option>
                  <option value="bottom">下</option>
                </select>
              </div>
              <div>
                <FieldLabel>オブジェクトサイズ</FieldLabel>
                <p className="mb-2 text-[10px] leading-[1.5] text-[#616161]">
                  キャンバス上のハンドルからも直接変更できます。
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-[#9e9e9e]">
                    幅
                    <input
                      type="number"
                      min={selectedNodeMinimum?.width ?? 40}
                      max={1200}
                      value={Math.round(selectedNodeSize?.width ?? 160)}
                      onChange={(event) =>
                        patchNodeSize(
                          selectedNode.id,
                          "width",
                          snapFlowchartCoordinate(
                            clamp(
                              Number(event.target.value),
                              selectedNodeMinimum?.width ?? 40,
                              1200,
                            ),
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-2 text-[12px] text-white outline-none focus:border-main-100"
                    />
                  </label>
                  <label className="text-[10px] text-[#9e9e9e]">
                    高さ
                    <input
                      type="number"
                      min={selectedNodeMinimum?.height ?? 40}
                      max={800}
                      value={Math.round(selectedNodeSize?.height ?? 48)}
                      onChange={(event) =>
                        patchNodeSize(
                          selectedNode.id,
                          "height",
                          snapFlowchartCoordinate(
                            clamp(
                              Number(event.target.value),
                              selectedNodeMinimum?.height ?? 40,
                              800,
                            ),
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-2 py-2 text-[12px] text-white outline-none focus:border-main-100"
                    />
                  </label>
                </div>
              </div>
              {selectedNode.data.kind === "card" && (
                <div>
                  <FieldLabel>カードの仕切り</FieldLabel>
                  <select
                    value={selectedNode.data.divider}
                    onChange={(event) =>
                      patchNode(selectedNode.id, {
                        divider: event.target.value as FlowCardDivider,
                      })
                    }
                    className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
                  >
                    <option value="none">なし</option>
                    <option value="horizontal">横仕切り</option>
                    <option value="vertical">縦仕切り</option>
                  </select>
                </div>
              )}
            </div>
          )}
          {selectedEdge && (
            <div className="flex flex-col gap-4">
              <p className="rounded-[8px] border border-main-100/30 bg-main-100/5 px-3 py-2 text-[11px] leading-[1.6] text-main-100">
                線の両端にある丸いハンドルをドラッグすると、接続先と辺を変更できます。
              </p>
              <div>
                <FieldLabel>ラベル</FieldLabel>
                <Input
                  value={
                    typeof selectedEdge.label === "string"
                      ? selectedEdge.label
                      : ""
                  }
                  onChange={(value) =>
                    patchEdge(selectedEdge.id, { label: value })
                  }
                />
              </div>
              <div>
                <FieldLabel>始点の辺</FieldLabel>
                <select
                  value={
                    isFlowHandlePosition(selectedEdge.sourceHandle)
                      ? selectedEdge.sourceHandle
                      : "bottom"
                  }
                  onChange={(event) =>
                    patchEdge(selectedEdge.id, {
                      sourceHandle: event.target
                        .value as FlowHandlePosition,
                    })
                  }
                  className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
                >
                  {HANDLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>始点の形</FieldLabel>
                <select
                  value={selectedEdge.data?.sourceMarker ?? "none"}
                  onChange={(event) =>
                    patchEdge(selectedEdge.id, {
                      sourceMarker: event.target.value as FlowEdgeMarker,
                    })
                  }
                  className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
                >
                  {MARKER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>終点の辺</FieldLabel>
                <select
                  value={
                    isFlowHandlePosition(selectedEdge.targetHandle)
                      ? selectedEdge.targetHandle
                      : "top"
                  }
                  onChange={(event) =>
                    patchEdge(selectedEdge.id, {
                      targetHandle: event.target
                        .value as FlowHandlePosition,
                    })
                  }
                  className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
                >
                  {HANDLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>終点の形</FieldLabel>
                <select
                  value={selectedEdge.data?.targetMarker ?? "arrow"}
                  onChange={(event) =>
                    patchEdge(selectedEdge.id, {
                      targetMarker: event.target.value as FlowEdgeMarker,
                    })
                  }
                  className="w-full rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
                >
                  {MARKER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-[#bdbdbd]">
                <input
                  type="checkbox"
                  checked={selectedEdge.data?.dashed === true}
                  onChange={(event) =>
                    patchEdge(selectedEdge.id, {
                      dashed: event.target.checked,
                    })
                  }
                />
                破線
              </label>
            </div>
          )}
          <div className="mt-8 border-t border-[#2a2a2a] pt-4">
            <FieldLabel>説明</FieldLabel>
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setDirty(true);
                setSaved(false);
              }}
              rows={4}
              className="w-full resize-y rounded-[8px] border border-[#424242] bg-[#1a1a1a] px-3 py-2 text-[13px] text-white outline-none focus:border-main-100"
              placeholder="一覧で管理するための補足"
            />
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}

export default function FlowchartEditor(props: {
  flowchartId: string;
}) {
  return (
    <ReactFlowProvider>
      <FlowchartEditorInner {...props} />
    </ReactFlowProvider>
  );
}
