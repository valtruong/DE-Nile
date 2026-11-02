import { useMemo, useSyncExternalStore } from "react";
import type { TelemetrySource } from "./telemetry";
import { createTelemetryStore } from "./telemetryStore";

/** Share lifecycle handling between the package viewer and the team's diagram. */
export function useTopicReadings(
  source: TelemetrySource | undefined,
  topics: readonly string[]
) {
  // Binding objects may be recreated by a host. Only topic names and source
  // identity determine subscriptions, not labels, units, or array ordering.
  const key = JSON.stringify([...new Set(topics)].sort());
  const store = useMemo(
    () =>
      createTelemetryStore(source, JSON.parse(key) as string[]),
    [source, key]
  );
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
}
