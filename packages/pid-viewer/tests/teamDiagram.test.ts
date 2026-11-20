import { expect, it } from "vitest";
import config from "../src/team-diagram.json";
import { parseDiagram } from "../src/diagram";
import { resolveEquipmentVisualState } from "../src/DiagramSymbolNode";

it("validates and round-trips the full team diagram, ports and explicit artwork mappings", () => {
  const diagram = parseDiagram(config);
  expect(diagram.equipment).toHaveLength(10);
  expect(diagram.connections).toHaveLength(9);
  expect(parseDiagram(JSON.stringify(diagram))).toEqual(
    diagram
  );
});
it("rejects a pipe attached to a port that the equipment does not have", () => {
  const broken = structuredClone(config);
  broken.connections[0]!.sourceHandle = "left-source";
  expect(() => parseDiagram(broken)).toThrow(
    "Unknown equipment port"
  );
});
it("changes valve artwork only for confirmed values and clears it for stale or missing data", () => {
  const diagram = parseDiagram(config);
  const valve = diagram.equipment.find(
    (e) => e.id === "pneumatic-valve1"
  )!;
  expect(
    resolveEquipmentVisualState(valve, {
      status: "available",
      value: "open"
    })
  ).toBe("open");
  expect(
    resolveEquipmentVisualState(valve, {
      status: "available",
      value: "closed"
    })
  ).toBe("closedPV1");
  expect(
    resolveEquipmentVisualState(valve, {
      status: "available",
      value: "open",
      freshness: "unconfirmed"
    })
  ).toBeUndefined();
  expect(
    resolveEquipmentVisualState(valve, {
      status: "stale",
      timeoutMs: 5000
    })
  ).toBeUndefined();
  expect(resolveEquipmentVisualState(valve)).toBeUndefined();
  expect(
    resolveEquipmentVisualState(valve, {
      status: "available",
      value: 1
    })
  ).toBeUndefined();
  expect(
    resolveEquipmentVisualState(valve, {
      status: "available",
      value: "unknown"
    })
  ).toBeUndefined();
  expect(
    resolveEquipmentVisualState(
      diagram.equipment.find(
        (e) => e.id === "pneumatic-valve2"
      )!,
      { status: "available", value: "closed" }
    )
  ).toBe("closedPV1");
});
