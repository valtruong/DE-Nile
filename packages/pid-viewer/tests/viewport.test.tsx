// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactFlowProps } from "@xyflow/react";
import { PIDViewer } from "../src/PIDViewer";
import { RiverDashViewer } from "../src/RiverDashViewer";
import type { PIDViewerHandle } from "../src/ViewerViewport";
import { visualBounds } from "../src/ViewerViewport";
import { parseDiagram, type Diagram } from "../src/diagram";
import type { Reading } from "../src/telemetry";
import example from "../src/example-diagram.json";

const harness = vi.hoisted(() => ({
  ready: true,
  store: { width: 800, height: 500, domNode: null },
  props: {} as ReactFlowProps,
  api: {
    fitBounds: vi.fn(async () => true),
    zoomIn: vi.fn(async () => true),
    zoomOut: vi.fn(async () => true),
    getNodesBounds: vi.fn(() => ({
      x: 0,
      y: 0,
      width: 1200,
      height: 800
    })),
    getNodes: vi.fn(() => []),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 }))
  }
}));
vi.mock("@xyflow/react", async (original) => ({
  ...(await original<typeof import("@xyflow/react")>()),
  ReactFlow: (props: ReactFlowProps) => {
    harness.props = props;
    return <div>{props.children}</div>;
  },
  useReactFlow: () => harness.api,
  useNodesInitialized: () => harness.ready,
  useStore: (
    select: (state: typeof harness.store) => unknown
  ) => select(harness.store),
  Background: () => null,
  Controls: ({ children }: { children: React.ReactNode }) => (
    <div data-controls>{children}</div>
  ),
  ControlButton: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  )
}));

let root: Root;
let container: HTMLDivElement;
let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
beforeEach(() => {
  vi.clearAllMocks();
  harness.ready = true;
  harness.store = { width: 800, height: 500, domNode: null };
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  frames = new Map();
  vi.stubGlobal(
    "requestAnimationFrame",
    (fn: FrameRequestCallback) => {
      frames.set(++frameId, fn);
      return frameId;
    }
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) =>
    frames.delete(id)
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function flushFrames() {
  await act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((frame) => frame(0));
  });
}

it("forwards the host ref and theme through RiverDashViewer", async () => {
  const ref = createRef<PIDViewerHandle>();
  const table = Object.assign(new EventTarget(), {
    get_topic: vi.fn(() => ({ match: () => undefined }))
  });
  await act(() =>
    root.render(
      <RiverDashViewer
        ref={ref}
        table={table}
        diagram={parseDiagram(example)}
        theme="dark"
        showControls={false}
      />
    )
  );
  expect(ref.current).not.toBeNull();
  expect(
    container.querySelector(".denile-theme--dark")
  ).not.toBeNull();
  expect(container.querySelector("[data-controls]")).toBeNull();
  expect(table.get_topic).toHaveBeenCalledWith(
    expect.any(String),
    "R"
  );
  await act(async () => {
    await ref.current!.zoomIn();
  });
  expect(harness.api.zoomIn).toHaveBeenCalledOnce();
});

it("lets an external header zoom/fit while corner controls are hidden, then clears its ref", async () => {
  const ref = createRef<PIDViewerHandle>();
  const diagram = parseDiagram(example);
  await act(() =>
    root.render(
      <PIDViewer
        ref={ref}
        diagram={diagram}
        showControls={false}
      />
    )
  );
  await flushFrames();
  expect(container.querySelector("[data-controls]")).toBeNull();
  expect(ref.current).not.toBeNull();
  await act(async () => {
    await ref.current!.zoomIn();
    await ref.current!.zoomOut();
    await ref.current!.fitView();
  });
  expect(harness.api.zoomIn).toHaveBeenCalledOnce();
  expect(harness.api.zoomOut).toHaveBeenCalledOnce();
  expect(harness.api.fitBounds).toHaveBeenCalledTimes(2);
  expect(harness.props.nodesDraggable).toBe(false);
  expect(harness.props.nodesConnectable).toBe(false);
  expect(harness.props.minZoom).toBe(0.001);
  await act(() =>
    root.render(
      <PIDViewer
        ref={ref}
        diagram={
          {
            ...diagram,
            schemaVersion: 99
          } as unknown as Diagram
        }
      />
    )
  );
  expect(ref.current).toBeNull();
});

