import { useCallback, useEffect, useState } from "react";
import {
  resolveEquipmentVisualState,
  DiagramLegend,
  type TelemetrySource
} from "@de-nile/pid-viewer";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeChange,
  type EdgeChange,
  useReactFlow,
  useNodesInitialized,
  useStore
} from "@xyflow/react";

import MonitoringSymbolNode from "./MonitoringSymbolNode";
import {
  diagramNodes,
  diagramEdges
} from "../diagram/diagramState";
import {
  useDiagramState,
  type DiagramController
} from "../diagram/useDiagramState";
import type { SymbolNode } from "../diagram/types";
import {
  useTelemetryReadings,
  type DiagramTelemetry
} from "../diagram/useTelemetryReadings";
import "@xyflow/react/dist/style.css";
import "@de-nile/pid-viewer/style.css";

type Theme = "dark" | "light";

function selectionAfter(
  previous: Set<string>,
  changes: (NodeChange<SymbolNode> | EdgeChange)[]
) {
  const next = new Set(previous);
  for (const change of changes) {
    if (change.type === "select") {
      if (change.selected) next.add(change.id);
      else next.delete(change.id);
    }
    if (change.type === "remove") next.delete(change.id);
  }
  return next;
}

const nodeTypes = {
  pidSymbol: MonitoringSymbolNode
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

export function SharedDiagramView({
  editable,
  telemetry,
  embedded = false
}: {
  editable: boolean;
  telemetry?: DiagramTelemetry;
  embedded?: boolean;
}) {
  const controller = useDiagramState(
    undefined,
    editable && !telemetry ? "edit" : "monitor"
  );
  return (
    <DiagramCanvas
      controller={controller}
      editable={editable && !telemetry}
      telemetry={telemetry}
      embedded={embedded}
    />
  );
}

/** Controlled canvas: editor, monitor and future library all use the same document. */
export function DiagramCanvas({
  controller,
  editable,
  telemetry,
  dataSource,
  embedded = false
}: {
  controller: DiagramController;
  editable: boolean;
  telemetry?: DiagramTelemetry;
  dataSource?: TelemetrySource;
  embedded?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [measurements, setMeasurements] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [selectedNodes, setSelectedNodes] = useState<
    Set<string>
  >(new Set());
  const [selectedEdges, setSelectedEdges] = useState<
    Set<string>
  >(new Set());
  const { diagram, mode, dispatch } = controller;
  const canEdit = editable && mode === "edit";
  // Permission changes immediately make the canvas a monitor as well.
  const monitoring = !canEdit;
  const bindings = Object.fromEntries(
    diagram.equipment.flatMap((item) => {
      const binding =
        telemetry?.bindings[item.id] ?? item.binding;
      return binding ? [[item.id, binding]] : [];
    })
  );
  const readings = useTelemetryReadings(
    monitoring
      ? {
          bindings,
          source: dataSource ?? telemetry?.source
        }
      : undefined
  );
  const nodes = diagramNodes(diagram).map((node, index) => {
    const binding = bindings[node.id];
    const reading =
      monitoring && binding
        ? readings[binding.topic]
        : undefined;
    const equipment = { ...diagram.equipment[index], binding };
    return {
      ...node,
      measured: measurements[node.id],
      selected: canEdit && selectedNodes.has(node.id),
      data: {
        ...node.data,
        binding,
        reading,
        visualState: monitoring
          ? resolveEquipmentVisualState(equipment, reading)
          : undefined
      }
    };
  });
  const onNodesChange = useCallback(
    (changes: NodeChange<SymbolNode>[]) => {
      // React Flow needs measured dimensions even while document edits are locked.
      setMeasurements((previous) => {
        let next = previous;
        for (const change of changes) {
          if (
            change.type !== "dimensions" ||
            !change.dimensions
          )
            continue;
          const size = change.dimensions;
          if (
            previous[change.id]?.width === size.width &&
            previous[change.id]?.height === size.height
          )
            continue;
          if (next === previous) next = { ...previous };
          next[change.id] = size;
        }
        return next;
      });
      if (canEdit) {
        setSelectedNodes((previous) =>
          selectionAfter(previous, changes)
        );
        dispatch({ type: "nodes", changes });
      }
    },
    [canEdit, dispatch]
  );

  return (
    <div
      className={`denile-workspace denile-theme denile-theme--${theme}`}
      style={{
        position: embedded ? "absolute" : "relative",
        width: "100%",
        height: embedded ? "100%" : "calc(100dvh - 58px)",
        backgroundColor:
          theme === "dark" ? "#12151B" : "#F8FAFC"
      }}>
      <div
        role="toolbar"
        aria-label="Diagram controls"
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap"
        }}>
        {editable && (
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "mode",
                mode: monitoring ? "edit" : "monitor"
              })
            }>
            {monitoring ? "Edit diagram" : "Monitor diagram"}
          </button>
        )}
        <span
          role="status"
          style={{ color: "var(--pid-stroke)" }}>
          {monitoring ? "Monitoring · read-only" : "Editing"}
        </span>
        <button
          type="button"
          onClick={() =>
            setTheme((currentTheme) =>
              currentTheme === "dark" ? "light" : "dark"
            )
          }
          style={{
            padding: "8px 12px",
            color: "var(--pid-stroke)",
            background: "var(--pid-surface)",
            border: "1px solid var(--pid-stroke)",
            borderRadius: "6px",
            cursor: "pointer"
          }}>
          Switch to {theme === "dark" ? "light" : "dark"} mode
        </button>
      </div>

      <div className="denile-canvas">
        <ReactFlow
          nodes={nodes}
          edges={diagramEdges(diagram).map((edge) => ({
            ...edge,
            selected: canEdit && selectedEdges.has(edge.id)
          }))}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={(changes) => {
            if (canEdit) {
              setSelectedEdges((previous) =>
                selectionAfter(previous, changes)
              );
              dispatch({ type: "edges", changes });
            }
          }}
          onConnect={(connection) => {
            if (canEdit)
              dispatch({ type: "connect", connection });
          }}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          elementsSelectable={canEdit}
          edgesReconnectable={false}
          deleteKeyCode={
            canEdit ? ["Backspace", "Delete"] : null
          }
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
      <DiagramLegend
        diagram={{
          ...diagram,
          equipment: diagram.equipment.map((item) => ({
            ...item,
            binding: bindings[item.id]
          }))
        }}
      />
    </div>
  );
}
