import {
  bindingSchema,
  parseDiagram,
  type Binding,
  type Diagram,
  type Equipment
} from "@de-nile/pid-viewer";

// Issue #32: importing a P&ID file. Reading a file is more
// forgiving than saving: instead of rejecting the whole file for
// one bad symbol, we sort components into "recognized" and "need
// attention" (unknown symbol type, missing or repeated tag), let
// the editor fix those on the review screen, and only then build
// a diagram that passes the strict shared format.

export type Kind = Equipment["kind"];

export const KIND_NAMES: Record<Kind, string> = {
  "pressure-transducer": "Pressure transducer",
  tank: "Tank",
  "pneumatic-valve": "Pneumatic valve",
  "check-valve": "Check valve",
  engine: "Engine"
};
const KINDS = Object.keys(KIND_NAMES) as Kind[];

export const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_COMPONENTS = 500;
const DEFAULT_PIPE = "#667085";

/** A problem that stops the file from being imported at all. */
export class ImportError extends Error {}

export type ImportRow = {
  key: number; // position in the file
  originalTag: string | null; // the ID in the file, if usable
  originalKind: string | null; // as written, for "Unknown symbol"
  kind: Kind | null; // null = unknown, needs a pick
  label: string;
  position: { x: number; y: number };
  binding?: Binding;
  duplicateTag: boolean; // its ID was already used above
};

type RawPipe = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  color: string;
};

export type ImportDraft = {
  name: string;
  rows: ImportRow[];
  pipes: RawPipe[];
  /** Things we fixed or dropped on our own, to tell the user. */
  notes: string[];
};

/** The editor's answers on the review screen, by row key. */
export type ImportFixes = {
  kinds: Record<number, Kind | undefined>;
  tags: Record<number, string | undefined>;
};

