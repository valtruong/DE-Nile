import type { Connection, Edge } from "@xyflow/react";

/** Same look as the pipes in the starting diagram. */
export const DEFAULT_PIPE_COLOR = "#667085";
export const PIPE_WIDTH = 3;

/** Reuse the colour of a pipe already touching the component, if there is one. */
function pipeColorFor(connection: Connection, edges: Edge[]) {
  const touching = (id: string | null) =>
    edges.find(
      (edge) => edge.source === id || edge.target === id
    );
  const existing =
    touching(connection.source) ?? touching(connection.target);
  const stroke = existing?.style?.stroke;
  return typeof stroke === "string"
    ? stroke
    : DEFAULT_PIPE_COLOR;
}

/** A hand-drawn connection: square corners, 3px, matching colour. */
export function createPipe(
  connection: Connection,
  edges: Edge[]
): Edge {
  return {
    id: `pipe-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
    source: connection.source,
    sourceHandle: connection.sourceHandle,
    target: connection.target,
    targetHandle: connection.targetHandle,
    type: "step",
    pathOptions: { borderRadius: 0 },
    interactionWidth: 24, // easy to click even though the line is thin
    style: {
      stroke: pipeColorFor(connection, edges),
      strokeWidth: PIPE_WIDTH
    }
  } as Edge;
}

/** No pipe from a component to itself, and no duplicate of an existing pipe. */
export function canConnect(
  connection: Connection,
  edges: Edge[]
): boolean {
  if (connection.source === connection.target) return false;
  return !edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.targetHandle === connection.targetHandle
  );
}
