import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { NodeProps } from "@xyflow/react";
import PIDSymbolNode from "../src/PIDSymbolNode";
import type { SymbolNode } from "../src/diagram/types";
import { simulatedBindings } from "../src/diagram/simulatedBindings";

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  Handle: ({ id, type }: { id: string; type: string }) => (
    <span data-handle={id} data-type={type} />
  )
}));

function render(data: SymbolNode["data"]) {
  const props: NodeProps<SymbolNode> = {
    id: "pressure-transducer1",
    type: "pidSymbol",
    data,
    dragging: false,
    selected: false,
    isConnectable: false,
    zIndex: 0,
    draggable: false,
    selectable: false,
    deletable: false,
    positionAbsoluteX: 500,
    positionAbsoluteY: 60
  };
  return renderToStaticMarkup(<PIDSymbolNode {...props} />);
}

it("preserves the original symbol, label and named handles without telemetry", () => {
  const html = render({
    kind: "pressureTransducer",
    label: "PT101 Pressure Transducer"
  });
  expect(html).toContain("PT101 Pressure Transducer");
  expect(html).toContain('data-handle="bottom-source"');
  expect(html).toContain('data-handle="bottom-target"');
  expect(html).not.toContain("pid-telemetry-reading");
  expect(html).not.toContain("Unavailable");
});

it("shows valid zero with its unit and precision below the original label", () => {
  const html = render({
    kind: "pressureTransducer",
    label: "PT101",
    binding: simulatedBindings["pressure-transducer1"],
    reading: { status: "available", value: 0 }
  });
  expect(html).toContain("0.0 kPa");
  expect(html.indexOf("0.0 kPa")).toBeGreaterThan(
    html.indexOf("PT101")
  );
  expect(html).not.toContain("Unavailable");
});

it.each(["open", "closed"])(
  "renders the configured valve state %s as readable text",
  (value) => {
    const html = render({
      kind: "pneumaticValve",
      label: "PV101",
      binding: simulatedBindings["pneumatic-valve1"],
      reading: { status: "available", value }
    });
    expect(html).toContain(
      value === "open" ? "Open" : "Closed"
    );
  }
);

it("shows unavailable before data and stale after silence instead of a current valve state", () => {
  const data: SymbolNode["data"] = {
    kind: "pneumaticValve",
    label: "PV101",
    binding: simulatedBindings["pneumatic-valve1"]
  };
  expect(render(data)).toContain("Unavailable");
  const html = render({
    ...data,
    reading: { status: "stale", timeoutMs: 5000 }
  });
  expect(html).toContain("Stale");
  expect(html).not.toContain("Closed");
  expect(html).not.toContain("Open");
});

it("keeps Valerie's valve state label without adding a duplicate telemetry label", () => {
  const html = render({
    kind: "pneumaticValve",
    label: "PV101",
    visualState: "closedPV1",
    binding: simulatedBindings["pneumatic-valve1"],
    reading: { status: "available", value: "closed" }
  });
  expect(html).toContain("CLOSED");
  expect(html.match(/>CLOSED</g)).toHaveLength(1);
  expect(html).not.toContain(">Closed<");
});

it("rotates the artwork and moves its ports without changing handle ids", () => {
  const html = render({
    kind: "pneumaticValve",
    label: "PV101",
    orientation: { rotation: 90, flipX: true }
  });
  expect(html).toContain('data-rotation="90"');
  expect(html).toContain("rotate(90deg) scaleX(-1)");
  expect(html).toContain('data-handle="left-source"');
  expect(html).toContain('data-handle="right-target"');
});

it("leaves the default orientation untouched", () => {
  const html = render({
    kind: "tank",
    label: "TK101"
  });
  expect(html).toContain('data-rotation="0"');
  expect(html).not.toContain("rotate(");
});

it("moves the label beside a rotated valve and keeps its state text with it", () => {
  const html = render({
    kind: "pneumaticValve",
    label: "PV101",
    orientation: { rotation: 90, flipX: false },
    visualState: "open"
  });
  expect(html).toContain('data-label-side="right"');
  expect(html).not.toContain('data-label-side="bottom"');
  expect(html).toContain("PV101");
  expect(html).toContain("OPEN");
});

it("keeps the label below by default when no pipe leaves there", () => {
  const html = render({ kind: "engine", label: "LC301" });
  expect(html).toContain('data-label-side="bottom"');
});