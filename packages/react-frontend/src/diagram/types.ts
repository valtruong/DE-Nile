import type { Binding, Reading } from "@de-nile/pid-viewer";
import type { Node } from "@xyflow/react";
import type { Orientation } from "./orientation";
import type { LabelSlot } from "./labelPlacement";

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
  /** Editor layout only; telemetry never changes it. */
  orientation?: Orientation;
  /** Computed from the layout while rendering; never saved. */
  labelSide?: LabelSlot;
  binding?: Binding;
  reading?: Reading;
};

export type SymbolNode = Node<SymbolNodeData, "pidSymbol">;
