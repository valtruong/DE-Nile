# RiverDash telemetry integration — November 15, 2026

## Current status

RiverDash `origin/dev` commit **2346934** ("DE-Nile first
integration") installs the original 0.1.1 tarball and mounts
`PIDModule` / `DiagramPanel` in its dashboard. The panel still
uses the packaged sample's `demo.*` bindings. Actual CPSS
pressure and valve topics, units and state meanings have not
been supplied.

DE-Nile 0.1.2 adds `RiverDashViewer` and `useRiverDashSource`.
They use the host's existing GDT, open topics only in `"R"`
mode, and create no WebSocket or topic publisher. The original
`PIDViewer` / `createRiverDashSource` API remains supported. A
newly supplied diagram prop updates the
configuration/subscriptions.

```tsx
import {
  RiverDashViewer,
  parseDiagram
} from "@de-nile/pid-viewer";
import { GDT } from "@river-dash/global-data-source";
import "@de-nile/pid-viewer/style.css";
import config from "./team-diagram.json";

const diagram = parseDiagram(config);

// Inside an existing, sized RiverDash module:
<RiverDashViewer
  table={GDT}
  diagram={diagram}
  presentation="symbols"
/>;
```

Copy both `DiagramPanel.tsx` and `team-diagram.json` from this
directory. Unlike the first handoff, this example imports the
**local JSON file**, so editing its bindings actually changes
what the panel subscribes to. It also accepts a `diagram` prop
for a host-selected saved configuration. Topic names, units,
precision, state values/labels/colors and explicit valve artwork
mappings live in JSON; current readings do not. No valve meaning
is inferred from 0 or 1.

For the standalone shared-state canvas, pass the same source
without changing the document:

```tsx
const source = useRiverDashSource(GDT);
<DiagramCanvas
  controller={controller}
  editable={canEdit}
  dataSource={source}
/>;
```

Call the hook at the top level of the host component. Editing
does not subscribe; monitoring reads topics from
`controller.diagram`. A stable host decoder can be passed
through `decode` for agreed compound GDT values; no real enum
mapping has been invented. The default update-silence timeout
remains five seconds.

## Confirmed host transport blocker

The unmodified `dev` WebSocket receiver fails on the backend's
text frames:

```text
UPSTREAM TRANSPORT FAILED: i.text is not a function
```

Evidence in RiverDash commit 2346934:

- `backend/src/data_stream/replication.rs` sends
  `Message::Text(data)`.
- `frontend/packages/global_data_source/src/network_stream.ts`
  casts `event.data` to `Blob`, then calls `i.text()` in
  `receive_data()`.
- A WebSocket text frame delivers a string. Setting
  `binaryType = "blob"` does not convert text frames into Blobs;
  the TypeScript cast doesn't convert the runtime value either.

Alvin needs to handle string frames in that receiver (and retain
queued messages when no receiver is waiting). No RiverDash files
were changed or patched here. The default singleton also
currently targets `ws://127.0.0.1:9090/api/ws`; endpoint
configuration, transport reconnect behavior and remote/secure
hosting remain RiverDash responsibilities.

This prevents claiming successful end-to-end operation with the
**unmodified RiverDash transport**. The DE-Nile adapter and GDT
parsing were separately checked with a test-only receiver that
correctly handles text frames. That receiver is not shipped in
the viewer and is not a substitute production transport.

## Repeatable local checks

Use a temporary copy of the GDT source from the exact RiverDash
revision to install dependencies and compile; do not build or
edit the read-only checkout. The external test directory needs
GDT's dependencies and the `ws` test package. From DE-Nile,
after `npm run build`:

```sh
npm run test:riverdash -- /absolute/path/to/compiled-gdt-copy
npm run test:riverdash:websocket -- /absolute/path/to/compiled-gdt-copy
npm run test:riverdash:websocket -- /absolute/path/to/compiled-gdt-copy --reference-transport
```

The second command currently fails with the upstream receiver
error. The third isolates the downstream GDT/DE-Nile path and
passes. It starts a server on a random **127.0.0.1** port,
negotiates `RiverDash.pubsub.v1`, and sends only clearly labeled
demo pressure/valve text frames using RiverDash's
declaration/update format. It uses the actual GDT classes and
DE-Nile adapter, verifying:

- Missing topics, delayed initialization, and unconfirmed cached
  snapshots.
- Valid zero pressure (`0.0 kPa`), Open/Closed labels, and
  mapped topics.
- Update silence and recovery (100ms in this test; five seconds
  in production).
- Unsubscription, unchanged JSON, exclusively read-only opens
  and no outgoing writes.

The imported GDT singleton is suppressed in the test process so
it cannot contact the real endpoint. The old compatibility check
similarly uses fake publishers. Neither check uses actual stand
telemetry, validates hardware state, or replaces testing the
fixed transport and real topic contract inside Alvin's
dashboard.

## Remaining joint acceptance

1. Alvin fixes/retests the host text-frame receiver.
2. Alvin supplies actual topics, payload types, units and state
   meanings.
3. Replace the local JSON's demo bindings and add an explicit
   decoder if needed.
4. Mount the updated package in RiverDash and verify readings,
   resize, stale behavior, recovery and panel cleanup against
   that setup.

Header controls, automatic fitting refinements and selectable themes were
subsequently implemented in 0.1.3; see `VIEWER-CONTROLS.md`. They do not resolve
the host transport blocker described above.
