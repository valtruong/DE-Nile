import type { ReactNode } from "react";
import type { Equipment } from "./diagram";

// Provisional SVGs: replace these paths with the club-approved P&ID symbols.
const symbols: Record<Equipment["kind"], ReactNode> = {
  tank: (
    <>
      <ellipse cx="50" cy="15" rx="27" ry="9" />
      <path d="M23 15v46c0 12 54 12 54 0V15M23 61c0-12 54-12 54 0" />
    </>
  ),
  "check-valve": (
    <>
      <path d="M8 40h16m0-20 40 20-40 20V20Zm40 0v40m0-20h28" />
    </>
  ),
  "pneumatic-valve": (
    <>
      <path d="m18 22 64 36V22L18 58V22Zm32 18V12m-16 0h32M4 40h14m64 0h14" />
      <path d="M34 12a16 10 0 0 1 32 0" />
    </>
  ),
  "pressure-transducer": (
    <>
      <circle cx="50" cy="32" r="22" />
      <path d="M50 54v20M28 32h44" />
      <text
        x="50"
        y="28"
        textAnchor="middle"
        stroke="none"
        fill="currentColor"
        fontSize="13">
        PT
      </text>
    </>
  ),
  engine: (
    <path d="M38 9h24v25L80 70H20l18-36V9ZM4 40h24m44 0h24" />
  )
};

/** Keep equipment-specific graphics separate from shared node behavior. */
export function EquipmentSymbol({
  kind
}: {
  kind: Equipment["kind"];
}) {
  return (
    <svg
      viewBox="0 0 100 80"
      width="90"
      height="72"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true">
      {symbols[kind]}
    </svg>
  );
}
