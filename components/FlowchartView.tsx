"use client";

import "@xyflow/react/dist/style.css";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
} from "@xyflow/react";
import {
  FLOWCHART_GRID_SIZE,
  FLOWCHART_SNAP_GRID,
  toReactFlow,
  type FlowchartData,
} from "@/lib/flowchart";
import {
  flowchartEdgeTypes,
  flowchartNodeTypes,
} from "./FlowchartNodes";

export type FlowchartViewProps = {
  data: FlowchartData;
  className?: string;
  interactive?: boolean;
  onRequestExpand?: () => void;
};

export default function FlowchartView({
  data,
  className = "",
  interactive = true,
  onRequestExpand,
}: FlowchartViewProps) {
  const graph = useMemo(() => toReactFlow(data), [data]);

  return (
    <div className={`h-full min-h-0 w-full ${className}`}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={flowchartNodeTypes}
        edgeTypes={flowchartEdgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        panOnDrag={interactive}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        minZoom={0.2}
        maxZoom={2.5}
        snapToGrid
        snapGrid={FLOWCHART_SNAP_GRID}
        connectionMode={ConnectionMode.Loose}
        colorMode="dark"
        preventScrolling={interactive}
        onPaneClick={onRequestExpand}
        onNodeClick={onRequestExpand ? () => onRequestExpand() : undefined}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={FLOWCHART_GRID_SIZE}
          size={1}
          color="#424242"
        />
        {interactive && <Controls showInteractive={false} />}
      </ReactFlow>
    </div>
  );
}
