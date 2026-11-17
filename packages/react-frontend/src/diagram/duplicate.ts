import type { Edge } from "@xyflow/react";
import { GRID } from "./dropPlan";
import { composeLabel, nameOf, nextNodeId } from "./palette";
import type { SymbolNode } from "./types";

/** What Copy keeps: the components, plus pipes that join two of them. */
export type Copied = { nodes: SymbolNode[]; edges: Edge[] };

export function copySelection(
  nodes: SymbolNode[],
  edges: Edge[]
): Copied | undefined {
  const picked = nodes.filter((node) => node.selected);
  if (picked.length === 0) return undefined;
  const ids = new Set(picked.map((node) => node.id));
  return {
    nodes: picked,
    edges: edges.filter(
      (edge) => ids.has(edge.source) && ids.has(edge.target)
    )
  };
}

/**
 * New copies of the copied components, shifted so they don't sit on top of
 * the originals. A copy keeps the kind, name and orientation, but not the
 * tag ID (tags must be unique) and not the telemetry binding (that belongs
 * to the original).
 */
export function pasteCopied(
  copied: Copied,
  existingNodes: SymbolNode[],
  existingEdges: Edge[],
  step: number
): { nodes: SymbolNode[]; edges: Edge[] } {
  const shift = GRID * 2 * step;
  const pool = [...existingNodes];
  const idMap = new Map<string, string>();
  const nodes = copied.nodes.map((node) => {
    const id = nextNodeId(node.data.kind, pool);
    const copy: SymbolNode = {
      id,
      type: "pidSymbol",
      position: {
        x: node.position.x + shift,
        y: node.position.y + shift
      },
      selected: true,
      data: {
        kind: node.data.kind,
        label: composeLabel("", nameOf(node)),
        tag: "",
        name: nameOf(node),
        tagConfirmed: false,
        ...(node.data.orientation
          ? { orientation: { ...node.data.orientation } }
          : {})
      }
    };
    pool.push(copy);
    idMap.set(node.id, id);
    return copy;
  });

  const taken = new Set(existingEdges.map((edge) => edge.id));
  const edges = copied.edges.map((edge) => {
    let id = `${edge.id}-copy`;
    for (let n = 2; taken.has(id); n += 1)
      id = `${edge.id}-copy${n}`;
    taken.add(id);
    return {
      ...edge,
      id,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      selected: false
    };
  });
  return { nodes, edges };
}
