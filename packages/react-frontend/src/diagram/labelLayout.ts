import {
  getSmoothStepPath,
  type Edge,
  type Position
} from "@xyflow/react";
import type { SymbolNode } from "./types";
import {
  chooseLabelSide,
  isLegacySlot,
  labelInset,
  sideOf,
  slotSide,
  type LabelSide,
  type LabelSlot
} from "./labelPlacement";
import {
  normalizeOrientation,
  orientPoint,
  orientPosition
} from "./orientation";
import { NODE_WIDTH, portDefs, symbolSizes } from "./ports";

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

const SIDES: LabelSide[] = ["bottom", "top", "right", "left"];
const LABEL_MAX_WIDTH = 120; // matches the label box in PIDSymbolNode
const CHAR_WIDTH = 8.5; // average glyph width at the 16px UI font
const LINE_HEIGHT = 17;
const GAP = 6; // space between symbol and label
const PAD = 3; // keep-clear margin around every obstacle

// Costs: a real collision always outweighs a style preference.
const COST_COLLISION = 1000;
const COST_OWN_PORT_SIDE = 100;

/** The square symbol box inside the node wrapper, in canvas coordinates. */
function symbolRect(node: SymbolNode): Rect {
  const size = symbolSizes[node.data.kind];
  return {
    x: node.position.x + (NODE_WIDTH - size) / 2,
    y: node.position.y,
    w: size,
    h: size
  };
}

/** The part of the symbol box that is actually drawn, for collision checks. */
function inkRect(node: SymbolNode): Rect {
  const box = symbolRect(node);
  const { x: dx, y: dy } = labelInset(
    node.data.kind,
    normalizeOrientation(node.data.orientation)
  );
  return {
    x: box.x + dx,
    y: box.y + dy,
    w: box.w - 2 * dx,
    h: box.h - 2 * dy
  };
}

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Real text width in the node's own font; an estimate when there is no DOM. */
function measureWidth(text: string): number {
  if (typeof document === "undefined")
    return text.length * CHAR_WIDTH;
  if (measureContext === undefined) {
    try {
      measureContext = document
        .createElement("canvas")
        .getContext("2d");
    } catch {
      measureContext = null;
    }
  }
  if (!measureContext) return text.length * CHAR_WIDTH;
  const sample =
    document.querySelector(".react-flow__node") ??
    document.body;
  const style = getComputedStyle(sample);
  measureContext.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return measureContext.measureText(text).width;
}

/** Wrap the label like the browser will, and report the widest line. */
function labelSize(node: SymbolNode, side: LabelSide) {
  const words = node.data.label.split(/\s+/);
  // Labels beside the symbol keep a little padding; above/below do not.
  const limit =
    side === "left" || side === "right"
      ? LABEL_MAX_WIDTH - GAP
      : LABEL_MAX_WIDTH;
  const space = measureWidth(" ");
  let lines = 1;
  let widest = 0;
  let current = 0;
  for (const word of words) {
    const wordWidth = measureWidth(word);
    const joined =
      current === 0 ? wordWidth : current + space + wordWidth;
    if (current !== 0 && joined > limit) {
      lines += 1;
      current = wordWidth;
    } else {
      current = joined;
    }
    widest = Math.max(widest, current);
  }
  let height = lines * LINE_HEIGHT;
  if (node.data.kind === "pneumaticValve") height += 19;
  else if (node.data.binding) height += 20;
  return { w: Math.min(widest, LABEL_MAX_WIDTH), h: height };
}

function labelRect(node: SymbolNode, slot: LabelSlot): Rect {
  const side = slotSide(slot);
  const { w, h } = labelSize(node, side);

  // The original spots are measured from the symbol box, as they always were.
  if (isLegacySlot(node.data.kind, slot)) {
    const box = symbolRect(node);
    return node.data.kind === "pressureTransducer"
      ? { x: box.x + box.w + 7, y: box.y + 6, w, h }
      : {
          x: box.x + box.w / 2 - w / 2,
          y: box.y + box.h,
          w,
          h
        };
  }

  // Everything else hugs the drawn artwork, not the empty box around it.
  const s = inkRect(node);
  const align = slot.endsWith("-start")
    ? "start"
    : slot.endsWith("-end")
      ? "end"
      : "center";
  const alongX =
    align === "start"
      ? s.x
      : align === "end"
        ? s.x + s.w - w
        : s.x + s.w / 2 - w / 2;
  const alongY =
    align === "start"
      ? s.y
      : align === "end"
        ? s.y + s.h - h
        : s.y + s.h / 2 - h / 2;
  switch (side) {
    case "top":
      return { x: alongX, y: s.y - GAP - h, w, h };
    case "bottom":
      return { x: alongX, y: s.y + s.h + GAP, w, h };
    case "right":
      return { x: s.x + s.w + GAP, y: alongY, w, h };
    case "left":
      return { x: s.x - GAP - w, y: alongY, w, h };
  }
}

