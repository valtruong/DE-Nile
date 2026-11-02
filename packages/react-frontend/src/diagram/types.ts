import type { Node } from "@xyflow/react";

export type SymbolKind =
  | "checkValve"
  | "engine"
  | "pneumaticValve"
  | "pressureTransducer"
  | "tank";

export type TankState = "full" | "half" | "empty";

export type PneumaticValveState =
  | "open"
  | "closedPV1"
  | "closedPV2";

export type ComponentVisualState =
  | TankState
  | PneumaticValveState;

export type SymbolNodeData = {
  kind: SymbolKind;
  label: string;
  visualState?: ComponentVisualState;
};

export type SymbolNode = Node<SymbolNodeData, "pidSymbol">;