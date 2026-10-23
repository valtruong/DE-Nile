import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./DiagramView.css";

const initialNodes: Node[] = [
  {
    id: "fuel-tank",
    position: { x: 80, y: 150 },
    data: { label: "Fuel Tank" }
  },
  {
    id: "fuel-valve",
    position: { x: 350, y: 150 },
    data: { label: "Fuel Valve" }
  },
  {
    id: "engine",
    position: { x: 620, y: 150 },
    data: { label: "Rocket Engine" }
  }
];

const initialEdges: Edge[] = [
  {
    id: "fuel-line-1",
    source: "fuel-tank",
    target: "fuel-valve",
    type: "step",
    style: { stroke: "#d9a7e8", strokeWidth: 4 }
  },
  {
    id: "fuel-line-2",
    source: "fuel-valve",
    target: "engine",
    type: "step",
    style: { stroke: "#d9a7e8", strokeWidth: 4 }
  }
];

type DiagramViewProps = {
  // Only editors/admins get true. Viewers can pan, zoom and
  // select (to read values) but can't change the diagram.
  editable: boolean;
};

export function DiagramView({ editable }: DiagramViewProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(connection, currentEdges)
      );
    },
    [setEdges]
  );

  return (
    <div className="diagram-view">
      <p className="diagram-hint">
        {editable
          ? "Drag symbols to move them · drag between handles to connect · Delete removes the selection"
          : "Drag to pan · editing is disabled"}
      </p>
      <div className="diagram-canvas">
        <div className="diagram-canvas-inner">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={editable ? onConnect : undefined}
            nodesDraggable={editable}
            nodesConnectable={editable}
            edgesReconnectable={editable}
            deleteKeyCode={
              editable ? ["Backspace", "Delete"] : null
            }
            fitView>
            <Background />
            <Controls showInteractive={false} />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
