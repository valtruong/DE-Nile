import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  EquipmentSymbol,
  type EquipmentVisualState
} from "../src/symbols";
import type { Equipment } from "../src/diagram";

const cases: [
  Equipment["kind"],
  EquipmentVisualState | undefined,
  string
][] = [
  ["tank", undefined, "tank"],
  ["check-valve", undefined, "check-valve"],
  ["pneumatic-valve", undefined, "pneumatic-valve"],
  ["pressure-transducer", undefined, "pressure-transducer"],
  ["engine", undefined, "engine"],
  ["tank", "full", "full-tank"],
  ["tank", "half", "half-tank"],
  ["tank", "empty", "tank"],
  ["pneumatic-valve", "open", "open-pv"],
  ["pneumatic-valve", "closedPV1", "closed-pv-1"],
  ["pneumatic-valve", "closedPV2", "closed-pv-2"]
];
it.each(cases)(
  "renders local SVG artwork for %s / %s",
  (kind, visualState, file) => {
    // Valerie centralized the assets in pid-viewer and now embeds local SVG markup.
    const asset = readFileSync(
      new URL(`../src/assets/${file}.svg`, import.meta.url),
      "utf8"
    );
    const html = renderToStaticMarkup(
      <EquipmentSymbol
        kind={kind}
        visualState={visualState}
        size={90}
      />
    );
    expect(html).toContain(asset);
    expect(html).toContain("width:90px;height:90px");
    expect(html).not.toContain('src="https://');
  }
);
