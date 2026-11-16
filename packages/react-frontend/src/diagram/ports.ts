import { Position } from "@xyflow/react";
import type { SymbolKind } from "./types";

/** One connection point. `top`/`left` are percentages of the symbol box. */
export type PortDef = {
  id: string;
  position: Position;
  top: number;
  left: number;
};

/** Symbol box size in px, and the width of the node wrapper around it. */
export const symbolSizes = {
  tank: 130,
  engine: 180,
  pneumaticValve: 70,
  checkValve: 70,
  pressureTransducer: 50
} as const satisfies Record<SymbolKind, number>;

export const NODE_WIDTH = 120;

/** Single source of truth for where pipes attach, unrotated. */
export const portDefs: Record<SymbolKind, PortDef[]> = {
  tank: [
    { id: "top", position: Position.Top, top: 4.5, left: 50 },
    {
      id: "bottom",
      position: Position.Bottom,
      top: 88.5,
      left: 50
    }
  ],
  engine: [
    {
      id: "fuel-top",
      position: Position.Top,
      top: 3.5,
      left: 42
    },
    {
      id: "oxidizer-top",
      position: Position.Top,
      top: 3.5,
      left: 58
    }
  ],
  pneumaticValve: [
    { id: "left", position: Position.Left, top: 57, left: 8 },
    {
      id: "right",
      position: Position.Right,
      top: 55.5,
      left: 58
    }
  ],
  checkValve: [
    {
      id: "left",
      position: Position.Left,
      top: 51.5,
      left: 30
    },
    {
      id: "right",
      position: Position.Right,
      top: 51.5,
      left: 55
    }
  ],
  pressureTransducer: [
    {
      id: "bottom",
      position: Position.Bottom,
      top: 71,
      left: 50
    }
  ]
};

/**
 * How much of each side of the symbol box is empty space around the drawn
 * artwork (px, unrotated). Used so labels may sit in that empty space.
 */
export const inkInset = {
  tank: { x: 36, y: 0 },
  engine: { x: 53, y: 0 },
  pneumaticValve: { x: 0, y: 4 },
  checkValve: { x: 0, y: 21 },
  pressureTransducer: { x: 5, y: 0 }
} as const satisfies Record<
  SymbolKind,
  { x: number; y: number }
>;
