import {
  withUpdateTimeout,
  type Scalar,
  type TelemetrySource
} from "@de-nile/pid-viewer";

// Explicit fixtures prevent an unknown tag from accidentally looking like a valve.
const signals: Record<string, (tick: number) => Scalar> = {
  "demo.pressure.pt101": (tick) => 200 + 10 * Math.sin(tick),
  "demo.pressure.pt201": (tick) => 300 + 15 * Math.cos(tick),
  "demo.valve.pv101": (tick) => (tick % 2 ? "closed" : "open"),
  "demo.valve.pv201": (tick) => (tick % 2 ? "open" : "closed")
};

/** Local display simulation only; never sends hardware commands. */
export function createSimulation() {
  let paused = false;
  const raw: TelemetrySource = {
    subscribe(topic, listener) {
      const signal = signals[topic];
      if (!signal) {
        listener({
          status: "unavailable",
          message: "No simulated signal for this topic"
        });
        return () => {};
      }
      let tick = 0;
      const publish = () => {
        if (paused) return;
        listener({
          status: "available",
          value: signal(++tick)
        });
      };
      publish();
      const timer = setInterval(publish, 1500);
      return () => clearInterval(timer);
    }
  };
  return {
    source: withUpdateTimeout(raw),
    setPaused(value: boolean) {
      paused = value;
    }
  };
}
