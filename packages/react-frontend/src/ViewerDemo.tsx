import { useRef, useState } from "react";
import {
  PIDViewer,
  parseDiagram,
  type PIDViewerHandle
} from "@de-nile/pid-viewer";
import teamConfig from "@de-nile/pid-viewer/team-example";
const teamDiagram = parseDiagram(teamConfig);
import { DiagramView } from "./components/DiagramView";
import { simulatedBindings } from "./diagram/simulatedBindings";
import { createSimulation } from "./diagram/simulatedTelemetry";
import "@de-nile/pid-viewer/style.css";
import "./demo.css";

/** Pause delivery to exercise stale-data handling without disconnecting the source. */
export default function ViewerDemo() {
  const packaged = new URLSearchParams(
    window.location.search
  ).has("packageDemo");
  const [simulation] = useState(createSimulation);
  const [simulate, setSimulate] = useState(true);
  const [paused, setPaused] = useState(false);
  const viewerRef = useRef<PIDViewerHandle>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [autoFit, setAutoFit] = useState(true);
  const [panelSize, setPanelSize] = useState<
    "fill" | "compact" | "wide"
  >("fill");
  return (
    <main className={`demo-app demo-app--${theme}`}>
      <header>
        <div>
          <h1>
            {packaged
              ? "Packaged viewer integration preview"
              : "DE-Nile diagram monitoring"}
          </h1>
          <p>
            Team diagram with simulated pressure and valve
            readings — no hardware connection
          </p>
          <p>
            Pause updates to see the stale indicator after five
            seconds.
          </p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={simulate}
            onChange={(event) => {
              simulation.setPaused(false);
              setPaused(false);
              setSimulate(event.target.checked);
            }}
          />{" "}
          Simulate telemetry
        </label>
        <label>
          <input
            type="checkbox"
            checked={paused}
            disabled={!simulate}
            onChange={(event) => {
              simulation.setPaused(event.target.checked);
              setPaused(event.target.checked);
            }}
          />{" "}
          Pause simulated updates
        </label>
      </header>
      {packaged && (
        <div
          className="demo-viewer-toolbar"
          role="toolbar"
          aria-label="Viewer header controls">
          <button
            type="button"
            onClick={() => {
              void viewerRef.current?.zoomIn();
            }}>
            Zoom in
          </button>
          <button
            type="button"
            onClick={() => {
              void viewerRef.current?.zoomOut();
            }}>
            Zoom out
          </button>
          <button
            type="button"
            onClick={() => {
              void viewerRef.current?.fitView();
            }}>
            Fit diagram
          </button>
          <label>
            Theme{" "}
            <select
              value={theme}
              onChange={(event) =>
                setTheme(event.target.value as "light" | "dark")
              }>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={autoFit}
              onChange={(event) =>
                setAutoFit(event.target.checked)
              }
            />{" "}
            Fit on resize
          </label>
          <label>
            Panel size{" "}
            <select
              value={panelSize}
              onChange={(event) =>
                setPanelSize(
                  event.target.value as typeof panelSize
                )
              }>
              <option value="fill">Fill available space</option>
              <option value="compact">
                Compact (320 × 240)
              </option>
              <option value="wide">Wide (640 × 220)</option>
            </select>
          </label>
        </div>
      )}
      <section
        className={`demo-canvas${packaged ? ` demo-canvas--${panelSize}` : ""}`}>
        {packaged ? (
          <PIDViewer
            ref={viewerRef}
            diagram={teamDiagram}
            presentation="symbols"
            theme={theme}
            autoFit={autoFit}
            showControls={false}
            dataSource={
              simulate ? simulation.source : undefined
            }
          />
        ) : (
          <DiagramView
            editable={false}
            embedded
            telemetry={{
              bindings: simulatedBindings,
              source: simulate ? simulation.source : undefined
            }}
          />
        )}
      </section>
    </main>
  );
}
