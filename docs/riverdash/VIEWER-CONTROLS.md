# Viewer controls, panel fitting and themes — 0.1.3

These changes implement Alvin's viewer suggestions in DE-Nile.
RiverDash's checkout is read-only; the example files here are
for Alvin to apply there.

## Header controls

Both `PIDViewer` and `RiverDashViewer` accept a React ref:

```tsx
import { useRef } from "react";
import {
  RiverDashViewer,
  type PIDViewerHandle
} from "@de-nile/pid-viewer";

const viewerRef = useRef<PIDViewerHandle>(null);

// Put these buttons in RiverDash's ModuleFrame actions slot:
<>
  <button onClick={() => void viewerRef.current?.zoomIn()}>
    +
  </button>
  <button onClick={() => void viewerRef.current?.zoomOut()}>
    −
  </button>
  <button onClick={() => void viewerRef.current?.fitView()}>
    Fit
  </button>
</>;

// The module content:
<RiverDashViewer
  ref={viewerRef}
  table={GDT}
  diagram={diagram}
  presentation="symbols"
  showControls={false}
  theme="dark"
/>;
```

Methods return `Promise<boolean>`. Fit returns false until the
panel and nodes are measured. The ref is cleared when the viewer
unmounts or its configuration is invalid. `showControls`
defaults to true for existing integrations; set it false when
providing header buttons. The ref remains available with
controls hidden. It exposes viewport operations only, without
equipment-editing methods.

`PIDModule.tsx` is a complete example using RiverDash's existing
`ModuleFrame` `actions` slot and `data-no-drag` marker. It
defaults to dark mode and forwards a host-selected theme. Copy
it with `DiagramPanel.tsx` and `team-diagram.json` after
installing 0.1.3. Existing dashboard geometry registration can
stay as is.

## Fit inside resized panels

`autoFit` defaults to true. It fits on initial measurement,
diagram geometry changes, and parent-panel resize. Live
telemetry and equivalent configuration objects don't reset a
user's pan/zoom. With `autoFit={false}`, fitting is manual.

The viewer no longer imposes a 300px minimum height, and the
panel example no longer imposes a 500px minimum height. A
flex/grid host should provide a sized container with
`min-height: 0` and `min-width: 0` so it can shrink. The viewer
clips its own content to that container, and fitting supports
small zoom levels for compact panels. Its fit calculation
includes symbol labels/readings outside node boxes and edge
labels. Bound symbols reserve status space so unavailable and
stale messages don't move connection endpoints or change normal
node sizes.

"Full screen" is implemented here as fitting the entire diagram
inside its panel. RiverDash continues owning actual
panel/dashboard fullscreen behavior. Zooming out may make labels
small; the Equipment readings list retains normal-sized text
access.

## Color scheme

`theme="light"` (default) and `theme="dark"` style the canvas,
symbols, labels, readings panel and React Flow controls
together. The host can change the prop at runtime without
replacing the diagram or the telemetry source. Equipment states,
state meanings, custom binding colors and pipe colors stay in
JSON; this theme setting controls the viewer's surrounding
appearance.

## Local preview and verification

Run the standalone frontend and open:

```text
/?viewerDemo=1&packageDemo=1
```

Continue as viewer or sign in. This preview uses simulated data,
with header Zoom in / Zoom out / Fit diagram buttons, a theme
selector, fit-on-resize toggle, and compact/wide panel presets.
The viewer's corner controls are hidden.

Automated tests exercise the imperative ref through React's
lifecycle, cleanup, manual/automatic fitting, resize versus
telemetry updates, theme switching, and overflowing label
bounds. They use jsdom and mock the React Flow viewport; they do
not substitute for browser visual checks. The browser automation
host was unavailable during this implementation, so manual
visual acceptance remains pending. The RiverDash text-frame
transport issue and actual topic contract remain tracked
separately in `WEBSOCKET-INTEGRATION.md`.
