import { describe, expect, it } from "vitest";
import { diagramProblem } from "../src/diagrams/validateDiagram.js";

// Unit tests for the server-side diagram check, with no HTTP,
// session or database involved.
function diagram(connections) {
  return {
    schemaVersion: 1,
    equipment: [
      { id: "tank1", kind: "tank", label: "TK101", position: { x: 0, y: 0 } },
      { id: "pt1", kind: "pressure-transducer", label: "PT101", position: { x: 100, y: 0 } }
    ],
    connections
  };
}

describe("diagramProblem", () => {
  it("accepts a pipe between two different components", () => {
    expect(
      diagramProblem(diagram([{ id: "l1", source: "tank1", target: "pt1" }]))
    ).toBeNull();
  });

  // TE7 TDD: written before the rule existed, and failed (Red).
  it("rejects a pipe that connects a component to itself", () => {
    expect(
      diagramProblem(diagram([{ id: "loop", source: "tank1", target: "tank1" }]))
    ).toBe("Pipe loop connects tank1 to itself.");
  });
});