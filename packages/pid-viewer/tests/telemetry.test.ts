import { describe, expect, it, vi } from "vitest";
import {
  createRiverDashSource,
  decodeRiverDashValue,
  formatReading,
  type ReadTopic
} from "../src/telemetry";
import { parseDiagram } from "../src/diagram";
import example from "../src/example-diagram.json";

class Topic extends EventTarget implements ReadTopic {
  constructor(public value: unknown) {
    super();
  }
  read_data() {
    return this.value;
  }
  get_last_update_time() {
    return { toString: () => "publisher timestamp" };
  }
  update(value: unknown) {
    this.value = value;
    this.dispatchEvent(new Event("RiverDash:TopicUpdateEvent"));
  }
}
class Table extends EventTarget {
  topics = new Map<string, Topic>();
  get_topic = vi.fn((name: string, mode: "R") => {
    expect(mode).toBe("R");
    return {
      match: (
        ok: (topic: ReadTopic) => void,
        error: (error: unknown) => void
      ) => {
        const topic = this.topics.get(name);
        return topic ? ok(topic) : error("not initialized");
      }
    };
  });
  initialize(name: string, value: unknown) {
    const topic = new Topic(value);
    this.topics.set(name, topic);
    const event = Object.assign(
      new Event("RiverDash:GDTEventTopicInitialized"),
      { m_info: { name } }
    );
    this.dispatchEvent(event);
    return topic;
  }
}

describe("read-only RiverDash adapter", () => {
  it("reads the current value, updates only the bound topic, and cleans up", () => {
    const table = new Table();
    const pressure = table.initialize("pressure", {
      get: () => 100
    });
    const valve = table.initialize("valve", "closed");
    const listener = vi.fn();
    const unsubscribe = createRiverDashSource(
      table,
      "R"
    ).subscribe("pressure", listener);
    expect(listener).toHaveBeenLastCalledWith({
      status: "available",
      value: 100,
      freshness: "unconfirmed",
      updatedAt: "publisher timestamp"
    });
    valve.update("open");
    expect(listener).toHaveBeenCalledTimes(1);
    pressure.update({ get: () => 120 });
    expect(listener).toHaveBeenLastCalledWith({
      status: "available",
      value: 120,
      updatedAt: "publisher timestamp"
    });
    unsubscribe();
    pressure.update(999);
    table.initialize("pressure", 777);
    expect(listener).toHaveBeenCalledTimes(2);
  });
  it("recovers when a missing topic gets initialized and detaches replaced topics", () => {
    const table = new Table();
    const listener = vi.fn();
    const unsubscribe = createRiverDashSource(
      table,
      "R"
    ).subscribe("pressure", listener);
    expect(listener.mock.lastCall?.[0].status).toBe(
      "unavailable"
    );
    const old = table.initialize("pressure", 15);
    expect(listener.mock.lastCall?.[0].value).toBe(15);
    table.initialize("pressure", 20);
    old.update(999);
    expect(listener.mock.lastCall?.[0].value).toBe(20);
    unsubscribe();
  });
  it("reports invalid payloads and supports an explicit compound decoder", () => {
    const table = new Table();
    const topic = table.initialize("pressure", NaN);
    const listener = vi.fn();
    const unsubscribe = createRiverDashSource(
      table,
      "R"
    ).subscribe("pressure", listener);
    expect(listener.mock.lastCall?.[0].status).toBe("invalid");
    topic.update(10);
    expect(listener.mock.lastCall?.[0].value).toBe(10);
    unsubscribe();
    const stop = createRiverDashSource(table, "R", {
      decode: () => "custom state"
    }).subscribe("pressure", listener);
    expect(listener.mock.lastCall?.[0].value).toBe(
      "custom state"
    );
    stop();
  });
  it("labels the cached snapshot, detects silence, and clears stale state on a real topic event", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "performance"]
    });
    const table = new Table();
    const topic = table.initialize("pressure", 10);
    const listener = vi.fn();
    const stop = createRiverDashSource(table, "R").subscribe(
      "pressure",
      listener
    );
    try {
      expect(listener.mock.lastCall?.[0].freshness).toBe(
        "unconfirmed"
      );
      vi.advanceTimersByTime(5000);
      expect(listener.mock.lastCall?.[0].status).toBe("stale");
      topic.update(10);
      expect(listener.mock.lastCall?.[0]).toEqual({
        status: "available",
        value: 10,
        updatedAt: "publisher timestamp"
      });
    } finally {
      stop();
      vi.useRealTimers();
    }
  });
  it("rejects writable modes and unsafe numeric conversions", () => {
    expect(() =>
      createRiverDashSource(new Table(), "W" as "R")
    ).toThrow("read-only");
    expect(() =>
      decodeRiverDashValue(9007199254740993n)
    ).toThrow();
    expect(decodeRiverDashValue({ get: () => 12n })).toBe(12);
    expect(() =>
      decodeRiverDashValue({ compound: "unsupported" })
    ).toThrow();
  });
  it("keeps the configuration unchanged while processing live values", () => {
    const diagram = parseDiagram(example);
    const saved = JSON.stringify(diagram);
    const table = new Table();
    const source = createRiverDashSource(table, "R");
    const stop = source.subscribe("demo.pressure", vi.fn());
    table.initialize("demo.pressure", 0).update(20);
    expect(JSON.stringify(diagram)).toBe(saved);
    stop();
  });
});

describe("readable state displays", () => {
  const numeric = {
    topic: "pressure",
    valueType: "number" as const,
    unit: "kPa",
    precision: 1
  };
  it("distinguishes unavailable values from a valid zero", () => {
    expect(formatReading(numeric, undefined).text).toBe(
      "Unavailable"
    );
    expect(
      formatReading(numeric, { status: "available", value: 0 })
        .text
    ).toBe("0.0 kPa");
    expect(
      formatReading(numeric, {
        status: "available",
        value: "0"
      }).text
    ).toBe("Invalid data");
  });
  it("uses explicit state labels and never invents a state", () => {
    const binding = {
      topic: "valve",
      valueType: "number" as const,
      states: [{ value: 1, label: "Open" }]
    };
    expect(
      formatReading(binding, { status: "available", value: 1 })
        .text
    ).toBe("Open");
    expect(
      formatReading(binding, { status: "available", value: 2 })
        .text
    ).toBe("Unknown state");
    expect(formatReading(undefined, undefined).text).toBe(
      "Not bound"
    );
  });
});

it.each([NaN, Infinity, -Infinity])(
  "rejects non-finite numeric readings: %s",
  (value) => {
    expect(
      formatReading(
        { topic: "pressure", valueType: "number" },
        { status: "available", value }
      ).text
    ).toBe("Invalid data");
  }
);

it("removes table listeners when opening a RiverDash topic throws", () => {
  const table = new Table();
  table.get_topic.mockImplementation(() => {
    throw new Error("Cannot open");
  });
  const add = vi.spyOn(table, "addEventListener");
  const remove = vi.spyOn(table, "removeEventListener");
  expect(() =>
    createRiverDashSource(table, "R").subscribe(
      "pressure",
      vi.fn()
    )
  ).toThrow("Cannot open");
  expect(remove.mock.calls).toEqual(add.mock.calls);
});
