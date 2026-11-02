import type {
  ComponentVisualState,
  SymbolKind
} from "../diagram/types";

export type SampleTelemetryValue = "open" | "closed";

export type SampleTelemetry = Record<
  string,
  SampleTelemetryValue | ComponentVisualState
>;

/*
  Temporary sample snapshot

  Later, replace this object with values received from real telemetry from RiverDash
*/
export const sampleTelemetry: SampleTelemetry = {
  tank1: "full",
  tank2: "half",
  tank3: "empty",

  "pneumatic-valve1": "open",
  "pneumatic-valve2": "closed"
};

export function normalizeVisualState(
  nodeId: string,
  kind: SymbolKind,
  value: unknown
): ComponentVisualState | undefined {
  if (kind === "tank") {
    return value === "full" ||
      value === "half" ||
      value === "empty"
      ? value
      : undefined;
  }

  if (kind === "pneumaticValve") {
    if (value === "open") return "open";

    if (value === "closed") {
      return nodeId === "pneumatic-valve1"
        ? "closedPV1"
        : "closedPV2";
    }
  }

  return undefined;
}
