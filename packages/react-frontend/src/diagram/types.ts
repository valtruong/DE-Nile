import type { Binding, Reading } from "@de-nile/pid-viewer";
import type { Node } from "@xyflow/react";

export type SymbolKind =
  | "checkValve"
  | "engine"
  | "pneumaticValve"
  | "pressureTransducer"
  | "tank";

export type TankState = "full" | "half" | "empty";

export type PneumaticValveState =
  "open" | "closedPV1" | "closedPV2";

export type ComponentVisualState =
  TankState | PneumaticValveState;

export type SymbolNodeData = {
  kind: SymbolKind;
  label: string;
  visualState?: ComponentVisualState;
  binding?: Binding;
  reading?: Reading;
};

export type SymbolNode = Node<SymbolNodeData, "pidSymbol">;
