import { SharedDiagramView } from "./SharedDiagramCanvas";
export { DiagramCanvas } from "./SharedDiagramCanvas";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent
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
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized,
  useStore
} from "@xyflow/react";

import PIDSymbolNode from "../PIDSymbolNode";
import { OrientationControls } from "./OrientationControls";
import { computeLabelSides } from "../diagram/labelLayout";
import {
  PIPE_WIDTH,
  loadPalette,
  recolorPipes,
  savePalette,
  type LinePalette,
  canConnect,
  createPipe,
  lineTypeFor,
  type LineTypeId
} from "../diagram/pipes";
import { PipeTools } from "./PipeTools";
import {
  EditorPalette,
  PALETTE_DRAG_TYPE
} from "./EditorPalette";
import { EditorPanel } from "./EditorPanel";
import { DropGhost } from "./DropGhost";
import {
  copySelection,
  pasteCopied,
  type Copied
} from "../diagram/duplicate";
import { useUndoRedo } from "../diagram/useUndoRedo";
import { planDrop, type DropPlan } from "../diagram/dropPlan";
import {
  PALETTE,
  createNode,
  splitPipe
} from "../diagram/palette";
import { NODE_WIDTH, symbolSizes } from "../diagram/ports";
import type { SymbolKind } from "../diagram/types";
import { createInitialDiagram } from "../diagram/defaultDiagram";
import type { Canvas } from "../diagram/diagramFormat";
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
import "./editor.css";
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
  const fitted = useRef({ done: false, width: 0, height: 0 });
  useEffect(() => {
    if (!ready || width <= 0 || height <= 0) return;
    // Fit on first load and when the canvas is resized. Adding a component
    // makes `ready` flicker, which must not move the view.
    const last = fitted.current;
    if (
      last.done &&
      last.width === width &&
      last.height === height
    )
      return;
    fitted.current = { done: true, width, height };
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

type DiagramViewProps = {
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
};

export function DiagramView(props: DiagramViewProps) {
  if (props.telemetry) return <SharedDiagramView {...props} />;
  // The palette and panels need React Flow's hooks outside the canvas itself.
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  );
}

function hintFor(plan: DropPlan, palette: LinePalette) {
  if (!plan.pipe) return undefined;
  const line = lineTypeFor(plan.pipe.style?.stroke, palette);
  const name = !line
    ? "pipe"
    : line.id === "gn2"
      ? `${line.label} line`
      : `${line.label.toLowerCase()} line`;
  return `Release to drop onto the ${name}`;
}

function DiagramCanvas({
  editable,
  telemetry,
  embedded = false,
  diagram,
  onChange,
  minimap = true,
  initialTheme = "dark"
}: DiagramViewProps) {
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
  // What colour each line type is drawn in; this browser remembers it.
  const [palette, setPalette] =
    useState<LinePalette>(loadPalette);
  const remember = useCallback((next: LinePalette) => {
    setPalette(next);
    savePalette(next);
  }, []);
  const { undo, redo, canUndo, canRedo } = useUndoRedo({
    nodes,
    edges,
    setNodes,
    setEdges,
    palette,
    setPalette: remember,
    enabled: editable && !telemetry
  });
  const showEditor = canEdit;

  // --- Adding components (palette -> canvas) -------------------------------
  const [lineType, setLineType] = useState<LineTypeId>("fuel");
  const lineColor = palette[lineType];
  // Changing a colour repaints the pipes that use it (undo restores them).
  const changePalette = (next: LinePalette) => {
    remember(next);
    setEdges((current) => recolorPipes(current, palette, next));
  };
  // Changes the type for new pipes, and recolors any selected pipes.
  const chooseLineType = (id: LineTypeId) => {
    setLineType(id);
    const color = palette[id];
    setEdges((current) =>
      current.map((edge) =>
        edge.selected
          ? { ...edge, style: { ...edge.style, stroke: color } }
          : edge
      )
    );
  };
  const [draggingKind, setDraggingKind] =
    useState<SymbolKind | null>(null);
  const [ghost, setGhost] = useState<{
    kind: SymbolKind;
    plan: DropPlan;
    /** On-screen box of the preview, relative to the canvas. */
    box: { left: number; top: number; size: number };
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, flowToScreenPosition } =
    useReactFlow();
  const zoom = useStore((state) => state.transform[2]);

  // What the starting diagram had, so we can tell what has been added.
  const initialNodeIds = useMemo(
    () => new Set(initialDiagram.nodes.map((node) => node.id)),
    [initialDiagram]
  );
  const initialEdgeIds = useMemo(
    () => new Set(initialDiagram.edges.map((edge) => edge.id)),
    [initialDiagram]
  );
  const addedNodes = nodes.filter(
    (node) => !initialNodeIds.has(node.id)
  );
  const addedPipes = edges.filter(
    (edge) => !initialEdgeIds.has(edge.id)
  ).length;

  // Put a new component on the canvas, inside a pipe when the plan says so.
  const place = useCallback(
    (kind: SymbolKind, plan: DropPlan) => {
      const node = createNode(kind, plan, nodes);
      setNodes((current) => [
        ...current.map((item) => ({
          ...item,
          selected: false
        })),
        node
      ]);
      if (plan.pipe) {
        const pipe = plan.pipe;
        setEdges((current) => [
          ...current.filter((edge) => edge.id !== pipe.id),
          ...splitPipe(pipe, node.id)
        ]);
      }
    },
    [nodes, setNodes, setEdges]
  );

  // Copy / paste. Each paste is shifted a bit further so copies stay visible.
  const clipboard = useRef<Copied | undefined>(undefined);
  const pasteStep = useRef(0);
  const copySelected = useCallback(() => {
    const copied = copySelection(nodes, edges);
    if (!copied) return false;
    clipboard.current = copied;
    pasteStep.current = 0;
    return true;
  }, [nodes, edges]);
  const paste = useCallback(() => {
    const copied = clipboard.current;
    if (!copied) return;
    pasteStep.current += 1;
    const added = pasteCopied(
      copied,
      nodes,
      edges,
      pasteStep.current
    );
    setNodes((current) => [
      ...current.map((item) => ({ ...item, selected: false })),
      ...added.nodes
    ]);
    if (added.edges.length > 0)
      setEdges((current) => [...current, ...added.edges]);
  }, [nodes, edges, setNodes, setEdges]);
  const duplicateSelection = () => {
    if (copySelected()) paste();
  };
  useEffect(() => {
    if (!showEditor) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey)
        return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(
            target.tagName
          ))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "c") {
        if (copySelected()) event.preventDefault();
      } else if (key === "v") {
        if (clipboard.current) {
          event.preventDefault();
          paste();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () =>
      window.removeEventListener("keydown", onKeyDown);
  }, [showEditor, copySelected, paste]);

  const onCanvasDragOver = (event: DragEvent) => {
    if (!showEditor || !draggingKind) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const cursor = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });
    const plan = planDrop(draggingKind, cursor, nodes, edges);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const size = symbolSizes[draggingKind];
    const origin = flowToScreenPosition({
      x: plan.position.x + (NODE_WIDTH - size) / 2,
      y: plan.position.y
    });
    const box = {
      left: Math.round(origin.x - rect.left),
      top: Math.round(origin.y - rect.top),
      size: Math.round(size * zoom)
    };
    setGhost((previous) =>
      previous &&
      previous.kind === draggingKind &&
      previous.plan.pipe?.id === plan.pipe?.id &&
      previous.box.left === box.left &&
      previous.box.top === box.top &&
      previous.box.size === box.size
        ? previous
        : { kind: draggingKind, plan, box }
    );
  };

  const onCanvasDragLeave = (event: DragEvent) => {
    if (
      !event.currentTarget.contains(
        event.relatedTarget as Node | null
      )
    ) {
      setGhost(null);
    }
  };

  const onCanvasDrop = (event: DragEvent) => {
    if (!showEditor) return;
    event.preventDefault();
    const kind = (draggingKind ??
      event.dataTransfer.getData(
        PALETTE_DRAG_TYPE
      )) as SymbolKind;
    setGhost(null);
    setDraggingKind(null);
    if (!PALETTE.some((item) => item.kind === kind)) return;
    const cursor = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });
    place(kind, planDrop(kind, cursor, nodes, edges));
  };

  // Keyboard / click alternative to dragging: add at the middle of the canvas.
  const addAtCenter = (kind: SymbolKind) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursor = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    place(kind, planDrop(kind, cursor, nodes, edges));
  };
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
              createPipe(connection, currentEdges, lineColor),
              currentEdges
            )
          : currentEdges
      );
    },
    [canEdit, setEdges, lineColor]
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
      className={`denile-theme denile-theme--${theme} denile-editor`}
      style={{
        position: embedded ? "absolute" : "relative",
        width: "100%",
        height: embedded ? "100%" : "calc(100dvh - 58px)",
        gridTemplateColumns: showEditor
          ? undefined
          : "minmax(0, 1fr)",
        gridTemplateRows: "minmax(0, 1fr)",
        backgroundColor:
          theme === "dark" ? "#12151B" : "#F8FAFC"
      }}>
      {showEditor && (
        <EditorPalette
          draggingKind={draggingKind}
          onDragStart={setDraggingKind}
          onDragEnd={() => {
            setDraggingKind(null);
            setGhost(null);
          }}
          onAdd={addAtCenter}
          palette={palette}
          onPalette={changePalette}
        />
      )}
      <div
        ref={canvasRef}
        className="denile-canvas"
        onDragOver={onCanvasDragOver}
        onDragLeave={onCanvasDragLeave}
        onDrop={onCanvasDrop}>
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
            top: "12px",
            right: "12px",
            zIndex: 10,
            padding: "6px 10px",
            fontSize: "12px",
            color: "var(--pid-stroke)",
            background: "var(--pid-surface)",
            border: "1px solid var(--editor-line)",
            borderRadius: "6px",
            cursor: "pointer"
          }}>
          Switch to {theme === "dark" ? "light" : "dark"} mode
        </button>

        {canEdit && (
          <div
            className="denile-history"
            role="toolbar"
            aria-label="History">
            <button
              type="button"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}>
              ↶
            </button>
            <button
              type="button"
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}>
              ↷
            </button>
          </div>
        )}

        <ReactFlow
          nodes={displayedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={theme}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onBeforeDelete={onBeforeDelete}
          isValidConnection={(connection) =>
            connection.source !== connection.target
          }
          connectionLineType={ConnectionLineType.Step}
          connectionLineStyle={{
            stroke: lineColor,
            strokeWidth: PIPE_WIDTH
          }}
          elevateEdgesOnSelect
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          elementsSelectable={canEdit}
          edgesReconnectable={canEdit}
          deleteKeyCode={
            canEdit ? ["Backspace", "Delete"] : null
          }
          minZoom={0.1}
          fitView>
          <FitDiagram />
          <OrientationControls
            nodes={nodes}
            setNodes={setNodes}
            setEdges={setEdges}
            edges={edges}
            canEdit={canEdit}
            onDuplicate={duplicateSelection}
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
        {showEditor && ghost && (
          <DropGhost
            kind={ghost.kind}
            left={ghost.box.left}
            top={ghost.box.top}
            size={ghost.box.size}
            orientation={ghost.plan.orientation}
            hint={hintFor(ghost.plan, palette)}
          />
        )}
        {showEditor && (
          <div className="denile-canvas__tip">
            {nodes.some((node) => node.selected)
              ? "Tip: drag a symbol to move it · Delete key removes the selection"
              : "Symbols snap to the grid, and onto a pipe when dropped over one."}
          </div>
        )}
      </div>
      {showEditor && (
        <EditorPanel
          nodes={nodes}
          setNodes={setNodes}
          selected={nodes.filter((node) => node.selected)}
          addedNodes={addedNodes}
          addedPipes={addedPipes}
          lineType={lineType}
          palette={palette}
          selectedPipes={edges.filter((edge) => edge.selected)}
          onLineType={chooseLineType}
        />
      )}
    </div>
  );
}
