import { afterEach, expect, it, vi } from "vitest";
import { createInitialDiagram } from "../src/diagram/defaultDiagram";
import { simulatedBindings } from "../src/diagram/simulatedBindings";
import { createSimulation } from "../src/diagram/simulatedTelemetry";
import type { Reading } from "@de-nile/pid-viewer";

afterEach(() => vi.useRealTimers());

it("binds only existing pressure sensors and pneumatic valves, with unique topics", () => {
  const { nodes } = createInitialDiagram();
  expect(
    new Set(
      Object.values(simulatedBindings).map(
        (binding) => binding.topic
      )
    ).size
  ).toBe(4);
  for (const [id, binding] of Object.entries(
    simulatedBindings
  )) {
    const node = nodes.find((node) => node.id === id);
    expect(node).toBeDefined();
    expect(binding.valueType).toBe(
      node?.data.kind === "pressureTransducer"
        ? "number"
        : "string"
    );
  }
});

it("routes distinct signals to the two pressure sensors and two pneumatic valves only", () => {
  vi.useFakeTimers();
  const { source } = createSimulation();
  const readings: Record<string, Reading> = {};
  const stop = Object.entries(simulatedBindings).map(
    ([id, binding]) =>
      source.subscribe(binding.topic, (reading) => {
        readings[id] = reading;
      })
  );
  expect(Object.keys(readings).sort()).toEqual([
    "pneumatic-valve1",
    "pneumatic-valve2",
    "pressure-transducer1",
    "pressure-transducer2"
  ]);
  expect(readings["pressure-transducer1"]).toEqual({
    status: "available",
    value: 200 + 10 * Math.sin(1)
  });
  expect(readings["pressure-transducer2"]).toEqual({
    status: "available",
    value: 300 + 15 * Math.cos(1)
  });
  expect(readings["pneumatic-valve1"]).toEqual({
    status: "available",
    value: "closed"
  });
  expect(readings["pneumatic-valve2"]).toEqual({
    status: "available",
    value: "open"
  });
  vi.advanceTimersByTime(1500);
  expect(readings["pneumatic-valve1"]).toEqual({
    status: "available",
    value: "open"
  });
  expect(readings["pneumatic-valve2"]).toEqual({
    status: "available",
    value: "closed"
  });
  stop.forEach((unsubscribe) => unsubscribe());
  expect(vi.getTimerCount()).toBe(0);
});

it("makes every monitored topic stale on pause, recovers, and stops after unsubscribe", () => {
  vi.useFakeTimers();
  const simulation = createSimulation();
  const diagram = createInitialDiagram();
  const saved = structuredClone(diagram);
  const listeners = Object.values(simulatedBindings).map(
    (binding) => {
      const listener = vi.fn();
      return {
        listener,
        stop: simulation.source.subscribe(
          binding.topic,
          listener
        )
      };
    }
  );
  simulation.setPaused(true);
  vi.advanceTimersByTime(4999);
  for (const { listener } of listeners)
    expect(listener).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  for (const { listener } of listeners)
    expect(listener).toHaveBeenLastCalledWith({
      status: "stale",
      timeoutMs: 5000
    });
  simulation.setPaused(false);
  vi.advanceTimersByTime(1000);
  for (const { listener, stop } of listeners) {
    expect(listener.mock.lastCall?.[0].status).toBe(
      "available"
    );
    stop();
    listener.mockClear();
  }
  vi.advanceTimersByTime(10000);
  for (const { listener } of listeners)
    expect(listener).not.toHaveBeenCalled();
  expect(diagram).toEqual(saved);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps an unknown topic unavailable instead of fabricating a valve state", () => {
  vi.useFakeTimers();
  const listener = vi.fn();
  const stop = createSimulation().source.subscribe(
    "unknown.topic",
    listener
  );
  vi.advanceTimersByTime(10000);
  expect(listener).toHaveBeenCalledExactlyOnceWith({
    status: "unavailable",
    message: "No simulated signal for this topic"
  });
  stop();
  expect(vi.getTimerCount()).toBe(0);
});
