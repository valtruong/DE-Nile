import type { Ref } from "react";
import {
  RiverDashViewer,
  parseDiagram,
  type Diagram,
  type PIDViewerHandle
} from "@de-nile/pid-viewer";
import config from "./team-diagram.json";
import "@de-nile/pid-viewer/style.css";
import { GDT } from "@river-dash/global-data-source";

// Demo bindings only. Copy config to a local JSON file and replace the bindings
// after the telemetry topic names, units and state values are agreed.
const sampleDiagram = parseDiagram(config);

export function DiagramPanel({
  ref,
  diagram = sampleDiagram,
  theme = "light",
  showControls = true
}: {
  ref?: Ref<PIDViewerHandle>;
  diagram?: Diagram;
  theme?: "light" | "dark";
  showControls?: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        flex: 1
      }}>
      <RiverDashViewer
        ref={ref}
        diagram={diagram}
        presentation="symbols"
        table={GDT}
        staleAfterMs={5000}
        theme={theme}
        showControls={showControls}
      />
    </div>
  );
}
