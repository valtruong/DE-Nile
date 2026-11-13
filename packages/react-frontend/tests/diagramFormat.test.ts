import { describe, expect, it } from "vitest";
import {
  canvasFingerprint,
  canvasToDiagram,
  diagramToCanvas
} from "../src/diagram/diagramFormat";
import { createStarterCanvas } from "../src/diagram/starterDiagram";

const meta = { id: "config-b", name: "Config B" };

describe("canvas ↔ saved diagram", () => {
  it("round trips layout, pipes, colors, sides and bindings", () => {
    const canvas = createStarterCanvas();
    const saved = canvasToDiagram(canvas, meta);
    const reloaded = diagramToCanvas(
      JSON.parse(JSON.stringify(saved))
    );

    expect(reloaded.nodes.map((n) => n.position)).toEqual(
      canvas.nodes.map((n) => n.position)
    );
    expect(reloaded.nodes.map((n) => n.data)).toEqual(
      canvas.nodes.map((n) => n.data)
    );
    for (const [i, edge] of canvas.edges.entries()) {
      expect(reloaded.edges[i]).toMatchObject({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        style: { stroke: edge.style?.stroke }
      });
    }
    // Saving again gives exactly the same file.
    expect(canvasToDiagram(reloaded, meta)).toEqual(saved);
  });

  it("uses the shared format's names", () => {
    const saved = canvasToDiagram(createStarterCanvas(), meta);
    expect(saved).toMatchObject({ schemaVersion: 1, ...meta });
    expect(new Set(saved.equipment.map((e) => e.kind))).toEqual(
      new Set([
        "tank",
        "pressure-transducer",
        "check-valve",
        "pneumatic-valve",
        "engine"
      ])
    );
    expect(
      saved.equipment.find((e) => e.id === "pneumatic-valve1")
        ?.binding?.topic
    ).toBe("demo.valve.pv101");
  });

  it("never saves live readings or display state", () => {
    const canvas = createStarterCanvas();
    canvas.nodes[0].data.visualState = "half";
    canvas.nodes[0].data.reading = {
      value: 1,
      updatedAt: 0
    } as never;
    const text = JSON.stringify(canvasToDiagram(canvas, meta));
    expect(text).not.toContain("visualState");
    expect(text).not.toContain("reading");
  });

  it("gives new pipes the default color", () => {
    const canvas = createStarterCanvas();
    canvas.edges.push({
      id: "new-pipe",
      source: "tank1",
      target: "engine"
    });
    const saved = canvasToDiagram(canvas, meta);
    expect(saved.connections.at(-1)?.color).toBe("#667085");
  });

  it("rejects diagrams the shared format doesn't allow", () => {
    expect(() =>
      diagramToCanvas({ schemaVersion: 2, id: "x", name: "x" })
    ).toThrow();
    const canvas = createStarterCanvas();
    canvas.edges.push({
      id: "dangling",
      source: "tank1",
      target: "missing"
    });
    expect(() => canvasToDiagram(canvas, meta)).toThrow();
  });

  it("notices moves but not display-only changes", () => {
    const canvas = createStarterCanvas();
    const before = canvasFingerprint(canvas);
    canvas.nodes[0].data.visualState = "half";
    expect(canvasFingerprint(canvas)).toBe(before);
    canvas.nodes[0].position.x += 10;
    expect(canvasFingerprint(canvas)).not.toBe(before);
  });

  it("keeps two diagrams independent", () => {
    const a = diagramToCanvas(
      canvasToDiagram(createStarterCanvas(), meta)
    );
    const b = diagramToCanvas(
      canvasToDiagram(createStarterCanvas(), meta)
    );
    a.nodes[0].position.x = 999;
    a.nodes[0].data.binding = undefined;
    expect(b.nodes[0].position.x).not.toBe(999);
    expect(createStarterCanvas().nodes[0].position.x).not.toBe(
      999
    );
  });
});
