import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PIDViewer } from "../src/PIDViewer";
import { parseDiagram, type Diagram } from "../src/diagram";
import example from "../src/example-diagram.json";

it("renders an accessible equipment list with unavailable readings without telemetry", () => {
  const html = renderToStaticMarkup(
    <PIDViewer diagram={parseDiagram(example)} />
  );
  expect(html).toContain("Equipment readings");
  expect(html).toContain("Fuel Pressure");
  expect(html).toContain("Unavailable");
  expect(html).not.toContain("0.0 kPa");
});

it("reports malformed input at the viewer boundary", () => {
  const html = renderToStaticMarkup(
    <PIDViewer
      diagram={
        { ...example, schemaVersion: 9 } as unknown as Diagram
      }
    />
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("Invalid diagram");
});
