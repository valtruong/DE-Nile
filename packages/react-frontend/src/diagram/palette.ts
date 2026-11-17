import type { Edge } from "@xyflow/react";
import { equipmentKinds } from "./equipmentKinds";
import { isDefaultOrientation } from "./orientation";
import type { DropPlan } from "./dropPlan";
import type { SymbolKind, SymbolNode } from "./types";

export type PaletteItem = {
  kind: SymbolKind;
  title: string;
  /** Letters that start a tag of this kind, e.g. PV for PV101. */
  tagPrefix: string;
  /** Default name that follows the tag in the label. */
  name: string;
};

/** Order matches the storyboard palette. */
export const PALETTE: PaletteItem[] = [
  {
    kind: "pressureTransducer",
    title: "Pressure transducer",
    tagPrefix: "PT",
    name: "Pressure Transducer"
  },
  {
    kind: "tank",
    title: "Tank",
    tagPrefix: "TK",
    name: "Tank"
  },
  {
    kind: "pneumaticValve",
    title: "Pneumatic valve",
    tagPrefix: "PV",
    name: "Pneumatic Valve"
  },
  {
    kind: "checkValve",
    title: "Check valve",
    tagPrefix: "CV",
    name: "Check Valve"
  },
  {
    kind: "engine",
    title: "Engine",
    tagPrefix: "LC",
    name: "Engine"
  }
];

export function paletteItem(kind: SymbolKind) {
  return PALETTE.find((item) => item.kind === kind)!;
}

const TAG = /^[A-Za-z]{1,4}\d+$/;

/** A node's tag: the stored one, or the first word of an older label. */
export function tagOf(node: SymbolNode): string {
  if (node.data.tag !== undefined) return node.data.tag;
  const first = node.data.label.split(/\s+/)[0] ?? "";
  return TAG.test(first) ? first : "";
}

/** A node's name: the stored one, or the label without its tag. */
export function nameOf(node: SymbolNode): string {
  if (node.data.name !== undefined) return node.data.name;
  const tag = tagOf(node);
  return tag
    ? node.data.label.slice(tag.length).trim()
    : node.data.label;
}

export function composeLabel(tag: string, name: string) {
  return `${tag} ${name}`.trim();
}

/** Next free tag for a kind: one above the highest number in use, else 101. */
export function nextTag(
  kind: SymbolKind,
  nodes: SymbolNode[]
): string {
  const prefix = paletteItem(kind).tagPrefix;
  let highest = 0;
  for (const node of nodes) {
    const match = tagOf(node).match(/^([A-Za-z]+)(\d+)$/);
    if (match && match[1].toUpperCase() === prefix) {
      highest = Math.max(highest, Number(match[2]));
    }
  }
  return `${prefix}${highest === 0 ? 101 : highest + 1}`;
}

/** Same ids the starting diagram uses: tank1, pneumatic-valve3, ... */
export function nextNodeId(
  kind: SymbolKind,
  nodes: SymbolNode[]
): string {
  const base = equipmentKinds[kind];
  const taken = new Set(nodes.map((node) => node.id));
  let n = 1;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

export function createNode(
  kind: SymbolKind,
  plan: DropPlan,
  nodes: SymbolNode[]
): SymbolNode {
  const item = paletteItem(kind);
  // New components are just named for their type. The tag ID stays empty
  // until the user fills it in to match the telemetry feed.
  return {
    id: nextNodeId(kind, nodes),
    type: "pidSymbol",
    position: plan.position,
    selected: true,
    data: {
      kind,
      label: item.name,
      tag: "",
      name: item.name,
      tagConfirmed: false,
      ...(isDefaultOrientation(plan.orientation)
        ? {}
        : { orientation: plan.orientation })
    }
  };
}

/** Replace one pipe with two that run through a newly dropped component. */
export function splitPipe(
  pipe: Edge,
  nodeId: string
): [Edge, Edge] {
  return [
    {
      ...pipe,
      id: `${pipe.id}-a`,
      target: nodeId,
      targetHandle: "left-target",
      selected: false
    },
    {
      ...pipe,
      id: `${pipe.id}-b`,
      source: nodeId,
      sourceHandle: "right-source",
      selected: false
    }
  ];
}
