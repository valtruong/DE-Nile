# @de-nile/pid-viewer

Initial read-only viewer for the DE-Nile/RiverDash integration
tasks (#9, #33, #21). It contains a validated diagram format,
SVG equipment nodes, orthogonal connections, a telemetry
adapter, and an ES module build with TypeScript types. No
runtime CDN, font service, or telemetry network connection is
used.

## Build and install locally

From the DE-Nile repository root:

```sh
npm ci
npm run build
npm test
npm run lint
npm pack --workspace=@de-nile/pid-viewer
```

This generates `de-nile-pid-viewer-0.1.0.tgz`. In the RiverDash
frontend, install that tarball using its absolute path. The
package is not published to npm. React and React DOM are peer
dependencies, so RiverDash owns their instances. React Flow is a
package dependency, Zod is bundled, and CSS is shipped locally.

## Embed in RiverDash

```tsx
import { useMemo } from "react";
import {
  PIDViewer,
  createRiverDashSource,
  parseDiagram
} from "@de-nile/pid-viewer";
import "@de-nile/pid-viewer/style.css";
import { GDT } from "@river-dash/global-data-source";
import { TopicOpenMode } from "@river-dash/global-data-source/topic";
import config from "./my-diagram.json";

const diagram = parseDiagram(config);

export function DiagramPanel() {
  // Keep this adapter stable so normal React renders do not resubscribe.
  const source = useMemo(
    () => createRiverDashSource(GDT, TopicOpenMode.Read),
    []
  );
  return (
    <div style={{ height: "100%", minHeight: 300 }}>
      <PIDViewer diagram={diagram} dataSource={source} />
    </div>
  );
}
```

RiverDash must compile its global-data-source package first, as
its README requires. Pass the host's existing GDT; do not
construct a second data table. The adapter is structurally typed
and does not bundle/import RiverDash, which avoids a second
singleton and an unavailable registry dependency.

## Live data processing (#33)

The adapter was written against `Alvin-He/river-dash` branch
`global_data_table`, commit `93e27bf`. The folder on that branch
is `frontend/packages/global_data_source`. It opens topics only
with `TopicOpenMode.Read`, reads current values, subscribes to
`RiverDash:TopicUpdateEvent`, retries after topic
declarations/initialization, and removes listeners when the
viewer unmounts or its source/config changes. Only one
subscription per distinct topic is created within each viewer.

Numeric RiverDash wrappers are decoded with `.get()`. Safe
integer `bigint` values are supported; unsafe integer
conversions are rejected. Compound values such as Enum/Group/ADT
require an explicit host decoder:

```ts
const source = createRiverDashSource(GDT, TopicOpenMode.Read, {
  decode(value) {
    // Validate the real type and return the agreed number/string/boolean here.
    return decodeConfirmedTelemetry(value);
  }
});
```

No valve meaning is inferred from 0/1. Map agreed values to text
in the diagram's `binding.states`. Missing/uninitialized topics
show `Unavailable`, invalid values show `Invalid data`, and
unmapped states show `Unknown state`. Zero remains a valid
reading. Without a source, bound equipment shows `Unavailable`.
Publisher timestamps are retained as metadata, not compared to
the browser clock. No stale-data timeout or disconnect policy is
invented; those require agreement with RiverDash, whose network
stream is still a placeholder on this branch.

## Viewer behavior and remaining scope

The viewer fits the initial diagram, supports pan/zoom, and
fills a sized parent. Nodes cannot be dragged, deleted,
connected, or reconnected in monitoring mode. Telemetry affects
display data only, not saved positions. The equipment-readings
panel provides text access to all states. Diagrams are validated
at the viewer boundary; malformed configurations render an error
instead of a partial canvas.

SVG paths are provisional examples requiring CPSS symbol review.
Pass
`renderSymbol={(equipment) => <YourTeamSymbol kind={equipment.kind} />}`
to reuse the team’s existing SVG components without changing the
telemetry adapter. Real topic names/types/units, enum decoding,
stale/disconnected reporting, and final host module registration
remain integration decisions. No editor, login, database, or
hardware-control behavior is included. The standalone app is a
simulated demo.

## Check against Alvin's implementation

After compiling both packages, from the DE-Nile root:

```sh
npm run test:riverdash -- /absolute/path/to/river-dash/frontend/packages/global_data_source
```

This optional compatibility check uses the real RiverDash
classes, a local table, and simulated numeric values. It
verifies delayed topic initialization, a valid zero, numeric
decoding, updates, cleanup, and no outgoing messages from the
read subscription. It does not connect to the test stand or
verify the placeholder network transport. Regular `npm test`
needs no RiverDash checkout.
