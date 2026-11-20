# Shared editing and monitoring state

`SharedDiagramView` and `DiagramCanvas` use one validated `Diagram` document
for editing and monitoring. When mounted with editing permission, the shared
canvas has a toolbar to switch modes without loading another layout.
Viewers remain in monitoring mode. The telemetry demo uses this canvas;
the default application uses the editor and library from main.

The document is the existing v1 JSON contract exported by
`@de-nile/pid-viewer`: equipment IDs, kinds, labels, positions,
bindings, and connections with labels, ports, colors, and
widths. Monitoring overlays telemetry onto derived React Flow
nodes; it never stores readings, selection, dimensions, or
subscriptions in the document. Editing does not subscribe to
telemetry. Unbound equipment uses neutral artwork rather than a
static sample presented as a live state.

## Integration for Valerie and Stella

`SharedDiagramView` owns state for the telemetry demo. A parent that needs
access to the document can own `useDiagramState` above `DiagramCanvas`:

```tsx
import { parseDiagram } from "@de-nile/pid-viewer";
import { DiagramCanvas } from "../components/DiagramView";
import { useDiagramState } from "../diagram/useDiagramState";

function DiagramWorkspace() {
  const controller = useDiagramState();

  function openDiagram(jsonText: string) {
    // Catch validation errors in the library/import UI before dispatching.
    const diagram = parseDiagram(jsonText);
    controller.dispatch({ type: "replace", diagram });
  }

  function currentJson() {
    return JSON.stringify(controller.diagram, null, 2);
  }

  // Wire openDiagram/currentJson to the library's own controls.
  return <DiagramCanvas controller={controller} editable />;
}
```

- **Stella:** save `controller.diagram`; load/import with
  `parseDiagram` followed by
  `dispatch({ type: "replace", diagram })`. Replacement works in
  either mode. `initialDiagram` in
  `useDiagramState(initialDiagram, initialMode)` is used only on
  initial mount; use `replace` for later library selections.
- **Valerie:** the existing canvas dispatches position, removal
  and connection edits to the shared reducer. Component
  addition, label editing and rotation remain her feature work.
  New tools should update this same document rather than create
  separate monitoring state. Rotation and label-position fields
  need coordinated schema/renderer extensions; v1 currently
  rejects unknown fields.
- **Monitoring:** pass a read-only `TelemetrySource` to
  `DiagramCanvas` through `dataSource`. Topics come from the
  document's equipment bindings. The old simulator can still
  supply demo bindings through `telemetry`; those overrides are
  display-only and are not saved. The packaged `PIDViewer` can
  also consume the same `controller.diagram` directly.

The reducer blocks move/delete/connect events in monitoring
mode, including late events queued before a mode switch. The
canvas also locks these interactions for users without edit
permission. Measurements remain enabled so React Flow can fit
the diagram when its container resizes. Connections use
orthogonal routing; removing equipment also removes its attached
pipes. The v1 contract requires at least one equipment item, so
deleting every component at once is rejected.

State lasts for the lifetime of its owner. Reloading or
unmounting that owner does not save it. A library page should
keep the controller above navigation or save through Stella's
persistence layer before leaving. This change adds no save UI,
database storage, file import/export, component palette, or
WebSocket connection.

## Verification

Run `npm run build`, `npm test`, and `npm run lint` from the
repository root. The new tests cover edit/monitor/edit
transitions, mutation locks, pipe cleanup, document
replacement/validation, preserved bindings, and telemetry
isolation.

Manual acceptance: sign in as an editor/admin, move a component
and draw a new connection, click **Monitor diagram**, verify the
same layout and pipes remain read-only, and click **Edit
diagram** to continue. Also check labels, symbols, connections
and fitting at different window sizes. Guest viewers cannot
switch into editing. Browser-based visual verification remains
to be performed for this change because the browser access tool
was unavailable during implementation.
