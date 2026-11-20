import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { RiverDashViewer } from "../src/RiverDashViewer";
import type { PIDViewerProps } from "../src/PIDViewer";
import { parseDiagram } from "../src/diagram";
import example from "../src/example-diagram.json";
import type { ReadTopic } from "../src/telemetry";

let rendered: PIDViewerProps;
vi.mock("../src/PIDViewer", () => ({
  PIDViewer: (props: PIDViewerProps) => {
    rendered = props;
    return <div>Host viewer</div>;
  }
}));
afterEach(() => vi.unstubAllGlobals());

class Topic extends EventTarget implements ReadTopic {
  read_data() {
    return { get: () => 0 };
  }
  get_last_update_time() {
    return { toString: () => "demo timestamp" };
  }
}
class Table extends EventTarget {
  topic = new Topic();
  get_topic = vi.fn((name: string, mode: "R") => {
    expect(name).not.toBe("");
    expect(mode).toBe("R");
    return {
      match: (ok: (topic: ReadTopic) => void) => ok(this.topic)
    };
  });
}

it("accepts the host table and a replaceable diagram without constructing a socket", () => {
  const socket = vi.fn(() => {
    throw new Error("No viewer-owned socket allowed");
  });
  vi.stubGlobal("WebSocket", socket);
  const table = new Table();
  const first = parseDiagram(example);
  renderToStaticMarkup(
    <RiverDashViewer
      table={table}
      diagram={first}
      presentation="symbols"
    />
  );
  expect(rendered.diagram).toBe(first);
  expect(rendered.presentation).toBe("symbols");
  expect(table.get_topic).not.toHaveBeenCalled();
  const listener = vi.fn();
  const stop = rendered.dataSource!.subscribe(
    "demo.pressure",
    listener
  );
  expect(table.get_topic).toHaveBeenCalledExactlyOnceWith(
    "demo.pressure",
    "R"
  );
  expect(listener).toHaveBeenLastCalledWith(
    expect.objectContaining({
      value: 0,
      freshness: "unconfirmed"
    })
  );
  table.topic.dispatchEvent(
    new Event("RiverDash:TopicUpdateEvent")
  );
  expect(listener).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "available", value: 0 })
  );
  stop();
  listener.mockClear();
  table.topic.dispatchEvent(
    new Event("RiverDash:TopicUpdateEvent")
  );
  expect(listener).not.toHaveBeenCalled();
  const next = parseDiagram({
    ...example,
    id: "another-diagram",
    name: "Another diagram"
  });
  renderToStaticMarkup(
    <RiverDashViewer table={table} diagram={next} />
  );
  expect(rendered.diagram).toBe(next);
  expect(socket).not.toHaveBeenCalled();
});

it("supports a host decoder and timeout while keeping cached values unconfirmed", () => {
  vi.useFakeTimers();
  const table = new Table();
  const decode = vi.fn(() => "closed");
  let stop: (() => void) | undefined;
  try {
    renderToStaticMarkup(
      <RiverDashViewer
        table={table}
        diagram={parseDiagram(example)}
        decode={decode}
        staleAfterMs={75}
      />
    );
    const listener = vi.fn();
    stop = rendered.dataSource!.subscribe(
      "demo.valve",
      listener
    );
    expect(decode).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "closed",
        freshness: "unconfirmed"
      })
    );
    vi.advanceTimersByTime(75);
    expect(listener).toHaveBeenLastCalledWith({
      status: "stale",
      timeoutMs: 75
    });
    table.topic.dispatchEvent(
      new Event("RiverDash:TopicUpdateEvent")
    );
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "available",
        value: "closed"
      })
    );
  } finally {
    stop?.();
    vi.useRealTimers();
  }
});
