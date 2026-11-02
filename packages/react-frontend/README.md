# DE-Nile frontend

React and TypeScript application for the team's P&ID canvas,
authentication screens, and optional embedded-viewer demo.

## Run locally

From the repository root:

```sh
npm ci
npm run build
npm run dev --workspace=de-nile
```

Build first so the local `@de-nile/pid-viewer` workspace package
has its compiled exports. Run the Express backend separately as
described in [its README](../express-backend/README.md) for
sign-in and account features. Vite forwards `/api` requests to
`http://localhost:8000`. Guest users can choose **Continue as
viewer** from the access screen.

The default route opens the team's diagram. `/?viewerDemo=1`
opens the team startup diagram with simulated telemetry after the same
access screen. It has no hardware connection. **Pause simulated
updates** stops delivery while keeping the source connected so
you can check the five-second stale indicator and recovery.

## Where to make changes

- `src/diagram/defaultDiagram.ts`: startup equipment, labels,
  positions, pipe connections, and pipe colors. Each canvas
  receives a fresh copy so editing cannot modify the defaults.
- `src/diagram/types.ts`: shared editor node and equipment
  kinds.
- `src/components/DiagramView.tsx`: React Flow state,
  interactions, and access-dependent editing controls.
- `src/PIDSymbolNode.tsx`: editor node rendering and equipment
  kind mapping to the shared viewer symbols.
- `../pid-viewer/src/assets/`: centralized team equipment and state SVGs.
- `src/telemetry/componentStates.ts`: Valerie's static sample states
  and visual-state normalization. These samples are applied at mount.
- `src/telemetry/withTelemetryReadings.ts`: fresh bound readings drive
  the state artwork; missing/stale/invalid readings clear its current state.
- `src/auth/`, `src/pages/`, and `src/components/AppHeader.tsx`:
  sessions, authentication screens, and the account header.
- `src/ViewerDemo.tsx`: optional simulation and viewer example.

The editor's startup configuration uses React Flow node/edge
objects; it does not replace the versioned interchange format in
[the data-format documentation](../../docs/data-format.md).

## Checks

From the repository root:

```sh
npm run build
npm test
npm run lint
```

Frontend tests are in `tests/`. For package exports and
RiverDash integration, see
[the viewer README](../pid-viewer/README.md).

## Team diagram monitoring

The monitoring demo uses the original `DiagramView` and `PIDSymbolNode`
renderers: dark canvas, team symbols, labels, positions, and nine colored
pipe connections. Optional telemetry props attach readings by equipment
ID without changing the saved diagram. Embedded hosts can use the reusable
package viewer with its versioned diagram format. The monitoring demo uses
Valerie's native canvas directly, preserving its named ports.

`src/diagram/useTelemetryReadings.ts` uses the package's shared
`useTopicReadings` subscription hook independently of layout state.
It releases subscriptions when disconnected and starts with empty readings
on reconnect, rather than reusing a previous connection's values. `PIDSymbolNode` uses the package's `formatReading` for
numeric values, units, valve text, Unavailable and Stale. Its optional
reading is positioned below the original label so state changes cannot
move pipe handles. Valerie can refine this presentation without changing
the data source or bindings.

`src/diagram/simulatedBindings.ts` binds PT101/PT201 to `demo.pressure.pt101` / `demo.pressure.pt201`
(kPa) and PV101/PV201 to `demo.valve.pv101` / `demo.valve.pv201`
(Open/Closed). These are simulated contracts, not confirmed RiverDash tags
or sensor units. Other equipment has no invented readings. Signals are
explicit fixtures in `src/diagram/simulatedTelemetry.ts`; unknown tags
report Unavailable.

Toggle **Simulate telemetry** off for Unavailable, or **Pause simulated
updates** for Stale after five seconds. Resume for recovery within 1.5 seconds.
The editor and monitor currently share the startup configuration only;
unsaved editor changes are not transferred, and persistence is not implemented.

### Valerie's component-state integration

The original canvas includes tank Full/Half/Empty artwork, pneumatic-valve
Open and two Closed variants, equipment-specific ports, and light/dark modes.
Pipe handle IDs in `defaultDiagram.ts` match these ports. The monitoring
preview preserves these changes and sends fresh telemetry through
`normalizeVisualState`. The two pneumatic valves change artwork as well as
text; pressure sensors still display numeric values. A stale, unavailable,
invalid, or unconfirmed cached reading must not display a sample valve state
as current. Tanks remain Valerie's static sample fill states until explicitly
bound to a telemetry topic; no real tank measurements or thresholds are assumed.
Drag/drop insertion, component rotation, and automatic label placement remain
future work.
