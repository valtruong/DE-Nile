import { Position } from "@xyflow/react";
import type { SymbolKind } from "./types";
import {
  orientPosition,
  type Orientation
} from "./orientation";
import { inkInset, portDefs } from "./ports";

export type LabelSide = "top" | "right" | "bottom" | "left";

/** A side, optionally slid toward the start or end of the symbol. */
export type LabelSlot =
  LabelSide | `${LabelSide}-start` | `${LabelSide}-end`;

export function slotSide(slot: LabelSlot): LabelSide {
  return slot.split("-")[0] as LabelSide;
}

/** Where each label sits today, before any rotation or flip. */
const defaultSide: Record<SymbolKind, LabelSide> = {
  tank: "bottom",
  engine: "bottom",
  pneumaticValve: "bottom",
  checkValve: "bottom",
  pressureTransducer: "right"
};

// Fallback order when the default side is taken by a pipe.
const FALLBACK: LabelSide[] = [
  "bottom",
  "top",
  "right",
  "left"
];

export const sideOf: Record<Position, LabelSide> = {
  [Position.Top]: "top",
  [Position.Right]: "right",
  [Position.Bottom]: "bottom",
  [Position.Left]: "left"
};

/** Sides with a port after the symbol is mirrored and rotated. */
export function occupiedSides(
  kind: SymbolKind,
  orientation: Orientation
): Set<LabelSide> {
  return new Set(
    portDefs[kind].map(
      ({ position }) =>
        sideOf[orientPosition(position, orientation)]
    )
  );
}

/**
 * Pick the side for the label. Keeps the original spot whenever no pipe
 * leaves from it, otherwise moves to the first side that is free.
 */
export function chooseLabelSide(
  kind: SymbolKind,
  orientation: Orientation
): LabelSide {
  const occupied = occupiedSides(kind, orientation);
  const preferred = defaultSide[kind];
  if (!occupied.has(preferred)) return preferred;
  return (
    FALLBACK.find((side) => !occupied.has(side)) ?? preferred
  );
}

/** Empty space around the artwork inside the symbol box, after rotation. */
export function labelInset(
  kind: SymbolKind,
  orientation: Orientation
): { x: number; y: number } {
  const inset = inkInset[kind];
  const turned = orientation.rotation % 180 === 90;
  return turned
    ? { x: inset.y, y: inset.x }
    : { x: inset.x, y: inset.y };
}

/** The spot labels used before they could move: below, or right of a transducer. */
export function isLegacySlot(
  kind: SymbolKind,
  slot: LabelSlot
) {
  return (
    slot ===
    (kind === "pressureTransducer" ? "right" : "bottom")
  );
}
