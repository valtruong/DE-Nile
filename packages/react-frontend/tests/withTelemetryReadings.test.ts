import { expect, it } from "vitest";
import { createInitialDiagram } from "../src/diagram/defaultDiagram";
import { simulatedBindings } from "../src/diagram/simulatedBindings";
import { withTelemetryReadings } from "../src/telemetry/withTelemetryReadings";
import {
  normalizeVisualState,
  sampleTelemetry
} from "../src/telemetry/componentStates";
import type { Reading } from "@de-nile/pid-viewer";

function nodes() {
  return createInitialDiagram().nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      visualState: normalizeVisualState(
        node.id,
        node.data.kind,
        sampleTelemetry[node.id]
      )
    }
  }));
}
it("drives Valerie's distinct closed symbols with fresh readings, preserving layout and sample tanks", () => {
  const original = nodes();
  const saved = structuredClone(original);
  const result = withTelemetryReadings(
    original,
    simulatedBindings,
    {
      "demo.valve.pv101": {
        status: "available",
        value: "closed"
      },
      "demo.valve.pv201": {
        status: "available",
        value: "closed"
      },
      "demo.pressure.pt101": { status: "available", value: 0 }
    }
  );
  expect(
    result.find((node) => node.id === "pneumatic-valve1")?.data
      .visualState
  ).toBe("closedPV1");
  expect(
    result.find((node) => node.id === "pneumatic-valve2")?.data
      .visualState
  ).toBe("closedPV2");
  expect(
    result.find((node) => node.id === "tank1")?.data.visualState
  ).toBe("full");
  expect(
    result.find((node) => node.id === "pressure-transducer1")
      ?.data.reading
  ).toEqual({ status: "available", value: 0 });
  expect(
    result.map((node) => ({
      id: node.id,
      position: node.position
    }))
  ).toEqual(
    original.map((node) => ({
      id: node.id,
      position: node.position
    }))
  );
  expect(original).toEqual(saved);
});
it.each([
  undefined,
  { status: "stale", timeoutMs: 5000 },
  { status: "unavailable", message: "Disconnected" },
  { status: "invalid", message: "Invalid data" },
  {
    status: "available",
    value: "open",
    freshness: "unconfirmed"
  },
  { status: "available", value: "unexpected" }
] satisfies (Reading | undefined)[])(
  "does not present a sample valve state as current for %j",
  (reading) => {
    const result = withTelemetryReadings(
      nodes(),
      simulatedBindings,
      reading ? { "demo.valve.pv101": reading } : {}
    );
    expect(
      result.find((node) => node.id === "pneumatic-valve1")
        ?.data.visualState
    ).toBeUndefined();
  }
);
it("can also drive tank fill artwork when a tank receives an explicit binding", () => {
  const result = withTelemetryReadings(
    nodes(),
    { tank1: { topic: "test.tank", valueType: "string" } },
    {
      "test.tank": { status: "available", value: "half" }
    }
  );
  expect(
    result.find((node) => node.id === "tank1")?.data.visualState
  ).toBe("half");
});

it("does not display valve artwork for a reading that violates its binding type or allowed states", () => {
  const readings: Record<string, Reading> = {
    "test.valve": { status: "available", value: "open" }
  };
  for (const binding of [
    { topic: "test.valve", valueType: "number" as const },
    {
      topic: "test.valve",
      valueType: "string" as const,
      states: [{ value: "closed", label: "Closed" }]
    }
  ]) {
    const result = withTelemetryReadings(
      nodes(),
      { "pneumatic-valve1": binding },
      readings
    );
    expect(
      result.find((node) => node.id === "pneumatic-valve1")
        ?.data.visualState
    ).toBeUndefined();
  }
});
