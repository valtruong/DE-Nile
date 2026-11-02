import type { Binding, Reading } from "@de-nile/pid-viewer";
import type { SymbolNode } from "../diagram/types";
import { normalizeVisualState } from "./componentStates";

/** Keep Valerie's sample states for unbound equipment; fresh bound readings win. */
export function withTelemetryReadings(
  nodes: SymbolNode[],
  bindings: Record<string, Binding>,
  readings: Record<string, Reading>
): SymbolNode[] {
  return nodes.map((node) => {
    const binding = bindings[node.id];
    if (!binding) return node;
    const reading = readings[binding.topic];
    // Never retain a sample OPEN/CLOSED symbol when its live reading is missing,
    // stale, invalid, or only a cached snapshot with unconfirmed freshness.
    const matchesBinding =
      reading?.status === "available" &&
      typeof reading.value === binding.valueType &&
      (!binding.states ||
        binding.states.some(
          (state) => state.value === reading.value
        ));
    const visualState =
      matchesBinding &&
      reading?.status === "available" &&
      !reading.freshness
        ? normalizeVisualState(
            node.id,
            node.data.kind,
            reading.value
          )
        : undefined;
    return {
      ...node,
      data: { ...node.data, binding, reading, visualState }
    };
  });
}
