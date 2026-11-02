import type { Reading, TelemetrySource } from "./telemetry";

export interface UpdateTimeoutOptions {
  /** Provisional RiverDash guidance: five seconds without received updates. */
  staleAfterMs?: number;
}

/** Detect local update silence without comparing unrelated publisher/browser clocks. */
export function withUpdateTimeout(
  source: TelemetrySource,
  { staleAfterMs = 5000 }: UpdateTimeoutOptions = {}
): TelemetrySource {
  if (
    !Number.isFinite(staleAfterMs) ||
    staleAfterMs <= 0 ||
    staleAfterMs > 2_147_483_647
  ) {
    throw new Error(
      "staleAfterMs must be positive and no greater than 2147483647"
    );
  }
  return {
    subscribe(topic, listener) {
      let disposed = false;
      let lastReceivedAt: number | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const clear = () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
      };
      const check = () => {
        if (disposed || lastReceivedAt === undefined) return;
        const remaining =
          staleAfterMs - (performance.now() - lastReceivedAt);
        // A timer may run late (or round a delay); elapsed monotonic time decides expiry.
        if (remaining > 0) {
          timer = setTimeout(check, Math.max(1, remaining));
          return;
        }
        timer = undefined;
        listener({ status: "stale", timeoutMs: staleAfterMs });
      };
      const receive = (reading: Reading) => {
        if (disposed) return;
        clear();
        if (
          reading.status === "available" ||
          reading.status === "invalid"
        ) {
          lastReceivedAt = performance.now();
          timer = setTimeout(check, staleAfterMs);
        }
        // Never invent a zero, a valve state, or a new value when the timer expires.
        listener(reading);
      };
      let unsubscribe: () => void;
      try {
        unsubscribe = source.subscribe(topic, receive);
      } catch (error) {
        disposed = true;
        clear();
        throw error;
      }
      return () => {
        if (disposed) return;
        disposed = true;
        clear();
        unsubscribe();
      };
    }
  };
}
