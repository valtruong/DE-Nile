import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

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
  type Edge,
  ConnectionLineType,
  Panel,
  useReactFlow,
  useNodesInitialized,
  useStore
} from "@xyflow/react";

import PIDSymbolNode from "../PIDSymbolNode";
import { OrientationControls } from "./OrientationControls";
import { computeLabelSides } from "../diagram/labelLayout";
import {
  PIPE_WIDTH,
  canConnect,
  createPipe
} from "../diagram/pipes";
import { PipeTools } from "./PipeTools";
import { createInitialDiagram } from "../diagram/defaultDiagram";
import {
  pipeStyle,
  type Canvas
} from "../diagram/diagramFormat";
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
import "../diagram/pipes.css";
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
  embedded = false,
  diagram,
  onChange,
  minimap = true,
  initialTheme = "dark"
}: {
  editable: boolean;
  telemetry?: DiagramTelemetry;
  embedded?: boolean;
  /** A saved diagram to show; defaults to the team starter layout. */
  diagram?: Canvas;
  /** Called with the current layout whenever it changes. */
  onChange?: (canvas: Canvas) => void;
  /** Hide the minimap in small previews. */
  minimap?: boolean;
  /** Light is used for exported images and PDFs. */
  initialTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  // Read once: give the component a new `key` to show another
  // diagram, so each one keeps its own nodes and pipes.
  const [initialDiagram] = useState(() => {
    const canvas: Canvas = diagram
      ? structuredClone(diagram)
      : createInitialDiagram();
    canvas.nodes = canvas.nodes.map((node) => ({
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
    return canvas;
  });
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialDiagram.nodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialDiagram.edges as Edge[]
  );

  useEffect(() => {
    onChange?.({ nodes, edges });
  }, [nodes, edges, onChange]);

  const readings = useTelemetryReadings(telemetry);
  const canEdit = editable && !telemetry;
  const shownNodes = telemetry
    ? withTelemetryReadings(nodes, telemetry.bindings, readings)
    : nodes;
  // Labels pick a free side based on where everything currently sits.
  const labelSides = useMemo(
    () => computeLabelSides(nodes, edges),
    [nodes, edges]
  );
  const displayedNodes = useMemo(
    () =>
      shownNodes.map((node) => ({
        ...node,
        data: { ...node.data, labelSide: labelSides[node.id] }
      })),
    [shownNodes, labelSides]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) return;
      // New pipes look like the rest: square corners, default
      // gray until someone sets a color.
      setEdges((currentEdges) =>
        canConnect(connection, currentEdges)
          ? addEdge(
              createPipe(connection, currentEdges),
              currentEdges
            )
          : currentEdges
      );
    },
    [canEdit, setEdges]
  );

  // Deleting a pipe is quick; deleting equipment asks first.
  const onBeforeDelete = useCallback(
    async ({
      nodes: doomedNodes,
      edges: doomedEdges
    }: {
      nodes: typeof nodes;
      edges: typeof edges;
    }) => {
      if (doomedNodes.length === 0) return true;
      const names = doomedNodes
        .map((node) => node.data.label)
        .join(", ");
      const connected = edges.filter((edge) =>
        doomedNodes.some(
          (node) =>
            edge.source === node.id || edge.target === node.id
        )
      ).length;
      const ok = window.confirm(
        `Delete ${names} and its ${connected} connection(s)?\n\n` +
          "To remove only a pipe, click the pipe and press Delete."
      );
      return ok
        ? { nodes: doomedNodes, edges: doomedEdges }
        : false;
    },
    [edges]
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
        data-export-hide
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
        onBeforeDelete={onBeforeDelete}
        isValidConnection={(connection) =>
          connection.source !== connection.target
        }
        connectionLineType={ConnectionLineType.Step}
        connectionLineStyle={{
          stroke: "#667085",
          strokeWidth: PIPE_WIDTH
        }}
        elevateEdgesOnSelect
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        elementsSelectable={canEdit}
        edgesReconnectable={canEdit}
        deleteKeyCode={canEdit ? ["Backspace", "Delete"] : null}
        minZoom={0.1}
        fitView>
        <FitDiagram />
        <OrientationControls
          nodes={nodes}
          setNodes={setNodes}
          setEdges={setEdges}
          edges={edges}
          canEdit={canEdit}
        />
        <Panel position="top-center">
          <PipeTools
            edges={edges}
            setEdges={setEdges}
            canEdit={canEdit}
          />
        </Panel>
        <Background
          variant={BackgroundVariant.Lines}
          gap={16}
          size={1}
          color={theme === "dark" ? "#2C313A" : "#D1D5DB"}
        />
        <Controls showInteractive={canEdit} />
        {minimap && <MiniMap />}
      </ReactFlow>
    </div>
  );
}
