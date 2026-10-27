import type { Node } from "@xyflow/react";

// Preserve the editor's existing equipment names independently of its renderer.
export type SymbolKind =
  | "checkValve"
  | "engine"
  | "pneumaticValve"
  | "pressureTransducer"
  | "tank";

export type SymbolNode = Node<
  { kind: SymbolKind; label: string },
  "pidSymbol"
>;
