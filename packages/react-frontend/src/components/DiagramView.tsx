import { useCallback, useState } from "react";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection
} from "@xyflow/react";

import {
  normalizeVisualState,
  sampleTelemetry
} from "../telemetry/componentStates";

import PIDSymbolNode from "../PIDSymbolNode";
import { createInitialDiagram } from "../diagram/defaultDiagram";
import "@xyflow/react/dist/style.css";
import "@de-nile/pid-viewer/style.css";

type Theme = "dark" | "light";

const nodeTypes = {
  pidSymbol: PIDSymbolNode
};

export function DiagramView({
  editable
}: {
  editable: boolean;
}) {
  const [theme, setTheme] = useState<Theme>("dark");

  const [initialDiagram] = useState(() => {
    const diagram = createInitialDiagram();

    diagram.nodes = diagram.nodes.map((node) => {
      const telemetryValue = sampleTelemetry[node.id];

      if (!telemetryValue) return node;

      const visualState = normalizeVisualState(
        node.id,
        node.data.kind,
        telemetryValue
      );

      return visualState
        ? {
            ...node,
            data: {
              ...node.data,
              visualState
            }
          }
        : node;
    });

    return diagram;
  });

  const [nodes, , onNodesChange] = useNodesState(
    initialDiagram.nodes
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialDiagram.edges
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(connection, currentEdges)
      );
    },
    [setEdges]
  );

  return (
    <div
      className={`denile-theme denile-theme--${theme}`}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
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
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable={editable}
        fitView>
        <Background
          variant={BackgroundVariant.Lines}
          gap={16}
          size={1}
          color={theme === "dark" ? "#2C313A" : "#D1D5DB"}
        />

        <Controls showInteractive={editable} />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}