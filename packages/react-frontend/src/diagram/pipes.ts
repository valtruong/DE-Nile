import { connectsToItself } from "@de-nile/pid-viewer";
import type { Connection, Edge } from "@xyflow/react";

/** Same look as the pipes in the starting diagram. */
export const DEFAULT_PIPE_COLOR = "#667085";
export const PIPE_WIDTH = 3;

/** The three line types from the palette legend. */
export const LINE_TYPES = [
  { id: "fuel", label: "Fuel", color: "#C44900" },
  { id: "oxidizer", label: "Oxidizer", color: "#00A9D6" },
  {
    id: "gn2",
    label: "GN2 pressurant",
    color: DEFAULT_PIPE_COLOR
  }
] as const;

export type LineTypeId = (typeof LINE_TYPES)[number]["id"];

/** The colour each line type is drawn in. Editable, so it is not fixed. */
export type LinePalette = Record<LineTypeId, string>;

export const DEFAULT_PALETTE: LinePalette = {
  fuel: "#C44900",
  oxidizer: "#00A9D6",
  gn2: DEFAULT_PIPE_COLOR
};

/**
 * Ready-made colour sets. "Color-blind safe" keeps all three lines
 * clearly apart for red-green and blue-yellow colour blindness, and at
 * least 3:1 against both the dark and light canvas.
 */
export const COLOR_PRESETS: {
  id: string;
  label: string;
  colors: LinePalette;
}[] = [
  { id: "default", label: "Default", colors: DEFAULT_PALETTE },
  {
    id: "colorblind",
    label: "Color-blind safe",
    colors: {
      fuel: "#E8710A",
      oxidizer: "#0072B2",
      gn2: "#8E8E93"
    }
  }
];

export function sameColor(a: unknown, b: unknown) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/** The preset a palette matches exactly, or undefined for a custom one. */
export function presetFor(palette: LinePalette) {
  return COLOR_PRESETS.find((preset) =>
    LINE_TYPES.every((type) =>
      sameColor(preset.colors[type.id], palette[type.id])
    )
  );
}

export function lineTypeFor(
  color: unknown,
  palette: LinePalette = DEFAULT_PALETTE
) {
  const type = LINE_TYPES.find((candidate) =>
    sameColor(palette[candidate.id], color)
  );
  return type && { ...type, color: palette[type.id] };
}

/** Repaint every pipe drawn in one palette's colours in another's. */
export function recolorPipes(
  edges: Edge[],
  from: LinePalette,
  to: LinePalette
): Edge[] {
  return edges.map((edge) => {
    const type = lineTypeFor(edge.style?.stroke, from);
    return type
      ? {
          ...edge,
          style: { ...edge.style, stroke: to[type.id] }
        }
      : edge;
  });
}

const STORAGE_KEY = "denile.linePalette";
const HEX = /^#[0-9a-fA-F]{6}$/;

/** The palette this browser last used; falls back to the default. */
export function loadPalette(): LinePalette {
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null"
    );
    if (
      raw &&
      LINE_TYPES.every((type) => HEX.test(raw[type.id]))
    ) {
      return {
        fuel: raw.fuel,
        oxidizer: raw.oxidizer,
        gn2: raw.gn2
      };
    }
  } catch {
    // Storage can be blocked; the default is fine.
  }
  return DEFAULT_PALETTE;
}

export function savePalette(palette: LinePalette) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(palette)
    );
  } catch {
    // Not saving is harmless.
  }
}

/** Reuse the colour of a pipe already touching the component, if there is one. */
function pipeColorFor(connection: Connection, edges: Edge[]) {
  const touching = (id: string | null) =>
    edges.find(
      (edge) => edge.source === id || edge.target === id
    );
  const existing =
    touching(connection.source) ?? touching(connection.target);
  const stroke = existing?.style?.stroke;
  return typeof stroke === "string"
    ? stroke
    : DEFAULT_PIPE_COLOR;
}

/** A hand-drawn connection: square corners, 3px, matching colour. */
export function createPipe(
  connection: Connection,
  edges: Edge[],
  color?: string
): Edge {
  return {
    id: `pipe-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
    source: connection.source,
    sourceHandle: connection.sourceHandle,
    target: connection.target,
    targetHandle: connection.targetHandle,
    type: "step",
    pathOptions: { borderRadius: 0 },
    interactionWidth: 24, // easy to click even though the line is thin
    style: {
      stroke: color ?? pipeColorFor(connection, edges),
      strokeWidth: PIPE_WIDTH
    }
  } as Edge;
}

/** No pipe from a component to itself, and no duplicate of an existing pipe. */
export function canConnect(
  connection: Connection,
  edges: Edge[]
): boolean {
  if (connectsToItself(connection)) return false;
  return !edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.targetHandle === connection.targetHandle
  );
}
