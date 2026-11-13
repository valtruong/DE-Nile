import { createInitialDiagram } from "./defaultDiagram";
import type { Canvas } from "./diagramFormat";
import { simulatedBindings } from "./simulatedBindings";

/**
 * What "+ New diagram" starts from: the team's bipropellant
 * layout with its demo telemetry bindings attached to each
 * symbol, so every saved diagram carries its own bindings.
 */
export function createStarterCanvas(): Canvas {
  const { nodes, edges } = createInitialDiagram();
  return {
    nodes: nodes.map((node) => {
      const binding = simulatedBindings[node.id];
      return binding
        ? { ...node, data: { ...node.data, binding } }
        : node;
    }),
    edges
  };
}
