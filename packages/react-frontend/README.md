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
opens the simulated telemetry demonstration after the same
access screen. It has no hardware connection.

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
- `src/assets/`: team equipment SVG originals. Keep the viewer
  package's copies in sync when changing artwork.
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
