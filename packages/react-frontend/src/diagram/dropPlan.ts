import type { Edge } from "@xyflow/react";
import type { SymbolKind, SymbolNode } from "./types";
import { pipePath } from "./labelLayout";
import {
  DEFAULT_ORIENTATION,
  orientPoint,
  type Orientation,
  type Rotation
} from "./orientation";
import { NODE_WIDTH, portDefs, symbolSizes } from "./ports";

type Point = { x: number; y: number };

/** Matches the canvas grid lines. */
export const GRID = 16;
/** How close (canvas px) a drop must be to a pipe to go onto it. */
export const PIPE_SNAP_DISTANCE = 24;
/** Shorter runs than this (like the stubs at a port) can't hold a valve. */
const MIN_RUN = 90;

export const snap = (value: number) =>
  Math.round(value / GRID) * GRID;

/** Symbols with an in port and an out port, which can sit inside a pipe. */
const INLINE_KINDS: SymbolKind[] = [
  "pneumaticValve",
  "checkValve"
];

export type DropPlan = {
  /** Where the node goes (top-left of its wrapper). */
  position: Point;
  orientation: Orientation;
  /** The pipe this component will be inserted into, if any. */
  pipe?: Edge;
};

function nearestPipe(
  cursor: Point,
  nodes: SymbolNode[],
  edges: Edge[]
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let best:
    | { edge: Edge; point: Point; dir: Point; distance: number }
    | undefined;
  for (const edge of edges) {
    const points = pipePath(edge, byId);
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length2 = dx * dx + dy * dy;
      if (length2 < MIN_RUN * MIN_RUN) continue;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((cursor.x - a.x) * dx + (cursor.y - a.y) * dy) /
            length2
        )
      );
      const point = { x: a.x + t * dx, y: a.y + t * dy };
      const distance = Math.hypot(
        cursor.x - point.x,
        cursor.y - point.y
      );
      if (
        distance <= PIPE_SNAP_DISTANCE &&
        (!best || distance < best.distance)
      ) {
        best = {
          edge,
          point,
          distance,
          dir:
            Math.abs(dx) >= Math.abs(dy)
              ? { x: Math.sign(dx), y: 0 }
              : { x: 0, y: Math.sign(dy) }
        };
      }
    }
  }
  return best;
}

/** Turn the symbol so its "left" port faces back up the pipe. */
function rotationFor(dir: Point): Rotation {
  if (dir.x > 0) return 0;
  if (dir.x < 0) return 180;
  return dir.y > 0 ? 90 : 270;
}

/**
 * Work out where a dragged symbol lands. It snaps to the grid. A valve or
 * check valve held over a pipe instead lines up with the pipe, turned the
 * way the pipe runs, so it can be inserted into it.
 */
export function planDrop(
  kind: SymbolKind,
  cursor: Point,
  nodes: SymbolNode[],
  edges: Edge[]
): DropPlan {
  const size = symbolSizes[kind];
  const free: DropPlan = {
    position: {
      x: snap(cursor.x - NODE_WIDTH / 2),
      y: snap(cursor.y - size / 2)
    },
    orientation: DEFAULT_ORIENTATION
  };
  if (!INLINE_KINDS.includes(kind)) return free;

  const hit = nearestPipe(cursor, nodes, edges);
  if (!hit) return free;

  const orientation: Orientation = {
    rotation: rotationFor(hit.dir),
    flipX: false
  };
  // The middle between the in and out ports is what sits on the pipe.
  const ports = portDefs[kind].filter(
    (port) => port.id === "left" || port.id === "right"
  );
  const oriented = ports.map((port) =>
    orientPoint({ x: port.left, y: port.top }, orientation)
  );
  const mid = {
    x: ((oriented[0].x + oriented[1].x) / 2 / 100) * size,
    y: ((oriented[0].y + oriented[1].y) / 2 / 100) * size
  };
  // Snap along the pipe only; across it the ports must stay exactly on it.
  const on =
    hit.dir.x !== 0
      ? { x: snap(hit.point.x), y: hit.point.y }
      : { x: hit.point.x, y: snap(hit.point.y) };
  return {
    position: {
      x: on.x - mid.x - (NODE_WIDTH - size) / 2,
      y: on.y - mid.y
    },
    orientation,
    pipe: hit.edge
  };
}
