import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/diagram";
import example from "../src/example-diagram.json";

describe("diagram configuration", () => {
  it("round trips the example without losing positions or bindings", () => {
    const diagram = parseDiagram(example);
    expect(parseDiagram(JSON.stringify(diagram))).toEqual(
      diagram
    );
  });
  it.each([
    { ...example, schemaVersion: 2 },
    {
      ...example,
      equipment: [...example.equipment, example.equipment[0]]
    },
    {
      ...example,
      connections: [
        { id: "bad", source: "missing", target: "engine" }
      ]
    },
    {
      ...example,
      connections: [
        ...example.connections,
        example.connections[0]
      ]
    },
    {
      ...example,
      equipment: [
        {
          ...example.equipment[0],
          position: { x: Infinity, y: 0 }
        }
      ]
    },
    {
      ...example,
      equipment: [
        {
          ...example.equipment[0],
          binding: {
            topic: "demo",
            valueType: "number",
            states: [{ value: "open", label: "Open" }]
          }
        }
      ]
    }
  ])("rejects invalid configurations", (input) =>
    expect(() => parseDiagram(input)).toThrow()
  );
  it("rejects malformed JSON and unknown equipment kinds", () => {
    expect(() => parseDiagram("{")).toThrow();
    expect(() =>
      parseDiagram({
        ...example,
        equipment: [
          { ...example.equipment[0], kind: "unknown" }
        ]
      })
    ).toThrow();
  });
});
