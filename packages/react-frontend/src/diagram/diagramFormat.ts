import {
  parseDiagram,
  type Diagram,
  type Equipment
} from "@de-nile/pid-viewer";
import type { Edge } from "@xyflow/react";
import { equipmentKinds } from "./equipmentKinds";
import type { SymbolKind, SymbolNode } from "./types";

// The editor works with React Flow nodes and edges; saved
// diagrams use the team's shared P&ID configuration v1 (see
// docs/data-format.md). These two functions are the only place
// that translates between them, so saving, loading, the library
// and import all agree on one format.

export type Canvas = { nodes: SymbolNode[]; edges: Edge[] };

const DEFAULT_PIPE = "#667085";
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const kindFromEquipment = Object.fromEntries(
  Object.entries(equipmentKinds).map(
    ([kind, equipmentKind]) => [equipmentKind, kind]
  )
) as Record<Equipment["kind"], SymbolKind>;

/** How a pipe of a given color is drawn on the canvas. */
export function pipeStyle(color: string = DEFAULT_PIPE) {
  return {
    type: "step",
    pathOptions: { borderRadius: 0 },
    style: { stroke: color, strokeWidth: 3 }
  };
}

function pipeColor(edge: Edge): string {
  const stroke = edge.style?.stroke;
  return typeof stroke === "string" && HEX_COLOR.test(stroke)
    ? stroke
    : DEFAULT_PIPE;
}

/**
 * Canvas → saved format. Live readings and display-only state
 * (valve open/closed pictures) are left out: a saved diagram
 * holds layout, pipes and telemetry bindings only.
 */
export function canvasToDiagram(
  canvas: Canvas,
  meta: { id: string; name: string }
): Diagram {
  return parseDiagram({
    schemaVersion: 1,
    id: meta.id,
    name: meta.name,
    equipment: canvas.nodes.map((node) => ({
      id: node.id,
      kind: equipmentKinds[node.data.kind],
      label: node.data.label,
      position: {
        x: Math.round(node.position.x * 100) / 100,
        y: Math.round(node.position.y * 100) / 100
      },
      ...(node.data.binding
        ? { binding: node.data.binding }
        : {})
    })),
    connections: canvas.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle
        ? { sourceHandle: edge.sourceHandle }
        : {}),
      ...(edge.targetHandle
        ? { targetHandle: edge.targetHandle }
        : {}),
      ...(typeof edge.label === "string" && edge.label
        ? { label: edge.label }
        : {}),
      color: pipeColor(edge),
      routing: "orthogonal"
    }))
  });
}

/** Saved format → canvas. Validates first, so a bad file throws. */
export function diagramToCanvas(input: unknown): Canvas {
  const diagram = parseDiagram(input);
  return {
    nodes: diagram.equipment.map((item) => ({
      id: item.id,
      type: "pidSymbol",
      position: { ...item.position },
      data: {
        kind: kindFromEquipment[item.kind],
        label: item.label,
        ...(item.binding ? { binding: item.binding } : {})
      }
    })),
    edges: diagram.connections.map((connection) => ({
      id: connection.id,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? null,
      targetHandle: connection.targetHandle ?? null,
      ...(connection.label ? { label: connection.label } : {}),
      ...pipeStyle(connection.color)
    }))
  };
}

/**
 * A stable fingerprint of what would be saved, used to tell
 * whether the canvas has unsaved changes.
 */
export function canvasFingerprint(canvas: Canvas): string {
  try {
    const { equipment, connections } = canvasToDiagram(canvas, {
      id: "x",
      name: "x"
    });
    return JSON.stringify({ equipment, connections });
  } catch {
    return "invalid";
  }
}
