import { expect, it } from "vitest";
import { parseDiagram } from "@de-nile/pid-viewer";
import config from "@de-nile/pid-viewer/team-example";
import { createInitialDiagram } from "../src/diagram/defaultDiagram";
import { equipmentKinds } from "../src/diagram/equipmentKinds";
import { simulatedBindings } from "../src/diagram/simulatedBindings";

it("ships Valerie's current layout without losing IDs, positions or pipe endpoints", () => {
  const sample = parseDiagram(config);
  const original = createInitialDiagram();
  expect(
    sample.equipment.map(({ id, kind, label, position }) => ({
      id,
      kind,
      label,
      position
    }))
  ).toEqual(
    original.nodes.map((n) => ({
      id: n.id,
      kind: equipmentKinds[n.data.kind],
      label: n.data.label,
      position: n.position
    }))
  );
  expect(sample.connections).toEqual(
    original.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      legendLabel: e.legendLabel,
      color: e.style.stroke,
      strokeWidth: e.style.strokeWidth,
      routing: "orthogonal"
    }))
  );
  for (const item of sample.equipment) {
    const { states, ...rest } = item.binding ?? {};
    const expected = simulatedBindings[item.id];
    if (!expected) expect(item.binding).toBeUndefined();
    else {
      expect(rest).toEqual(
        Object.fromEntries(
          Object.entries(expected).filter(
            ([key]) => key !== "states"
          )
        )
      );
      expect(
        states?.map(({ value, label, color }) => ({
          value,
          label,
          color
        }))
      ).toEqual(
        expected.states?.map(({ value, label, color }) => ({
          value,
          label,
          color
        }))
      );
    }
  }
});
