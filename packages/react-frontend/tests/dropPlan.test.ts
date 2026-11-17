import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import { GRID, planDrop, snap } from "../src/diagram/dropPlan";
import { createInitialDiagram } from "../src/diagram/defaultDiagram";
import type {
  SymbolKind,
  SymbolNode
} from "../src/diagram/types";

function node(
  id: string,
  kind: SymbolKind,
  x: number,
  y: number
): SymbolNode {
  return {
    id,
    type: "pidSymbol",
    position: { x, y },
    data: { kind, label: id }
  };
}

const step = (
  id: string,
  s: string,
  sh: string,
  t: string,
  th: string
) =>
  ({
    id,
    source: s,
    sourceHandle: sh,
    target: t,
    targetHandle: th,
    type: "step"
  }) as Edge;

describe("snapping", () => {
  it("rounds to the canvas grid", () => {
    expect(snap(7)).toBe(0);
    expect(snap(9)).toBe(GRID);
    expect(snap(-9)).toBe(-GRID);
  });
});

describe("planDrop on empty canvas", () => {
  it("centres the symbol on the cursor and snaps to the grid", () => {
    const plan = planDrop("tank", { x: 500, y: 300 }, [], []);
    expect(plan.pipe).toBeUndefined();
    expect(plan.position.x % GRID).toBe(0);
    expect(plan.position.y % GRID).toBe(0);
    // node wrapper is 120 wide, tank box 130 tall
    expect(
      Math.abs(plan.position.x + 60 - 500)
    ).toBeLessThanOrEqual(GRID / 2);
    expect(
      Math.abs(plan.position.y + 65 - 300)
    ).toBeLessThanOrEqual(GRID / 2);
    expect(plan.orientation).toEqual({
      rotation: 0,
      flipX: false
    });
  });
});

describe("planDrop onto a pipe", () => {
  // Two check valves with a long horizontal pipe between them.
  const nodes = [
    node("a", "checkValve", 0, 0),
    node("b", "checkValve", 600, 0)
  ];
  const pipe = step(
    "p",
    "a",
    "right-source",
    "b",
    "left-target"
  );
  // The pipe runs along y of the valves' ports (~36).

  it("attaches a valve held over the pipe and keeps it facing the flow", () => {
    const plan = planDrop(
      "pneumaticValve",
      { x: 300, y: 40 },
      nodes,
      [pipe]
    );
    expect(plan.pipe?.id).toBe("p");
    expect(plan.orientation.rotation).toBe(0);
    // Its ports sit on the pipe's line (y = 36.05), not at the cursor.
    const portY = plan.position.y + 0.56 * 70;
    expect(Math.abs(portY - 36)).toBeLessThan(2);
  });

  it("turns the valve around for a pipe running right to left", () => {
    const reversed = step(
      "p",
      "b",
      "left-source",
      "a",
      "right-target"
    );
    const plan = planDrop(
      "checkValve",
      { x: 300, y: 40 },
      nodes,
      [reversed]
    );
    expect(plan.pipe?.id).toBe("p");
    expect(plan.orientation.rotation).toBe(180);
  });

  it("ignores pipes that are too far away", () => {
    const plan = planDrop(
      "pneumaticValve",
      { x: 300, y: 200 },
      nodes,
      [pipe]
    );
    expect(plan.pipe).toBeUndefined();
  });

  it("never inserts a tank, engine or transducer into a pipe", () => {
    for (const kind of [
      "tank",
      "engine",
      "pressureTransducer"
    ] as const) {
      expect(
        planDrop(kind, { x: 300, y: 40 }, nodes, [pipe]).pipe
      ).toBeUndefined();
    }
  });

  it("turns the valve to follow a vertical pipe", () => {
    const diagram = createInitialDiagram();
    // fuel-line-1 runs straight down from TK101 (x ~ 390).
    const plan = planDrop(
      "pneumaticValve",
      { x: 392, y: 330 },
      diagram.nodes,
      diagram.edges as Edge[]
    );
    expect(plan.pipe?.id).toBe("fuel-line-1");
    expect(plan.orientation.rotation).toBe(90);
  });
});