it("fits on container resize but never on telemetry updates or equivalent config objects", async () => {
  const diagram = parseDiagram(example);
  const before = JSON.stringify(diagram);
  let receive: ((reading: Reading) => void) | undefined;
  const source = {
    subscribe: (
      _topic: string,
      listener: (reading: Reading) => void
    ) => {
      expect(_topic).toBeTypeOf("string");
      receive = listener;
      return () => {};
    }
  };
  await act(() =>
    root.render(
      <PIDViewer diagram={diagram} dataSource={source} />
    )
  );
  await flushFrames();
  expect(harness.api.fitBounds).toHaveBeenCalledOnce();
  await act(() =>
    receive?.({ status: "available", value: 12 })
  );
  await flushFrames();
  await act(() =>
    root.render(
      <PIDViewer
        diagram={structuredClone(diagram)}
        dataSource={source}
      />
    )
  );
  await flushFrames();
  expect(harness.api.fitBounds).toHaveBeenCalledOnce();
  harness.store = { width: 320, height: 180, domNode: null };
  await act(() =>
    root.render(
      <PIDViewer diagram={diagram} dataSource={source} />
    )
  );
  await flushFrames();
  expect(harness.api.fitBounds).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(diagram)).toBe(before);
});

it("allows manual fitting with autoFit disabled and applies theme changes at runtime", async () => {
  const diagram = parseDiagram(example);
  await act(() =>
    root.render(
      <PIDViewer
        diagram={diagram}
        autoFit={false}
        theme="dark"
      />
    )
  );
  await flushFrames();
  expect(harness.api.fitBounds).not.toHaveBeenCalled();
  expect(
    container.querySelector(".denile-theme--dark")
  ).not.toBeNull();
  expect(harness.props.colorMode).toBe("dark");
  await act(() =>
    container
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Fit diagram"]'
      )!
      .click()
  );
  expect(harness.api.fitBounds).toHaveBeenCalledOnce();
  await act(() =>
    root.render(
      <PIDViewer
        diagram={diagram}
        autoFit={false}
        theme="light"
      />
    )
  );
  expect(
    container.querySelector(".denile-theme--light")
  ).not.toBeNull();
  expect(harness.props.colorMode).toBe("light");
});

it("waits for a measurable panel and cancels pending work on unmount", async () => {
  const ref = createRef<PIDViewerHandle>();
  harness.ready = false;
  await act(() =>
    root.render(
      <PIDViewer ref={ref} diagram={parseDiagram(example)} />
    )
  );
  await flushFrames();
  expect(await ref.current!.fitView()).toBe(false);
  expect(await ref.current!.zoomIn()).toBe(false);
  expect(harness.api.fitBounds).not.toHaveBeenCalled();
  harness.ready = true;
  await act(() =>
    root.render(
      <PIDViewer ref={ref} diagram={parseDiagram(example)} />
    )
  );
  expect(frames.size).toBe(1);
  await act(() => root.render(null));
  expect(frames.size).toBe(0);
  expect(ref.current).toBeNull();
});

it("includes overflowing labels in flow coordinates rather than clipping to node boxes", () => {
  const element = document.createElement("div");
  element.innerHTML =
    '<div class="react-flow__node"><div>Long pressure label</div></div>';
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 50
  } as DOMRect);
  vi.spyOn(
    element.querySelector(".react-flow__node div")!,
    "getBoundingClientRect"
  ).mockReturnValue({
    left: 280,
    top: 170,
    width: 300,
    height: 100
  } as DOMRect);
  const base = { x: 0, y: 0, width: 100, height: 50 };
  expect(
    visualBounds(base, element, { x: 20, y: 30, zoom: 2 })
  ).toEqual({ x: 0, y: 0, width: 230, height: 95 });
  expect(base).toEqual({ x: 0, y: 0, width: 100, height: 50 });
});
