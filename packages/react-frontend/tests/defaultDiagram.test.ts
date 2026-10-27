import { expect, it } from "vitest";
import { createInitialDiagram } from "../src/diagram/defaultDiagram";

it("keeps equipment and pipe IDs unique and all pipe endpoints resolvable", () => {
  const { nodes, edges } = createInitialDiagram();
  const nodeIds = new Set(nodes.map((node) => node.id));
  expect(nodeIds.size).toBe(nodes.length);
  expect(new Set(edges.map((edge) => edge.id)).size).toBe(
    edges.length
  );
  for (const edge of edges) {
    expect(nodeIds.has(edge.source)).toBe(true);
    expect(nodeIds.has(edge.target)).toBe(true);
  }
});

it("isolates layout and pipe edits between canvas instances", () => {
  const first = createInitialDiagram();
  const second = createInitialDiagram();
  const saved = structuredClone(second);
  first.nodes[0].position.x += 100;
  first.nodes[0].data.label = "Edited equipment";
  first.edges[0].style.stroke = "#000000";
  first.edges.pop();
  expect(second).toEqual(saved);
  expect(createInitialDiagram()).toEqual(saved);
});
