import { describe, expect, it } from "vitest";
import { diagramSchema, parseDiagram } from "../src/diagram";
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
  // TE7 TDD: the editor already refuses to draw a pipe from a
  // component back to itself (canConnect in react-frontend's
  // pipes.ts). An imported file must follow the same rule.
  it("rejects a pipe that connects a component to itself", () => {
    const selfLoop = {
      ...example,
      connections: [
        ...example.connections,
        { id: "loop", source: "fuel-tank", target: "fuel-tank" }
      ]
    };
    const result = diagramSchema.safeParse(selfLoop);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ["connections", example.connections.length, "target"],
        message: "A pipe can't connect a component to itself"
      })
    );
  });
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
