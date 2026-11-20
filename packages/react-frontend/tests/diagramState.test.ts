import { expect, it } from "vitest";
import { parseDiagram } from "@de-nile/pid-viewer";
import sample from "@de-nile/pid-viewer/team-example";
import {
  createDefaultDocument,
  diagramNodes,
  diagramEdges,
  diagramReducer,
  type DiagramState
} from "../src/diagram/diagramState";

function initial(): DiagramState {
  return { diagram: parseDiagram(sample), mode: "edit" };
}

it("uses the edited document in monitoring and retains it when editing resumes", () => {
  const original = initial();
  const before = structuredClone(original);
  let state = diagramReducer(original, {
    type: "nodes",
    changes: [
      {
        type: "position",
        id: "tank1",
        position: { x: 70, y: 90 }
      }
    ]
  });
  state = diagramReducer(state, {
    type: "connect",
    connection: {
      source: "tank2",
      target: "tank3",
      sourceHandle: "bottom-source",
      targetHandle: "bottom-target"
    }
  });
  const edited = state.diagram;
  state = diagramReducer(state, {
    type: "mode",
    mode: "monitor"
  });
  expect(state.diagram).toBe(edited);
  expect(
    diagramNodes(state.diagram).find(
      (node) => node.id === "tank1"
    )?.position
  ).toEqual({ x: 70, y: 90 });
  expect(diagramEdges(state.diagram)).toHaveLength(
    before.diagram.connections.length + 1
  );
  state = diagramReducer(state, { type: "mode", mode: "edit" });
  expect(state.diagram).toBe(edited);
  expect(original).toEqual(before);
  expect(parseDiagram(JSON.stringify(edited))).toEqual(edited);
});

it("rejects document changes in monitoring, including queued drag/delete/connect callbacks", () => {
  const state: DiagramState = { ...initial(), mode: "monitor" };
  expect(
    diagramReducer(state, {
      type: "nodes",
      changes: [
        {
          type: "position",
          id: "tank1",
          position: { x: 999, y: 999 }
        },
        { type: "remove", id: "tank2" }
      ]
    })
  ).toBe(state);
  expect(
    diagramReducer(state, {
      type: "edges",
      changes: [{ type: "remove", id: "fuel-line-1" }]
    })
  ).toBe(state);
  expect(
    diagramReducer(state, {
      type: "connect",
      connection: {
        source: "tank2",
        target: "tank3",
        sourceHandle: "bottom-source",
        targetHandle: "bottom-target"
      }
    })
  ).toBe(state);
});

it("deletes attached pipes with equipment and preserves bindings and pipe presentation", () => {
  const state = diagramReducer(initial(), {
    type: "nodes",
    changes: [{ type: "remove", id: "tank1" }]
  });
  expect(
    state.diagram.connections.some(
      (edge) =>
        edge.source === "tank1" || edge.target === "tank1"
    )
  ).toBe(false);
  expect(parseDiagram(state.diagram)).toEqual(state.diagram);
  expect(
    state.diagram.equipment.find(
      (item) => item.id === "pneumatic-valve1"
    )?.binding
  ).toEqual(
    initial().diagram.equipment.find(
      (item) => item.id === "pneumatic-valve1"
    )?.binding
  );
  expect(
    diagramEdges(state.diagram).find(
      (edge) => edge.id === "fuel-line-2"
    )?.style
  ).toEqual({ stroke: "#C44900", strokeWidth: 3 });
});

it("keeps selection and measurement metadata out of the document", () => {
  const state = initial();
  expect(
    diagramReducer(state, {
      type: "nodes",
      changes: [
        {
          type: "dimensions",
          id: "tank1",
          dimensions: { width: 130, height: 140 }
        },
        { type: "select", id: "tank1", selected: true }
      ]
    })
  ).toBe(state);
  expect(
    diagramReducer(state, {
      type: "edges",
      changes: [
        { type: "select", id: "fuel-line-1", selected: true }
      ]
    })
  ).toBe(state);
});

it("lets library/import code replace the complete document in either mode without mutating input", () => {
  const next = createDefaultDocument();
  next.id = "library-diagram";
  next.name = "Imported diagram";
  for (const mode of ["edit", "monitor"] as const) {
    const state = diagramReducer(
      { ...initial(), mode },
      { type: "replace", diagram: next }
    );
    expect(state.mode).toBe(mode);
    expect(state.diagram).toEqual(next);
    next.equipment[0].position.x += 1;
    expect(state.diagram.equipment[0].position.x).not.toBe(
      next.equipment[0].position.x
    );
  }
  expect(() =>
    diagramReducer(initial(), {
      type: "replace",
      diagram: { ...next, schemaVersion: 99 } as never
    })
  ).toThrow();
});

it("does not create duplicate pipes or allow deleting the last equipment", () => {
  const state = initial();
  expect(
    diagramReducer(state, {
      type: "connect",
      connection: {
        source: "tank2",
        target: "tank1",
        sourceHandle: "top-source",
        targetHandle: "top-target"
      }
    })
  ).toBe(state);
  expect(
    diagramReducer(state, {
      type: "nodes",
      changes: state.diagram.equipment.map((item) => ({
        type: "remove",
        id: item.id
      }))
    })
  ).toBe(state);
});
