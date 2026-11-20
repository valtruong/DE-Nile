// Server-side check of a P&ID configuration v1 before it's
// saved. The frontend validates the full format with the shared
// zod schema in @de-nile/pid-viewer; this repeats the parts that
// keep stored data safe and loadable, so a request sent outside
// the app can't store something the viewer would choke on.

const KINDS = new Set([
  "tank",
  "check-valve",
  "pneumatic-valve",
  "pressure-transducer",
  "engine"
]);
const MAX_EQUIPMENT = 500;
const MAX_CONNECTIONS = 2000;
const MAX_TEXT = 200;

const isText = (v) =>
  typeof v === "string" &&
  v.trim().length > 0 &&
  v.length <= MAX_TEXT;
const isNumber = (v) =>
  typeof v === "number" && Number.isFinite(v);
const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function pipeEndsProblem(edge, ids) {
  if (!ids.has(edge.source) || !ids.has(edge.target)) {
    return `Pipe ${edge.id} connects to a missing component.`;
  }
  if (edge.source === edge.target) {
    return `Pipe ${edge.id} connects ${edge.source} to itself.`;
  }
  return null;
}

// Returns an error message, or null when the diagram is fine.
export function diagramProblem(diagram) {
  if (!isPlainObject(diagram)) return "Diagram is missing.";
  if (diagram.schemaVersion !== 1) {
    return "Unsupported diagram format version.";
  }
  const { equipment, connections } = diagram;
  if (!Array.isArray(equipment) || equipment.length === 0) {
    return "A diagram needs at least one component.";
  }
  if (equipment.length > MAX_EQUIPMENT) {
    return `A diagram can have at most ${MAX_EQUIPMENT} components.`;
  }
  const ids = new Set();
  for (const item of equipment) {
    if (!isPlainObject(item) || !isText(item.id)) {
      return "Every component needs an ID.";
    }
    if (ids.has(item.id)) {
      return `Two components use the ID ${item.id}.`;
    }
    ids.add(item.id);
    if (!KINDS.has(item.kind)) {
      return `${item.id} has an unknown component type.`;
    }
    if (!isText(item.label)) {
      return `${item.id} needs a label.`;
    }
    if (
      !isPlainObject(item.position) ||
      !isNumber(item.position.x) ||
      !isNumber(item.position.y)
    ) {
      return `${item.id} has an invalid position.`;
    }
    if (
      item.binding !== undefined &&
      (!isPlainObject(item.binding) ||
        !isText(item.binding.topic))
    ) {
      return `${item.id} has an invalid telemetry binding.`;
    }
  }

  if (!Array.isArray(connections)) {
    return "Connections are missing.";
  }
  if (connections.length > MAX_CONNECTIONS) {
    return `A diagram can have at most ${MAX_CONNECTIONS} pipes.`;
  }
  const edgeIds = new Set();
  for (const edge of connections) {
    if (!isPlainObject(edge) || !isText(edge.id)) {
      return "Every pipe needs an ID.";
    }
    if (edgeIds.has(edge.id)) {
      return `Two pipes use the ID ${edge.id}.`;
    }
    edgeIds.add(edge.id);
    const problem = pipeEndsProblem(edge, ids);
    if (problem) return problem;
  }
  return null;
}

export function nameProblem(name) {
  if (typeof name !== "string" || !name.trim()) {
    return "Give the diagram a name.";
  }
  if (name.trim().length > 100) {
    return "Keep the name under 100 characters.";
  }
  return null;
}
