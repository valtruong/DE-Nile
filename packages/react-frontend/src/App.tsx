import { useCallback } from "react";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";


import PIDSymbolNode from "./PIDSymbolNode";
import "@xyflow/react/dist/style.css";

const nodeTypes = {
  pidSymbol: PIDSymbolNode,
};


const initialNodes = [
  {
    id: "tank",
    type: "pidSymbol",
    position: { x: 80, y: 150 },
    data: { 
      kind: "tank",
      label: "Fuel Tank",
    },
  },
  {
    id: "check-valve",
    type: "pidSymbol",
    position: { x: 350, y: 150 },
    data: { 
      kind: "checkValve",
      label: "Check Valve",
    },
  },
  {
    id: "engine",
    type: "pidSymbol",
    position: { x: 620, y: 150 },
    data: { 
      kind: "engine",
      label: "Rocket Engine", 
    },
  },
  {
    id: "pneumatic-valve",
    type: "pidSymbol",
    position: { x: 650, y: 150 },
    data: { 
      kind: "pneumaticValve",
      label: "Pneumatic Valve", 
    },
  },
  {
    id: "pressure-transducer",
    type: "pidSymbol",
    position: { x: 550, y: 150 },
    data: { 
      kind: "pressureTransducer",
      label: "Pressure Transducer", 
    },
  },
];

const initialEdges = [
  {
    id: "fuel-line-1",
    source: "tank",
    target: "check-valve",
    type: "step",
    style: { stroke: "#4A890C", strokeWidth: 3 },
  },
  {
    id: "fuel-line-2",
    source: "check-valve",
    target: "engine",
    type: "step",
    style: { stroke: "#4A890C", strokeWidth: 3 },
  },
  {
    id: "fuel-line-3",
    source: "engine",
    target: "pneumatic-valve",
    type: "step",
    style: { stroke: "#FFA7FF", strokeWidth: 3 },
  },
  {
    id: "fuel-line-3",
    source: "pneumatic-valve",
    target: "pressure-transducer",
    type: "step",
    style: { stroke: "#198CC4", strokeWidth: 3 },
  },
];

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: any) => {
      setEdges((currentEdges) => addEdge(connection, currentEdges));
    },
    [setEdges],
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background variant={BackgroundVariant.Lines} gap={16} color="#303030"/>
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export default App;
