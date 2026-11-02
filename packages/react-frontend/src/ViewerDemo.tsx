import { useState } from "react";
import { DiagramView } from "./components/DiagramView";
import { simulatedBindings } from "./diagram/simulatedBindings";
import { createSimulation } from "./diagram/simulatedTelemetry";
import "@de-nile/pid-viewer/style.css";
import "./demo.css";

/** Pause delivery to exercise stale-data handling without disconnecting the source. */
export default function ViewerDemo() {
  const [simulation] = useState(createSimulation);
  const [simulate, setSimulate] = useState(true);
  const [paused, setPaused] = useState(false);
  return (
    <main className="demo-app">
      <header>
        <div>
          <h1>DE-Nile diagram monitoring</h1>
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
      <section className="demo-canvas">
        <DiagramView
          editable={false}
          embedded
          telemetry={{
            bindings: simulatedBindings,
            source: simulate ? simulation.source : undefined
          }}
        />
      </section>
    </main>
  );
}
