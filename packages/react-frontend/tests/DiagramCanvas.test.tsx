import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactFlowProps } from "@xyflow/react";
import {
  parseDiagram,
  type Reading
} from "@de-nile/pid-viewer";
import sample from "@de-nile/pid-viewer/team-example";
import { DiagramCanvas } from "../src/components/DiagramView";
import type { SymbolNode } from "../src/diagram/types";
import type { DiagramController } from "../src/diagram/useDiagramState";
import { useTelemetryReadings } from "../src/diagram/useTelemetryReadings";

let canvas: ReactFlowProps<SymbolNode>;
vi.mock("@xyflow/react", async (original) => ({
  ...(await original<typeof import("@xyflow/react")>()),
  ReactFlow: (props: ReactFlowProps<SymbolNode>) => {
    canvas = props;
    return null;
  }
}));
vi.mock("../src/diagram/useTelemetryReadings", () => ({
  useTelemetryReadings: vi.fn()
}));
beforeEach(() =>
  vi.mocked(useTelemetryReadings).mockReturnValue({})
);

function controller(
  mode: "edit" | "monitor"
): DiagramController {
  return {
    diagram: parseDiagram(sample),
    mode,
    dispatch: vi.fn()
  };
}

it("shows the mode switch for editors and never subscribes while editing", () => {
  const state = controller("edit");
  const source = { subscribe: vi.fn() };
  const html = renderToStaticMarkup(
    <DiagramCanvas
      controller={state}
      editable
      dataSource={source}
    />
  );
  expect(html).toContain("Monitor diagram");
  expect(canvas.nodesDraggable).toBe(true);
  expect(useTelemetryReadings).toHaveBeenLastCalledWith(
    undefined
  );
  expect(
    canvas.nodes?.every(
      (node) => node.data.reading === undefined
    )
  ).toBe(true);
});

it("locks all edit paths in monitoring and shows the same positions, labels, ports and pipes", () => {
  const state = controller("monitor");
  state.diagram.equipment[0].position = { x: 41, y: 72 };
  const before = structuredClone(state.diagram);
  const source = { subscribe: vi.fn() };
  const html = renderToStaticMarkup(
    <DiagramCanvas
      controller={state}
      editable
      dataSource={source}
    />
  );
  expect(html).toContain("Edit diagram");
  expect(html).toContain("Monitoring · read-only");
  expect(canvas.nodesDraggable).toBe(false);
  expect(canvas.nodesConnectable).toBe(false);
  expect(canvas.elementsSelectable).toBe(false);
  expect(canvas.deleteKeyCode).toBeNull();
  expect(canvas.nodes?.[0].position).toEqual({ x: 41, y: 72 });
  expect(canvas.nodes?.[0].data.label).toBe(
    before.equipment[0].label
  );
  expect(canvas.edges?.[0].sourceHandle).toBe(
    before.connections[0].sourceHandle
  );
  canvas.onNodesChange?.([{ type: "remove", id: "tank1" }]);
  canvas.onEdgesChange?.([
    { type: "remove", id: "fuel-line-1" }
  ]);
  canvas.onConnect?.({
    source: "tank1",
    target: "tank3",
    sourceHandle: null,
    targetHandle: null
  });
  expect(state.dispatch).not.toHaveBeenCalled();
  expect(state.diagram).toEqual(before);
  expect(useTelemetryReadings).toHaveBeenLastCalledWith(
    expect.objectContaining({ source })
  );
});

it.each([
  { status: "available", value: "open" },
  { status: "available", value: "closed" },
  { status: "stale", timeoutMs: 5000 },
  {
    status: "available",
    value: "open",
    freshness: "unconfirmed"
  }
] satisfies Reading[])(
  "keeps %j telemetry out of the saved document",
  (reading) => {
    const state = controller("monitor");
    const before = JSON.stringify(state.diagram);
    vi.mocked(useTelemetryReadings).mockReturnValue({
      "demo.valve.pv101": reading
    });
    renderToStaticMarkup(
      <DiagramCanvas controller={state} editable />
    );
    const valve = canvas.nodes?.find(
      (node) => node.id === "pneumatic-valve1"
    );
    expect(valve?.data.reading).toEqual(reading);
    expect(valve?.data.visualState).toBe(
      reading.status === "available" && !reading.freshness
        ? reading.value === "open"
          ? "open"
          : "closedPV1"
        : undefined
    );
    expect(JSON.stringify(state.diagram)).toBe(before);
    expect(state.dispatch).not.toHaveBeenCalled();
  }
);

it("keeps viewers locked even if supplied an edit-mode controller", () => {
  const state = controller("edit");
  const html = renderToStaticMarkup(
    <DiagramCanvas controller={state} editable={false} />
  );
  expect(html).not.toContain("Monitor diagram</button>");
  expect(html).not.toContain("Edit diagram</button>");
  expect(canvas.nodesDraggable).toBe(false);
});
