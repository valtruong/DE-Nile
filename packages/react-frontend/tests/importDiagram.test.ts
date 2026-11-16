import example from "../../pid-viewer/src/example-diagram.json";
import { describe, expect, it } from "vitest";
import {
  ImportError,
  buildImportedDiagram,
  needsAttention,
  noFixes,
  previewDiagram,
  readImportFile,
  recognizeKind,
  resolveRows
} from "../src/diagram/importDiagram";
import { canvasToDiagram } from "../src/diagram/diagramFormat";
import { createStarterCanvas } from "../src/diagram/starterDiagram";

const file = (data: unknown) => JSON.stringify(data);

describe("reading a P&ID file", () => {
  it("imports a clean DE-Nile file unchanged", () => {
    const saved = canvasToDiagram(createStarterCanvas(), {
      id: "config-b",
      name: "Config B"
    });
    const draft = readImportFile(file(saved), "config-b.json");
    expect(draft.name).toBe("Config B");
    expect(draft.notes).toEqual([]);
    const rows = resolveRows(draft, noFixes());
    expect(rows.some(needsAttention)).toBe(false);

    const built = buildImportedDiagram(
      draft,
      noFixes(),
      "Config B"
    );
    expect(built.equipment).toEqual(saved.equipment);
    expect(built.connections).toEqual(saved.connections);
  });

  it("reads the team's example file", () => {
    const draft = readImportFile(file(example));
    expect(
      resolveRows(draft, noFixes()).some(needsAttention)
    ).toBe(false);
  });

  it.each([
    ["not json {", "isn't valid JSON"],
    [file([1, 2]), "doesn't look like"],
    [file({ schemaVersion: 2, equipment: [{}] }), "version 2"],
    [file({ schemaVersion: 1, equipment: [] }), "no components"]
  ])("refuses files it can't use: %s", (input, message) => {
    expect(() => readImportFile(input)).toThrow(ImportError);
    expect(() => readImportFile(input)).toThrow(message);
  });

  it("recognizes symbol names written different ways", () => {
    expect(recognizeKind("checkValve")).toBe("check-valve");
    expect(recognizeKind("Pressure Transducer")).toBe(
      "pressure-transducer"
    );
    expect(recognizeKind("pneumatic_valve")).toBe(
      "pneumatic-valve"
    );
    expect(recognizeKind("flow-meter")).toBe(null);
  });
});

describe("components that need attention (storyboard 3.2)", () => {
  const messy = file({
    schemaVersion: 1,
    name: "biprop_stand_rev3",
    equipment: [
      {
        id: "PT101",
        kind: "pressure-transducer",
        label: "PT101",
        position: { x: 0, y: 0 }
      },
      {
        id: "TK101",
        kind: "tank",
        label: "Fuel tank",
        position: { x: 100, y: 0 }
      },
      {
        id: "FM401",
        kind: "flow-meter",
        label: "Flow meter",
        position: { x: 200, y: 0 }
      },
      {
        kind: "check-valve",
        label: "Check valve",
        position: { x: 300, y: 0 }
      },
      {
        id: "TK101",
        kind: "tank",
        label: "Second tank",
        position: { x: 400, y: 0 }
      }
    ],
    connections: [
      { id: "a", source: "TK101", target: "PT101" },
      { id: "b", source: "TK101", target: "GONE" }
    ]
  });

  it("sorts recognized from needs-attention", () => {
    const rows = resolveRows(readImportFile(messy), noFixes());
    expect(
      rows.filter(needsAttention).map((r) => r.key)
    ).toEqual([2, 3, 4]);
    expect(rows[2]).toMatchObject({
      originalKind: "flow-meter",
      kindIssue: true
    });
    expect(rows[3].tagIssue).toBe("Add a tag");
    expect(rows[4].tagIssue).toContain("already used");
  });

  it("explains what it skipped", () => {
    const draft = readImportFile(messy);
    expect(draft.pipes.map((p) => p.id)).toEqual(["a"]);
    expect(draft.notes.join(" ")).toContain("1 pipe");
  });

  it("won't build until everything is fixed", () => {
    const draft = readImportFile(messy);
    expect(() =>
      buildImportedDiagram(draft, noFixes(), "Rev 3")
    ).toThrow(ImportError);

    const fixes = noFixes();
    fixes.kinds[2] = "pressure-transducer";
    fixes.tags[3] = "CV102";
    fixes.tags[4] = "PT101"; // still clashes
    let rows = resolveRows(draft, fixes);
    expect(rows[4].tagIssue).toBe("Tag already used");
    expect(rows[0].tagIssue).toBe("Tag already used");

    fixes.tags[4] = "TK102";
    rows = resolveRows(draft, fixes);
    expect(rows.some(needsAttention)).toBe(false);

    const diagram = buildImportedDiagram(draft, fixes, "Rev 3");
    expect(diagram.name).toBe("Rev 3");
    expect(diagram.equipment.map((e) => e.id)).toEqual([
      "PT101",
      "TK101",
      "FM401",
      "CV102",
      "TK102"
    ]);
    expect(diagram.equipment[2].kind).toBe(
      "pressure-transducer"
    );
    expect(diagram.connections).toHaveLength(1);
  });

  it("previews only the components that are ready", () => {
    const preview = previewDiagram(
      readImportFile(messy),
      noFixes()
    );
    expect(preview?.equipment.map((e) => e.id)).toEqual([
      "PT101",
      "TK101"
    ]);
  });
});

describe("filling gaps on its own", () => {
  it("places components that have no position", () => {
    const draft = readImportFile(
      file({
        equipment: [
          {
            id: "A",
            kind: "tank",
            label: "A",
            position: { x: 10, y: 50 }
          },
          { id: "B", kind: "tank", label: "B" }
        ],
        connections: []
      })
    );
    expect(draft.rows[1].position).toEqual({ x: 0, y: 250 });
    expect(draft.notes.join(" ")).toMatch(/version 1/);
    expect(draft.notes.join(" ")).toMatch(
      /1 component had no position/
    );
  });

  it("drops invalid bindings but keeps the component", () => {
    const draft = readImportFile(
      file({
        schemaVersion: 1,
        equipment: [
          {
            id: "PV1",
            kind: "pneumatic-valve",
            label: "PV1",
            position: { x: 0, y: 0 },
            binding: { topic: "", valueType: "nope" }
          }
        ],
        connections: []
      })
    );
    expect(draft.rows[0].binding).toBeUndefined();
    expect(draft.notes.join(" ")).toContain("PV1");
  });

  it("uses the tag when a label is missing, and the file name when the name is", () => {
    const draft = readImportFile(
      file({
        equipment: [
          { id: "TK9", kind: "tank", position: { x: 0, y: 0 } }
        ],
        connections: []
      }),
      "cold_flow.json"
    );
    expect(draft.name).toBe("cold_flow");
    const d = buildImportedDiagram(draft, noFixes(), "");
    expect(d.equipment[0].label).toBe("TK9");
  });
});
