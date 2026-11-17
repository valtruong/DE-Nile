import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import {
  PALETTE,
  composeLabel,
  createNode,
  nameOf,
  nextNodeId,
  nextTag,
  splitPipe,
  tagOf
} from "../src/diagram/palette";
import { createInitialDiagram } from "../src/diagram/defaultDiagram";
import { DEFAULT_ORIENTATION } from "../src/diagram/orientation";

const diagram = createInitialDiagram();

describe("palette", () => {
  it("offers the five symbols from the storyboard, in order", () => {
    expect(PALETTE.map((item) => item.title)).toEqual([
      "Pressure transducer",
      "Tank",
      "Pneumatic valve",
      "Check valve",
      "Engine"
    ]);
  });
});

describe("tags", () => {
  it("reads the tag and name out of an existing label", () => {
    const valve = diagram.nodes.find(
      (n) => n.id === "pneumatic-valve1"
    )!;
    expect(tagOf(valve)).toBe("PV101");
    expect(nameOf(valve)).toBe("Pneumatic Valve");
    expect(composeLabel("PV101", "Pneumatic Valve")).toBe(
      valve.data.label
    );
  });

  it("gives a new component the next free tag for its kind", () => {
    expect(nextTag("pneumaticValve", diagram.nodes)).toBe(
      "PV202"
    );
    expect(nextTag("tank", diagram.nodes)).toBe("TK202");
    expect(nextTag("checkValve", diagram.nodes)).toBe("CV202");
    expect(nextTag("tank", [])).toBe("TK101");
  });
});

describe("new components", () => {
  it("get an id in the same style as the starting diagram", () => {
    expect(nextNodeId("pneumaticValve", diagram.nodes)).toBe(
      "pneumatic-valve3"
    );
    expect(nextNodeId("tank", diagram.nodes)).toBe("tank4");
    expect(nextNodeId("tank", [])).toBe("tank1");
  });

  it("start selected, unconfirmed, and at the planned spot", () => {
    const node = createNode(
      "tank",
      {
        position: { x: 32, y: 48 },
        orientation: DEFAULT_ORIENTATION
      },
      diagram.nodes
    );
    expect(node.selected).toBe(true);
    expect(node.position).toEqual({ x: 32, y: 48 });
    expect(node.data.tagConfirmed).toBe(false);
    expect(node.data.label).toBe("Tank");
    expect(node.data.tag).toBe("");
    expect(node.data.orientation).toBeUndefined();
  });

  it("keep a rotation chosen by dropping onto a pipe", () => {
    const node = createNode(
      "checkValve",
      {
        position: { x: 0, y: 0 },
        orientation: { rotation: 90, flipX: false }
      },
      diagram.nodes
    );
    expect(node.data.orientation).toEqual({
      rotation: 90,
      flipX: false
    });
  });
});

describe("splitting a pipe", () => {
  it("routes the old pipe through the new component's ports", () => {
    const pipe = {
      id: "fuel",
      source: "tank1",
      sourceHandle: "bottom-source",
      target: "engine",
      targetHandle: "fuel-top-target",
      type: "step",
      style: { stroke: "#C44900" }
    } as Edge;
    const [first, second] = splitPipe(pipe, "pneumatic-valve3");
    expect(first).toMatchObject({
      source: "tank1",
      sourceHandle: "bottom-source",
      target: "pneumatic-valve3",
      targetHandle: "left-target"
    });
    expect(second).toMatchObject({
      source: "pneumatic-valve3",
      sourceHandle: "right-source",
      target: "engine",
      targetHandle: "fuel-top-target"
    });
    // Both halves keep the colour and have distinct ids.
    expect(first.style?.stroke).toBe("#C44900");
    expect(second.style?.stroke).toBe("#C44900");
    expect(first.id).not.toBe(second.id);
  });
});
