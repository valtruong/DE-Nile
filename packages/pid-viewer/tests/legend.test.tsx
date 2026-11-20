import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  DiagramLegend,
  diagramLegendEntries
} from "../src/DiagramLegend";
import { parseDiagram } from "../src/diagram";
import config from "../src/team-diagram.json";
import { resolveEquipmentVisualState } from "../src/DiagramSymbolNode";

it("shows configured state and pipe meanings without duplicate entries for repeated equipment", () => {
  const diagram = parseDiagram(config);
  const entries = diagramLegendEntries(diagram);
  expect(
    entries
      .filter((entry) => entry.kind === "state")
      .map(({ label, color }) => ({ label, color }))
  ).toEqual([
    { label: "Open", color: "#16794b" },
    { label: "Closed", color: "#b42318" }
  ]);
  expect(
    entries
      .filter((entry) => entry.kind === "pipe")
      .map((entry) => entry.label)
  ).toEqual([
    "Other piping (demo)",
    "Fuel line (demo)",
    "Oxidizer line (demo)"
  ]);
  const html = renderToStaticMarkup(
    <DiagramLegend diagram={diagram} />
  );
  expect(html).toContain('aria-label="Color legend"');
  expect(html).toContain("Stale data");
  expect(html).toContain("Unavailable / unconfirmed");
});

it("uses custom JSON colors and identifies equipment when the same state has different colors", () => {
  const diagram = parseDiagram(config);
  const valve = diagram.equipment.find(
    (item) => item.id === "pneumatic-valve2"
  )!;
  valve.binding!.states![0]!.color = "#1234ab";
  const entries = diagramLegendEntries(diagram).filter(
    (entry) => entry.label.startsWith("Open")
  );
  expect(entries).toHaveLength(2);
  expect(entries[1]!.label).toContain("PV201");
  expect(entries[1]!.color).toBe("#1234ab");
  expect(
    renderToStaticMarkup(<DiagramLegend diagram={diagram} />)
  ).toContain("#1234ab");
});

it("keeps old configurations valid and never guesses pipe meaning from a color", () => {
  const diagram = parseDiagram(config);
  diagram.connections = diagram.connections.map(
    ({ legendLabel: _label, ...rest }) => {
      void _label;
      return rest;
    }
  );
  expect(parseDiagram(diagram)).toEqual(diagram);
  const pipes = diagramLegendEntries(diagram).filter(
    (entry) => entry.kind === "pipe"
  );
  expect(pipes).toHaveLength(3);
  expect(
    pipes.every((entry) => entry.label.startsWith("Pipe"))
  ).toBe(true);
  expect(() =>
    parseDiagram({
      ...diagram,
      connections: [
        { ...diagram.connections[0], legendLabel: " " }
      ]
    })
  ).toThrow();
});

it("uses straight closed artwork for PV201 and clears it when stale or unconfirmed", () => {
  const valve = parseDiagram(config).equipment.find(
    (item) => item.id === "pneumatic-valve2"
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
      value: "closed",
      freshness: "unconfirmed"
    })
  ).toBeUndefined();
  expect(
    resolveEquipmentVisualState(valve, {
      status: "stale",
      timeoutMs: 5000
    })
  ).toBeUndefined();
});
