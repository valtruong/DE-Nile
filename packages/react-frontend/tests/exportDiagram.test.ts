import { describe, expect, it } from "vitest";
import { canvasToDiagram } from "../src/diagram/diagramFormat";
import {
  diagramJson,
  exportFileName,
  legendEntries
} from "../src/diagram/exportDiagram";
import {
  buildImportedDiagram,
  noFixes,
  readImportFile
} from "../src/diagram/importDiagram";
import { createStarterCanvas } from "../src/diagram/starterDiagram";

const diagram = canvasToDiagram(createStarterCanvas(), {
  id: "abc",
  name: "Fall 2026 Bipropellant Stand — Config B"
});

describe("export", () => {
  it("names files after the diagram and version", () => {
    expect(exportFileName(diagram.name, 4, "pdf")).toBe(
      "fall-2026-bipropellant-stand-config-b-v4.pdf"
    );
    expect(exportFileName("  ", 1, "json")).toBe(
      "diagram-v1.json"
    );
  });

  it("lists each line type once for the legend", () => {
    expect(legendEntries(diagram)).toEqual([
      { color: "#667085", name: "GN2 / pressurant" },
      { color: "#c44900", name: "Fuel" },
      { color: "#00a9d6", name: "Oxidizer" }
    ]);
  });

  it("writes JSON that imports back unchanged", () => {
    const draft = readImportFile(
      diagramJson(diagram),
      "x.json"
    );
    expect(draft.notes).toEqual([]);
    const again = buildImportedDiagram(
      draft,
      noFixes(),
      diagram.name
    );
    expect(again.equipment).toEqual(diagram.equipment);
    expect(again.connections).toEqual(diagram.connections);
  });
});
