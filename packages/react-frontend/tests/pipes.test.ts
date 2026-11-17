import { describe, expect, it } from "vitest";
import type { Connection, Edge } from "@xyflow/react";
import {
  DEFAULT_PIPE_COLOR,
  LINE_TYPES,
  lineTypeFor,
  PIPE_WIDTH,
  canConnect,
  createPipe
} from "../src/diagram/pipes";

const connection: Connection = {
  source: "tank2",
  sourceHandle: "bottom-source",
  target: "pneumatic-valve2",
  targetHandle: "left-target"
};

describe("hand-drawn pipes", () => {
  it("match the existing pipe style instead of the thin default curve", () => {
    const pipe = createPipe(connection, []);
    expect(pipe.type).toBe("step");
    expect(pipe.style?.strokeWidth).toBe(PIPE_WIDTH);
    expect(pipe.style?.stroke).toBe(DEFAULT_PIPE_COLOR);
    expect(pipe.interactionWidth).toBeGreaterThanOrEqual(20);
  });

  it("reuse the colour of a pipe already on the component", () => {
    const existing = {
      id: "x",
      source: "pneumatic-valve2",
      target: "check-valve2",
      style: { stroke: "#00A9D6" }
    } as Edge;
    expect(
      createPipe(connection, [existing]).style?.stroke
    ).toBe("#00A9D6");
  });

  it("refuse a pipe from a component to itself", () => {
    expect(
      canConnect({ ...connection, target: "tank2" }, [])
    ).toBe(false);
  });

  it("refuse an exact duplicate but allow a different port", () => {
    const first = createPipe(connection, []);
    expect(canConnect(connection, [first])).toBe(false);
    expect(
      canConnect(
        { ...connection, sourceHandle: "top-source" },
        [first]
      )
    ).toBe(true);
  });
});

describe("line types", () => {
  it("offer fuel, oxidizer and GN2 with the colours already used", () => {
    expect(LINE_TYPES.map((line) => line.label)).toEqual([
      "Fuel",
      "Oxidizer",
      "GN2 pressurant"
    ]);
    expect(lineTypeFor("#c44900")?.id).toBe("fuel");
    expect(lineTypeFor("#00A9D6")?.id).toBe("oxidizer");
    expect(lineTypeFor("#123456")).toBeUndefined();
  });

  it("colour a new pipe with the chosen line type", () => {
    const oxidizer = LINE_TYPES[1];
    expect(
      createPipe(connection, [], oxidizer.color).style?.stroke
    ).toBe(oxidizer.color);
  });
});
