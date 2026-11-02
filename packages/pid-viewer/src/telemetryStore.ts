import type { Reading, TelemetrySource } from "./telemetry";

export type TopicReadings = Readonly<Record<string, Reading>>;
const emptyReadings: TopicReadings = Object.freeze(
  Object.create(null)
);

/** One subscription per topic, shared by consumers of a single store instance. */
export function createTelemetryStore(
  source: TelemetrySource | undefined,
  topics: readonly string[]
) {
  const names = [...new Set(topics)];
  const listeners = new Set<() => void>();
  let snapshot = emptyReadings;
  let stop: (() => void) | undefined;

  const connect = () => {
    if (!source) return;
    let active = true;
    const stops: (() => void)[] = [];
    const disconnect = () => {
      active = false;
      stops.forEach((unsubscribe) => unsubscribe());
    };
    try {
      for (const name of names) {
        stops.push(
          source.subscribe(name, (reading) => {
            if (!active) return;
            snapshot = Object.assign(
              Object.create(null),
              snapshot,
              { [name]: reading }
            );
            listeners.forEach((listener) => listener());
          })
        );
      }
    } catch (error) {
      disconnect();
      snapshot = emptyReadings;
      throw error;
    }
    stop = disconnect;
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => emptyReadings,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        try {
          connect();
        } catch (error) {
          listeners.delete(listener);
          throw error;
        }
      }
      let disposed = false;
      return () => {
        if (disposed) return;
        disposed = true;
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = undefined;
          // Reconnecting must wait for new source data, never resurrect old readings.
          snapshot = emptyReadings;
        }
      };
    }
  };
}
