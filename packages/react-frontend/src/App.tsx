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
    id: "tank1",
    type: "pidSymbol",
    position: { x: 330, y: 130 },
    data: {
      kind: "tank",
      label: "TK101 Fuel Tank",
    },
  },
  {
    id: "tank2",
    type: "pidSymbol",
    position: { x: 80, y: 130 },
    data: {
      kind: "tank",
      label: "TK001 Fuel Tank",
    },
  },
  {
    id: "tank3",
    type: "pidSymbol",
    position: { x: 1100, y: 130 },
    data: {
      kind: "tank",
      label: "TK201 Fuel Tank",
    },
  },
  {
    id: "pressure-transducer1",
    type: "pidSymbol",
    position: { x: 500, y: 60 },
    data: {
      kind: "pressureTransducer",
      label: "PT101 Pressure Transducer",
    },
  },
  {
    id: "pressure-transducer2",
    type: "pidSymbol",
    position: { x: 930, y: 60 },
    data: {
      kind: "pressureTransducer",
      label: "PT201 Pressure Transducer",
    },
  },
  {
    id: "check-valve1",
    type: "pidSymbol",
    position: { x: 430, y: 380 },
    data: {
      kind: "checkValve",
      label: "CV101 Check Valve",
    },
  },
  {
    id: "pneumatic-valve1",
    type: "pidSymbol",
    position: { x: 590, y: 380 },
    data: {
      kind: "pneumaticValve",
      label: "PV101 Pneumatic Valve",
    },
  },
  {
    id: "engine",
    type: "pidSymbol",
    position: { x: 750, y: 480 },
    data: {
      kind: "engine",
      label: "LC301 Engine",
    },
  },
  {
    id: "pneumatic-valve2",
    type: "pidSymbol",
    position: { x: 900, y: 380 },
    data: {
      kind: "pneumaticValve",
      label: "PV201 Pneumatic Valve",
    },
  },
  {
    id: "check-valve2",
    type: "pidSymbol",
    position: { x: 1060, y: 380 },
    data: {
      kind: "checkValve",
      label: "CV201 Check Valve",
    },
  },
];

const initialEdges = [
  // Gray instrumentation lines across the top
  {
    id: "gn2-line-1",
    source: "tank2",
    target: "tank1",
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: "#667085", strokeWidth: 3 },
  },
  {
    id: "pt101-line",
    source: "tank1",
    target: "pressure-transducer1",
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: "#667085", strokeWidth: 3 },
  },
  {
    id: "pt201-line",
    source: "pressure-transducer2",
    target: "tank3",
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: "#667085", strokeWidth: 3 },
  },

  // Orange fuel line: TK101 -> CV101 -> PV101 -> engine
  {
    id: "fuel-line-1",
    source: "tank1",
    target: "check-valve1",
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: "#C44900", strokeWidth: 3 },
  },
  {
    id: "fuel-line-2",
    source: "check-valve1",
    target: "pneumatic-valve1",
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: "#C44900", strokeWidth: 3 },
  },
  {
    id: "fuel-line-3",
    source: "pneumatic-valve1",
    target: "engine",
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: "#C44900", strokeWidth: 3 },
  },

  // Blue oxidizer line: engine -> PV201 -> CV201 -> TK201
  {
    id: "oxidizer-line-1",
    source: "engine",
    target: "pneumatic-valve2",
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: "#00A9D6", strokeWidth: 3 },
  },
  {
    id: "oxidizer-line-2",
    source: "pneumatic-valve2",
    target: "check-valve2",
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: "#00A9D6", strokeWidth: 3 },
  },
  {
    id: "oxidizer-line-3",
    source: "check-valve2",
    target: "tank3",
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: "#00A9D6", strokeWidth: 3 },
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
