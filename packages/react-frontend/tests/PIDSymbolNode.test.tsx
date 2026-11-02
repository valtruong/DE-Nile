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
  expect(html).toContain("position:absolute;top:100%");
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
  expect(html).not.toContain("pid-telemetry-reading");
});
