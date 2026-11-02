import { useCallback, useEffect, useState } from "react";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  useReactFlow,
  useNodesInitialized,
  useStore
} from "@xyflow/react";

import PIDSymbolNode from "../PIDSymbolNode";
import { createInitialDiagram } from "../diagram/defaultDiagram";
import {
  useTelemetryReadings,
  type DiagramTelemetry
} from "../diagram/useTelemetryReadings";
import {
  normalizeVisualState,
  sampleTelemetry
} from "../telemetry/componentStates";
import { withTelemetryReadings } from "../telemetry/withTelemetryReadings";
import "@xyflow/react/dist/style.css";
import "@de-nile/pid-viewer/style.css";

type Theme = "dark" | "light";

const nodeTypes = {
  pidSymbol: PIDSymbolNode
};

// Resize the viewport, not the saved equipment coordinates or the user's live pan.
function FitDiagram() {
  const { fitBounds, getNodesBounds, getNodes } =
    useReactFlow();
  const ready = useNodesInitialized();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  useEffect(() => {
    if (!ready || width <= 0 || height <= 0) return;
    const frame = requestAnimationFrame(() => {
      void fitBounds(getNodesBounds(getNodes()), {
        padding: 0.2
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    ready,
    width,
    height,
    fitBounds,
    getNodesBounds,
    getNodes
  ]);
  return null;
}

export function DiagramView({
  editable,
  telemetry,
  embedded = false
}: {
  editable: boolean;
  telemetry?: DiagramTelemetry;
  embedded?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [initialDiagram] = useState(() => {
    const diagram = createInitialDiagram();
    diagram.nodes = diagram.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        visualState: normalizeVisualState(
          node.id,
          node.data.kind,
          sampleTelemetry[node.id]
        )
      }
    }));
    return diagram;
  });
  const [nodes, , onNodesChange] = useNodesState(
    initialDiagram.nodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialDiagram.edges
  );

  const readings = useTelemetryReadings(telemetry);
  const canEdit = editable && !telemetry;
  const displayedNodes = telemetry
    ? withTelemetryReadings(nodes, telemetry.bindings, readings)
    : nodes;

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) return;
      setEdges((currentEdges) =>
        addEdge(connection, currentEdges)
      );
    },
    [canEdit, setEdges]
  );

  return (
    <div
      className={`denile-theme denile-theme--${theme}`}
      style={{
        position: embedded ? "absolute" : "relative",
        width: "100%",
        height: embedded ? "100%" : "calc(100dvh - 58px)",
        backgroundColor:
          theme === "dark" ? "#12151B" : "#F8FAFC"
      }}>
      <button
        type="button"
        onClick={() =>
          setTheme((currentTheme) =>
            currentTheme === "dark" ? "light" : "dark"
          )
        }
        style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          zIndex: 10,
          padding: "8px 12px",
          color: "var(--pid-stroke)",
          background: "var(--pid-surface)",
          border: "1px solid var(--pid-stroke)",
          borderRadius: "6px",
          cursor: "pointer"
        }}>
        Switch to {theme === "dark" ? "light" : "dark"} mode
      </button>

      <ReactFlow
        nodes={displayedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        elementsSelectable={canEdit}
        edgesReconnectable={canEdit}
        deleteKeyCode={canEdit ? ["Backspace", "Delete"] : null}
        minZoom={0.1}
        fitView>
        <FitDiagram />
        <Background
          variant={BackgroundVariant.Lines}
          gap={16}
          size={1}
          color={theme === "dark" ? "#2C313A" : "#D1D5DB"}
        />
        <Controls showInteractive={canEdit} />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
