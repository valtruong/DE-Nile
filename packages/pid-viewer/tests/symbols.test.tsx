import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EquipmentSymbol } from "../src/symbols";

it.each([
  "tank",
  "check-valve",
  "pneumatic-valve",
  "pressure-transducer",
  "engine"
] as const)("ships the team's %s SVG unchanged", (kind) => {
  const file = `${kind}.svg`;
  const packaged = readFileSync(
    new URL(`../src/assets/${file}`, import.meta.url),
    "utf8"
  );
  const original = readFileSync(
    new URL(
      `../../react-frontend/src/assets/${file}`,
      import.meta.url
    ),
    "utf8"
  );
  expect(packaged).toBe(original);
  const html = renderToStaticMarkup(
    <EquipmentSymbol kind={kind} />
  );
  const src = html.match(/src="([^"]+)"/)?.[1] ?? "";
  expect(src).toMatch(/^data:image\/svg\+xml,/);
  const embedded = decodeURIComponent(
    src.slice(src.indexOf(",") + 1)
  ).replaceAll("&#x27;", '"');
  const viewBox = original.match(/viewBox="([^"]+)"/)?.[1];
  expect(embedded).toContain(`viewBox="${viewBox}"`);
});
