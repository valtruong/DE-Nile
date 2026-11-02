import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { withUpdateTimeout } from "../src/staleness";
import {
  formatReading,
  type Reading,
  type TelemetrySource
} from "../src/telemetry";

function controlledSource(initial?: Reading) {
  const listeners = new Map<
    string,
    Set<(reading: Reading) => void>
  >();
  const cleanup = vi.fn();
  const source: TelemetrySource = {
    subscribe(topic, listener) {
      if (!listeners.has(topic))
        listeners.set(topic, new Set());
      listeners.get(topic)!.add(listener);
      if (initial) listener(initial);
      return () => {
        listeners.get(topic)!.delete(listener);
        cleanup();
      };
    }
  };
  return {
    source,
    cleanup,
    publish(topic: string, reading: Reading) {
      listeners
        .get(topic)
        ?.forEach((listener) => listener(reading));
    }
  };
}

beforeEach(() =>
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "performance",
      "Date"
    ]
  })
);
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("local update timeout", () => {
  it("marks silence at five seconds exactly, once, without inventing a reading", () => {
    const input = controlledSource({
      status: "available",
      value: 0
    });
    const listener = vi.fn();
    const stop = withUpdateTimeout(input.source).subscribe(
      "pressure",
      listener
    );
    vi.advanceTimersByTime(4999);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenLastCalledWith({
      status: "stale",
      timeoutMs: 5000
    });
    vi.advanceTimersByTime(60000);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });
  it("resets the timeout for unchanged values and recovers after a new update", () => {
    const input = controlledSource({
      status: "available",
      value: 0
    });
    const listener = vi.fn();
    const stop = withUpdateTimeout(input.source).subscribe(
      "pressure",
      listener
    );
    vi.advanceTimersByTime(4000);
    input.publish("pressure", {
      status: "available",
      value: 0
    });
    vi.advanceTimersByTime(4999);
    expect(listener.mock.lastCall?.[0].status).toBe(
      "available"
    );
    vi.advanceTimersByTime(1);
    expect(listener.mock.lastCall?.[0].status).toBe("stale");
    input.publish("pressure", {
      status: "available",
      value: 10
    });
    expect(listener.mock.lastCall?.[0]).toEqual({
      status: "available",
      value: 10
    });
    stop();
  });
  it("does not mark a missing or uninitialized topic stale", () => {
    const input = controlledSource({
      status: "unavailable",
      message: "No first value"
    });
    const listener = vi.fn();
    const stop = withUpdateTimeout(input.source).subscribe(
      "missing",
      listener
    );
    vi.advanceTimersByTime(60000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });
  it("stops the timeout when a topic becomes unavailable", () => {
    const input = controlledSource({
      status: "available",
      value: 0
    });
    const listener = vi.fn();
    const stop = withUpdateTimeout(input.source).subscribe(
      "pressure",
      listener
    );
    input.publish("pressure", {
      status: "unavailable",
      message: "Disconnected by host"
    });
    vi.advanceTimersByTime(60000);
    expect(listener.mock.lastCall?.[0].status).toBe(
      "unavailable"
    );
    expect(listener).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });
  it("keeps independent timers for each topic", () => {
    const input = controlledSource({
      status: "available",
      value: 1
    });
    const source = withUpdateTimeout(input.source);
    const pressure = vi.fn();
    const valve = vi.fn();
    const stopPressure = source.subscribe("pressure", pressure);
    const stopValve = source.subscribe("valve", valve);
    vi.advanceTimersByTime(4000);
    input.publish("pressure", {
      status: "available",
      value: 2
    });
    vi.advanceTimersByTime(1000);
    expect(pressure.mock.lastCall?.[0].status).toBe(
      "available"
    );
    expect(valve.mock.lastCall?.[0].status).toBe("stale");
    stopPressure();
    stopValve();
  });
  it("treats invalid payloads as received updates while preserving Invalid data", () => {
    const input = controlledSource({
      status: "available",
      value: 1
    });
    const listener = vi.fn();
    const stop = withUpdateTimeout(input.source).subscribe(
      "pressure",
      listener
    );
    vi.advanceTimersByTime(4000);
    input.publish("pressure", {
      status: "invalid",
      message: "Malformed value"
    });
    vi.advanceTimersByTime(4999);
    expect(listener.mock.lastCall?.[0].status).toBe("invalid");
    vi.advanceTimersByTime(1);
    expect(listener.mock.lastCall?.[0].status).toBe("stale");
    stop();
  });
  it("ignores wall-clock changes and honors a configured timeout", () => {
    const input = controlledSource({
      status: "available",
      value: 1
    });
    const listener = vi.fn();
    const stop = withUpdateTimeout(input.source, {
      staleAfterMs: 1000
    }).subscribe("pressure", listener);
    vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
    vi.advanceTimersByTime(999);
    expect(listener.mock.lastCall?.[0].status).toBe(
      "available"
    );
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenLastCalledWith({
      status: "stale",
      timeoutMs: 1000
    });
    stop();
  });
  it("removes pending timers and upstream listeners on unsubscribe", () => {
    const input = controlledSource({
      status: "available",
      value: 1
    });
    const listener = vi.fn();
    const stop = withUpdateTimeout(input.source).subscribe(
      "pressure",
      listener
    );
    stop();
    stop();
    input.publish("pressure", {
      status: "available",
      value: 2
    });
    vi.advanceTimersByTime(60000);
    expect(vi.getTimerCount()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(input.cleanup).toHaveBeenCalledOnce();
  });
  it("cleans up its timer if upstream subscription fails", () => {
    const source: TelemetrySource = {
      subscribe(_topic, listener) {
        listener({ status: "available", value: 1 });
        throw new Error("Subscription failed");
      }
    };
    expect(() =>
      withUpdateTimeout(source).subscribe("pressure", vi.fn())
    ).toThrow("Subscription failed");
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([0, -1, Infinity, NaN, 2_147_483_648])(
    "rejects invalid timeout %s",
    (staleAfterMs) => {
      expect(() =>
        withUpdateTimeout(controlledSource().source, {
          staleAfterMs
        })
      ).toThrow("staleAfterMs");
    }
  );
});

describe("freshness text", () => {
  const binding = {
    topic: "valve",
    valueType: "string" as const,
    states: [{ value: "open", label: "Open", color: "#008800" }]
  };
  it("labels cached values unconfirmed and keeps their colors neutral", () => {
    expect(
      formatReading(binding, {
        status: "available",
        value: "open",
        freshness: "unconfirmed"
      })
    ).toEqual({ text: "Open — freshness unconfirmed" });
    expect(
      formatReading(binding, {
        status: "available",
        value: "open"
      })
    ).toEqual({ text: "Open", color: "#008800" });
  });
  it("shows update silence as text rather than an equipment state", () => {
    const display = formatReading(binding, {
      status: "stale",
      timeoutMs: 5000
    });
    expect(display.text).toBe(
      "Stale — no updates received for at least 5 s"
    );
    expect(display.text).not.toContain("Open");
  });
});
