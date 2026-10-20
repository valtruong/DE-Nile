import { useState } from "react";
import {
  PIDViewer,
  parseDiagram,
  type TelemetrySource
} from "@de-nile/pid-viewer";
import example from "@de-nile/pid-viewer/example";
import "@de-nile/pid-viewer/style.css";
import "./demo.css";

const diagram = parseDiagram(example);

// This source is only a local demo. Real hosting passes createRiverDashSource(GDT, TopicOpenMode.Read).
const simulation: TelemetrySource = {
  subscribe(topic, listener) {
    let tick = 0;
    const publish = () => {
      tick += 1;
      listener({
        status: "available",
        value:
          topic === "demo.pressure"
            ? 200 + 10 * Math.sin(tick)
            : tick % 2
              ? "closed"
              : "open"
      });
    };
    publish();
    const timer = window.setInterval(publish, 1500);
    return () => window.clearInterval(timer);
  }
};

/** Standalone demo shell; the npm viewer itself has no timers or network connection. */
export default function ViewerDemo() {
  const [simulate, setSimulate] = useState(true);
  return (
    <main className="demo-app">
      <header>
        <div>
          <h1>DE-Nile P&amp;ID viewer</h1>
          <p>
            Simulated readings and provisional symbols — no
            hardware connection
          </p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={simulate}
            onChange={(event) =>
              setSimulate(event.target.checked)
            }
          />{" "}
          Simulate telemetry
        </label>
      </header>
      <section className="demo-canvas">
        <PIDViewer
          diagram={diagram}
          dataSource={simulate ? simulation : undefined}
        />
      </section>
    </main>
  );
}