export const noFixes = (): ImportFixes => ({
  kinds: {},
  tags: {}
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * "checkValve", "Check Valve", "check_valve" → "check-valve".
 * Files written by the editor's own names are recognized too.
 */
export function recognizeKind(value: unknown): Kind | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
  return (KINDS as string[]).includes(normalized)
    ? (normalized as Kind)
    : null;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Read an uploaded file. Throws ImportError if it can't be used. */
export function readImportFile(
  fileText: string,
  fileName = "diagram.json"
): ImportDraft {
  let data: unknown;
  try {
    data = JSON.parse(fileText);
  } catch {
    throw new ImportError(
      "This file isn't valid JSON. Export it from DE-Nile again, or check it in a text editor."
    );
  }
  if (!isObject(data)) {
    throw new ImportError(
      "This doesn't look like a DE-Nile diagram file."
    );
  }
  if (
    data.schemaVersion !== undefined &&
    data.schemaVersion !== 1
  ) {
    throw new ImportError(
      `This file uses diagram format version ${String(
        data.schemaVersion
      )}. DE-Nile can read version 1.`
    );
  }
  if (
    !Array.isArray(data.equipment) ||
    !data.equipment.length
  ) {
    throw new ImportError(
      'This file has no components (its "equipment" list is missing or empty).'
    );
  }
  if (data.equipment.length > MAX_COMPONENTS) {
    throw new ImportError(
      `This file has ${data.equipment.length} components; DE-Nile supports up to ${MAX_COMPONENTS}.`
    );
  }

  const notes: string[] = [];
  if (data.schemaVersion === undefined) {
    notes.push(
      "The file didn't say its format version; read it as version 1."
    );
  }

  const seen = new Set<string>();
  let unplaced = 0;
  const droppedBindings: string[] = [];
  const rows: ImportRow[] = data.equipment.map((raw, key) => {
    const item = isObject(raw) ? raw : {};
    const tag = text(item.id);
    const duplicateTag = tag !== null && seen.has(tag);
    if (tag) seen.add(tag);

    const pos = isObject(item.position) ? item.position : {};
    // NaN marks "no usable position"; placed further down.
    const placed = finite(pos.x) && finite(pos.y);
    if (!placed) unplaced += 1;
    const position = placed
      ? { x: pos.x as number, y: pos.y as number }
      : { x: NaN, y: NaN };

    let binding: Binding | undefined;
    if (item.binding !== undefined) {
      const parsed = bindingSchema.safeParse(item.binding);
      if (parsed.success) binding = parsed.data;
      else droppedBindings.push(tag ?? `component ${key + 1}`);
    }

    return {
      key,
      originalTag: duplicateTag ? null : tag,
      originalKind:
        typeof item.kind === "string" ? item.kind : null,
      kind: recognizeKind(item.kind),
      label: text(item.label) ?? "",
      position,
      binding,
      duplicateTag
    };
  });

  // Components without a usable position go in a row below
  // everything else, so nothing lands on top of each other.
  if (unplaced) {
    const placed = rows.filter(
      (r) => !Number.isNaN(r.position.x)
    );
    const bottom = placed.length
      ? Math.max(...placed.map((r) => r.position.y)) + 200
      : 0;
    let i = 0;
    for (const row of rows) {
      if (Number.isNaN(row.position.x)) {
        row.position = { x: i * 160, y: bottom };
        i += 1;
      }
    }
    notes.push(
      `${plural(unplaced, "component")} had no position and ${
        unplaced === 1 ? "was" : "were"
      } placed below the diagram.`
    );
  }
  if (droppedBindings.length) {
    notes.push(
      `Telemetry bindings on ${droppedBindings.join(", ")} weren't valid and were left off.`
    );
  }

  // Pipes: keep the ones that connect two known components.
  const tags = new Set(
    rows.map((r) => r.originalTag).filter(Boolean) as string[]
  );
  const pipeIds = new Set<string>();
  const pipes: RawPipe[] = [];
  let skipped = 0;
  const rawPipes = Array.isArray(data.connections)
    ? data.connections
    : [];
  rawPipes.forEach((raw, i) => {
    const pipe = isObject(raw) ? raw : {};
    const source = text(pipe.source);
    const target = text(pipe.target);
    if (
      !source ||
      !target ||
      !tags.has(source) ||
      !tags.has(target)
    ) {
      skipped += 1;
      return;
    }
    let id = text(pipe.id) ?? `pipe-${i + 1}`;
    while (pipeIds.has(id)) id = `${id}-copy`;
    pipeIds.add(id);
    const color =
      typeof pipe.color === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(pipe.color)
        ? pipe.color
        : DEFAULT_PIPE;
    pipes.push({
      id,
      source,
      target,
      ...(text(pipe.sourceHandle)
        ? { sourceHandle: text(pipe.sourceHandle)! }
        : {}),
      ...(text(pipe.targetHandle)
        ? { targetHandle: text(pipe.targetHandle)! }
        : {}),
      ...(typeof pipe.label === "string" && pipe.label
        ? { label: pipe.label }
        : {}),
      color
    });
  });
  if (skipped) {
    notes.push(
      `${plural(skipped, "pipe")} pointed at components that aren't in the file and ${
        skipped === 1 ? "was" : "were"
      } skipped.`
    );
  }

  const baseName = fileName.replace(/\.[^.]+$/, "");
  return {
    name: (text(data.name) ?? baseName).slice(0, 100),
    rows,
    pipes,
    notes
  };
}

export type ResolvedRow = ImportRow & {
  tag: string; // current tag ("" while missing)
  finalKind: Kind | null;
  /** Why it still needs attention, if it does. */
  kindIssue: boolean;
  tagIssue: string | null;
};

/** Rows with the editor's fixes applied and what's still missing. */
export function resolveRows(
  draft: ImportDraft,
  fixes: ImportFixes
): ResolvedRow[] {
  const withTags = draft.rows.map((row) => ({
    row,
    tag: (fixes.tags[row.key] ?? row.originalTag ?? "").trim()
  }));
  const counts = new Map<string, number>();
  for (const { tag } of withTags) {
    if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return withTags.map(({ row, tag }) => {
    const finalKind = fixes.kinds[row.key] ?? row.kind;
    let tagIssue: string | null = null;
    if (!tag) {
      tagIssue = row.duplicateTag
        ? "Tag already used; give this one a new tag"
        : "Add a tag";
    } else if ((counts.get(tag) ?? 0) > 1) {
      tagIssue = "Tag already used";
    } else if (tag.length > 200) {
      tagIssue = "Tag is too long";
    }
    return {
      ...row,
      tag,
      finalKind,
      kindIssue: finalKind === null,
      tagIssue
    };
  });
}

export const needsAttention = (row: ResolvedRow) =>
  row.kindIssue || row.tagIssue !== null;

/**
 * Build the diagram to save. Call only when no row needs
 * attention; the result passes the strict shared format.
 */
export function buildImportedDiagram(
  draft: ImportDraft,
  fixes: ImportFixes,
  name: string
): Diagram {
  const rows = resolveRows(draft, fixes);
  if (rows.some(needsAttention)) {
    throw new ImportError(
      "Some components still need a type or a tag."
    );
  }
  return parseDiagram({
    schemaVersion: 1,
    id: "import",
    name: name.trim() || draft.name,
    equipment: rows.map((row) => ({
      id: row.tag,
      kind: row.finalKind!,
      label: row.label || row.tag,
      position: row.position,
      ...(row.binding ? { binding: row.binding } : {})
    })),
    connections: draft.pipes.map((pipe) => ({
      ...pipe,
      routing: "orthogonal"
    }))
  });
}

/**
 * A diagram of just the components that are ready, for the
 * preview while the editor is still fixing the rest.
 */
export function previewDiagram(
  draft: ImportDraft,
  fixes: ImportFixes
): Diagram | null {
  const ready = resolveRows(draft, fixes).filter(
    (row) => !needsAttention(row)
  );
  if (!ready.length) return null;
  const tags = new Set(ready.map((r) => r.tag));
  return parseDiagram({
    schemaVersion: 1,
    id: "preview",
    name: draft.name || "Preview",
    equipment: ready.map((row) => ({
      id: row.tag,
      kind: row.finalKind!,
      label: row.label || row.tag,
      position: row.position,
      ...(row.binding ? { binding: row.binding } : {})
    })),
    connections: draft.pipes
      .filter((p) => tags.has(p.source) && tags.has(p.target))
      .map((pipe) => ({ ...pipe, routing: "orthogonal" }))
  });
}
