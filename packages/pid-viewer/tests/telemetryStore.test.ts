import { expect, it, vi } from "vitest";
import { createTelemetryStore } from "../src/telemetryStore";
import type {
  Reading,
  TelemetrySource
} from "../src/telemetry";

it("shares unique topic subscriptions, keeps snapshots stable, and waits for the last consumer to unsubscribe", () => {
  const receive = new Map<string, (reading: Reading) => void>();
  const stops = new Map<string, ReturnType<typeof vi.fn>>();
  const source: TelemetrySource = {
    subscribe: vi.fn((topic, listener) => {
      receive.set(topic, listener);
      const stop = vi.fn();
      stops.set(topic, stop);
      return stop;
    })
  };
  const store = createTelemetryStore(source, [
    "pressure",
    "valve",
    "pressure"
  ]);
  const first = vi.fn();
  const second = vi.fn();
  const stopFirst = store.subscribe(first);
  const stopSecond = store.subscribe(second);
  expect(source.subscribe).toHaveBeenCalledTimes(2);
  const before = store.getSnapshot();
  expect(store.getSnapshot()).toBe(before);
  receive.get("pressure")?.({ status: "available", value: 0 });
  expect(store.getSnapshot()).not.toBe(before);
  expect(store.getSnapshot().pressure).toEqual({
    status: "available",
    value: 0
  });
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledOnce();
  stopFirst();
  expect(stops.get("pressure")).not.toHaveBeenCalled();
  stopSecond();
  stopSecond();
  expect(stops.get("pressure")).toHaveBeenCalledOnce();
  expect(stops.get("valve")).toHaveBeenCalledOnce();
});

it("clears old readings on disconnect/reconnect and ignores callbacks from the old connection", () => {
  const callbacks: ((reading: Reading) => void)[] = [];
  const source: TelemetrySource = {
    subscribe: (_topic, listener) => {
      callbacks.push(listener);
      return vi.fn();
    }
  };
  const store = createTelemetryStore(source, ["pressure"]);
  const stop = store.subscribe(vi.fn());
  callbacks[0]({ status: "available", value: 123 });
  stop();
  expect(store.getSnapshot().pressure).toBeUndefined();
  const notify = vi.fn();
  const stopAgain = store.subscribe(notify);
  expect(store.getSnapshot().pressure).toBeUndefined();
  callbacks[0]({ status: "available", value: 999 });
  expect(notify).not.toHaveBeenCalled();
  expect(store.getSnapshot().pressure).toBeUndefined();
  callbacks[1]({ status: "available", value: 42 });
  expect(store.getSnapshot().pressure).toEqual({
    status: "available",
    value: 42
  });
  stopAgain();
});

it("atomically cleans up earlier topics when a later subscription fails", () => {
  const stopped = vi.fn();
  let late: ((reading: Reading) => void) | undefined;
  const source: TelemetrySource = {
    subscribe: (topic, listener) => {
      if (topic === "bad") throw new Error("Cannot subscribe");
      late = listener;
      listener({ status: "available", value: 1 });
      return stopped;
    }
  };
  const store = createTelemetryStore(source, ["good", "bad"]);
  const notify = vi.fn();
  expect(() => store.subscribe(notify)).toThrow(
    "Cannot subscribe"
  );
  expect(stopped).toHaveBeenCalledOnce();
  expect(Object.keys(store.getSnapshot())).toEqual([]);
  notify.mockClear();
  late?.({ status: "available", value: 100 });
  expect(notify).not.toHaveBeenCalled();
});

it("provides an empty SSR/disconnected snapshot and supports topic names that match object properties", () => {
  const store = createTelemetryStore(undefined, [
    "constructor",
    "toString",
    "__proto__"
  ]);
  const stop = store.subscribe(vi.fn());
  expect(store.getSnapshot().constructor).toBeUndefined();
  expect(store.getSnapshot().toString).toBeUndefined();
  expect(store.getServerSnapshot()).toBe(store.getSnapshot());
  stop();
});
