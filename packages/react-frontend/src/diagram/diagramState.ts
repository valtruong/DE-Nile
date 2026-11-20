import {
  parseDiagram,
  type Diagram
} from "@de-nile/pid-viewer";
import {
  addEdge,
  type Connection,
  type NodeChange,
  type EdgeChange
} from "@xyflow/react";
import { createInitialDiagram } from "./defaultDiagram";
import { equipmentKinds } from "./equipmentKinds";
import type { SymbolKind, SymbolNode } from "./types";

export type DiagramMode = "edit" | "monitor";
export interface DiagramState {
  diagram: Diagram;
  mode: DiagramMode;
}
export type DiagramAction =
  | { type: "mode"; mode: DiagramMode }
  | { type: "replace"; diagram: Diagram }
  | { type: "nodes"; changes: NodeChange<SymbolNode>[] }
  | { type: "edges"; changes: EdgeChange[] }
  | { type: "connect"; connection: Connection };

/** Startup content only; this is not a second monitoring layout. */
export function createDefaultDocument(): Diagram {
  const { nodes, edges } = createInitialDiagram();
  return parseDiagram({
    schemaVersion: 1,
    id: "untitled",
    name: "Untitled P&ID",
    equipment: nodes.map(({ id, position, data }) => ({
      id,
      position,
      kind: equipmentKinds[data.kind],
      label: data.label
    })),
    connections: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      legendLabel: edge.legendLabel,
      color: edge.style.stroke,
      strokeWidth: edge.style.strokeWidth,
      routing: "orthogonal"
    }))
  });
}

const editorKinds = Object.fromEntries(
  Object.entries(equipmentKinds).map(([editor, saved]) => [
    saved,
    editor
  ])
) as Record<Diagram["equipment"][number]["kind"], SymbolKind>;

export function diagramNodes(diagram: Diagram): SymbolNode[] {
  return diagram.equipment.map((item) => ({
    id: item.id,
    type: "pidSymbol",
    position: { ...item.position },
    data: {
      kind: editorKinds[item.kind],
      label: item.label,
      binding: item.binding
    }
  }));
}

export function diagramEdges(diagram: Diagram) {
  return diagram.connections.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    type: "step",
    style: {
      stroke: edge.color,
      strokeWidth: edge.strokeWidth ?? 2
    }
  }));
}

/** Only document edits enter saved state. Measurements, selection and readings don't. */
export function diagramReducer(
  state: DiagramState,
  action: DiagramAction
): DiagramState {
  if (action.type === "mode")
    return { ...state, mode: action.mode };
  if (action.type === "replace")
    return { ...state, diagram: parseDiagram(action.diagram) };
  if (state.mode !== "edit") return state;
  const diagram = state.diagram;
  if (action.type === "nodes") {
    if (
      !action.changes.some(
        (c) => c.type === "position" || c.type === "remove"
      )
    )
      return state;
    const removed = new Set(
      action.changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id)
    );
    // A valid document must retain at least one component.
    if (
      removed.size &&
      diagram.equipment.every((item) => removed.has(item.id))
    )
      return state;
    const equipment = diagram.equipment
      .filter((item) => !removed.has(item.id))
      .map((item) => {
        let next = item;
        for (const change of action.changes) {
          if (
            change.type === "position" &&
            change.id === item.id &&
            change.position
          )
            next = {
              ...next,
              position: { ...change.position }
            };
        }
        return next;
      });
    return {
      ...state,
      diagram: {
        ...diagram,
        equipment,
        connections: diagram.connections.filter(
          (edge) =>
            !removed.has(edge.source) &&
            !removed.has(edge.target)
        )
      }
    };
  }
  if (action.type === "edges") {
    if (!action.changes.some((c) => c.type === "remove"))
      return state;
    const removed = new Set(
      action.changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id)
    );
    return {
      ...state,
      diagram: {
        ...diagram,
        connections: diagram.connections.filter(
          (edge) => !removed.has(edge.id)
        )
      }
    };
  }
  const { connection } = action;
  const edges = diagramEdges(diagram);
  const connected = addEdge(
    { ...connection, type: "step" },
    edges
  );
  if (connected.length === edges.length) return state;
  const edge = connected[connected.length - 1];
  const next = parseDiagram({
    ...diagram,
    connections: [
      ...diagram.connections,
      {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        routing: "orthogonal",
        color: "#667085",
        strokeWidth: 2
      }
    ]
  });
  return { ...state, diagram: next };
}
