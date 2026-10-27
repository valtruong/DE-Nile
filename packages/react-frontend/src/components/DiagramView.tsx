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

import PIDSymbolNode from "../PIDSymbolNode";
import { createInitialDiagram } from "../diagram/defaultDiagram";
import "@xyflow/react/dist/style.css";

const nodeTypes = {
  pidSymbol: PIDSymbolNode
};

export function DiagramView({
  editable
}: {
  editable: boolean;
}) {
  const [initialDiagram] = useState(createInitialDiagram);
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
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#12151B"
      }}>
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
          color="#2C313A"
        />
        <Controls showInteractive={editable} />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