function grow(r: Rect, by: number): Rect {
  return {
    x: r.x - by,
    y: r.y - by,
    w: r.w + 2 * by,
    h: r.h + 2 * by
  };
}

function rectsOverlap(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.w &&
    b.x < a.x + a.w &&
    a.y < b.y + b.h &&
    b.y < a.y + a.h
  );
}

/** Liang-Barsky: does the segment p-q cross the rectangle? */
function segmentHitsRect(p: Point, q: Point, r: Rect) {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const clip = (d: number, dist: number) => {
    if (d === 0) return dist >= 0;
    const t = dist / d;
    if (d < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return (
    clip(-dx, p.x - r.x) &&
    clip(dx, r.x + r.w - p.x) &&
    clip(-dy, p.y - r.y) &&
    clip(dy, r.y + r.h - p.y)
  );
}

/** Canvas position and exit side of one of a node's ports, after mirror/rotate. */
function portAnchor(
  node: SymbolNode,
  handle: string | null | undefined
) {
  if (!handle) return undefined;
  const id = handle.replace(/-(source|target)$/, "");
  const def = portDefs[node.data.kind].find(
    (port) => port.id === id
  );
  if (!def) return undefined;
  const orientation = normalizeOrientation(
    node.data.orientation
  );
  const s = symbolRect(node);
  const point = orientPoint(
    { x: def.left, y: def.top },
    orientation
  );
  return {
    x: s.x + (point.x / 100) * s.w,
    y: s.y + (point.y / 100) * s.h,
    position: orientPosition(
      def.position,
      orientation
    ) as Position
  };
}

/** The pipe as a list of points, using the same router React Flow draws with. */
export function pipePath(
  edge: Edge,
  nodesById: Map<string, SymbolNode>
): Point[] {
  const from = nodesById.get(edge.source);
  const to = nodesById.get(edge.target);
  if (!from || !to) return [];
  const a = portAnchor(from, edge.sourceHandle);
  const b = portAnchor(to, edge.targetHandle);
  if (!a || !b) return [];

  if (edge.type !== "step" && edge.type !== "smoothstep") {
    return [a, b]; // straight approximation for any other edge type
  }
  const [path] = getSmoothStepPath({
    sourceX: a.x,
    sourceY: a.y,
    sourcePosition: a.position,
    targetX: b.x,
    targetY: b.y,
    targetPosition: b.position,
    borderRadius: 0
  });
  const numbers =
    path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const points: Point[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return points;
}

/**
 * Choose the label side for every node. A side loses points for sitting on
 * another component, on a pipe, on another label, or on one of the node's
 * own (possibly still unconnected) ports. The lowest total wins, so the
 * original spot stays whenever it is clear.
 */
export function computeLabelSides(
  nodes: SymbolNode[],
  edges: Edge[]
): Record<string, LabelSlot> {
  const nodesById = new Map(
    nodes.map((node) => [node.id, node])
  );
  const symbols = new Map(
    nodes.map((node) => [node.id, inkRect(node)])
  );
  const segments: { a: Point; b: Point }[] = [];
  for (const edge of edges) {
    const points = pipePath(edge, nodesById);
    for (let i = 0; i + 1 < points.length; i++) {
      segments.push({ a: points[i], b: points[i + 1] });
    }
  }

  let chosen: Record<string, LabelSlot> = {};
  // Two passes: the second lets each label see where the others landed.
  for (let pass = 0; pass < 2; pass++) {
    const next: Record<string, LabelSlot> = {};
    for (const node of nodes) {
      const orientation = normalizeOrientation(
        node.data.orientation
      );
      const preferred = chooseLabelSide(
        node.data.kind,
        orientation
      );
      const ownPortSides = new Set(
        portDefs[node.data.kind].map(
          ({ position }) =>
            sideOf[orientPosition(position, orientation)]
        )
      );
      const order = [
        preferred,
        ...SIDES.filter((side) => side !== preferred)
      ];

      let best: LabelSlot = preferred;
      let bestCost = Infinity;
      order.forEach((slot, rank) => {
        const rect = grow(labelRect(node, slot), PAD);
        let cost = rank;
        if (ownPortSides.has(slotSide(slot)))
          cost += COST_OWN_PORT_SIDE;
        for (const [id, other] of symbols) {
          if (
            id !== node.id &&
            rectsOverlap(rect, grow(other, PAD))
          ) {
            cost += COST_COLLISION;
          }
        }
        for (const { a, b } of segments) {
          if (segmentHitsRect(a, b, rect))
            cost += COST_COLLISION;
        }
        for (const other of nodes) {
          const placed = chosen[other.id];
          if (
            other.id !== node.id &&
            placed &&
            rectsOverlap(
              rect,
              grow(labelRect(other, placed), PAD)
            )
          ) {
            cost += COST_COLLISION / 2;
          }
        }
        if (cost < bestCost) {
          bestCost = cost;
          best = slot;
        }
      });
      next[node.id] = best;
    }
    chosen = next;
  }
  return chosen;
}
