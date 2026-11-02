import type { Equipment } from "@de-nile/pid-viewer";
import type { SymbolKind } from "./types";

// Translate the editor's names at the display boundary; IDs stay unchanged.
export const equipmentKinds = {
  checkValve: "check-valve",
  engine: "engine",
  pneumaticValve: "pneumatic-valve",
  pressureTransducer: "pressure-transducer",
  tank: "tank"
} as const satisfies Record<SymbolKind, Equipment["kind"]>;
