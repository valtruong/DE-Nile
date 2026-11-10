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
import config from "./my-diagram.json";

const diagram = parseDiagram(config);

export function DiagramPanel() {
  // Keep this adapter stable so normal React renders do not resubscribe.
  const source = useMemo(
    () => createRiverDashSource(GDT, "R"),
    []
  );
  return (
    <div style={{ height: "100%", minHeight: 300 }}>
      <PIDViewer diagram={diagram} dataSource={source} />
    </div>
  );
}
```

The `"R"` argument is GDT's read-only mode. In the current GDT package,
`TopicOpenMode` is a type-only export from `/topic`, so importing it as a
runtime value does not work. Passing the literal avoids that unavailable
runtime export. RiverDash owns the GDT singleton and its WebSocket lifecycle;
DE-Nile only subscribes to the supplied table.

RiverDash must compile its global-data-source package first, as
its README requires. Pass the host's existing GDT; do not
construct a second data table. The adapter is structurally typed
and does not bundle/import RiverDash, which avoids a second
singleton and an unavailable registry dependency.

## Live data processing (#33)

The adapter is verified against `Alvin-He/river-dash` branch
`global_data_table` at commit `b1bac85` and `main` at commit `ab02a58`.
Both declare package version `1.0.0`; use commit IDs to identify the
verified source. The package folder is
`frontend/packages/global_data_source`. The adapter opens topics only
in read mode (`"R"`), reads current values, subscribes to
`RiverDash:TopicUpdateEvent`, retries after topic
declarations/initialization, and removes listeners when the
viewer unmounts or its source/config changes. Only one
subscription per distinct topic is created within each viewer.

Numeric RiverDash wrappers are decoded with `.get()`. Safe
integer `bigint` values are supported; unsafe integer
conversions are rejected. Compound values such as Enum/Group/ADT
require an explicit host decoder:

```ts
const source = createRiverDashSource(GDT, "R", {
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
Publisher timestamps are retained as metadata and never compared
against the browser clock. The adapter now uses RiverDash's
provisional guidance of five seconds without received updates.

### Update silence and cached snapshots

`createRiverDashSource` wraps subscriptions with
`withUpdateTimeout`, which uses a local monotonic clock
(`performance.now()`). After five seconds of silence, it emits a
`stale` reading. The viewer displays **Stale — no updates
received for at least 5 s**, without showing the last valve
state or a numeric value as current. A new update, including an
unchanged value, restores the normal display and restarts the
timer.

```ts
const source = createRiverDashSource(GDT, "R", {
  staleAfterMs: 5000
});
```

The timeout can be configured by the host through
`staleAfterMs`. Generic/simulated sources can opt into the same
behavior using
`withUpdateTimeout(source, { staleAfterMs: 5000 })`. Missing or
uninitialized topics remain `Unavailable`; they are not stale
readings. Invalid payloads remain `Invalid data` while updates
continue and become stale if their updates stop. Unsubscribing
removes both upstream listeners and pending timers.

The first `read_data()` result may be cached. Its age cannot be
established from an unrelated publisher clock, so it carries
`freshness: "unconfirmed"` and is displayed with **freshness
unconfirmed**, without a confirmed-state color, until a topic
update arrives. If no updates arrive, the timeout runs from
local observation of that snapshot. This detects update silence;
it does not establish the age of the sensor sample or prove a
network disconnect.

In the reviewed GDT version, `get_time_since_last_update()` and
the update event's delta represent the interval between the
previous updates; they do not keep increasing during silence.
The adapter therefore does not use them as a running timeout.
The standalone demo's **Pause simulated updates** control
exercises timeout and recovery; disabling **Simulate telemetry**
removes the source and shows `Unavailable` instead.

## Viewer behavior and remaining scope

The viewer fits the initial diagram, supports pan/zoom, and
fills a sized parent. Nodes cannot be dragged, deleted,
connected, or reconnected in monitoring mode. Telemetry affects
display data only, not saved positions. The equipment-readings
panel provides text access to all states. Diagrams are validated
at the viewer boundary; malformed configurations render an error
instead of a partial canvas.

Equipment SVGs and their state variants are centralized in
`src/assets/`; the standalone frontend uses these same assets.
There are no duplicate frontend SVG originals to keep in sync. Final CPSS convention approval remains a team
decision. Pass
`renderSymbol={(equipment) => <YourTeamSymbol kind={equipment.kind} />}`
to reuse the team’s existing SVG components without changing the
telemetry adapter. Real topic names/types/units, enum decoding,
publisher-sample age, transport disconnect signaling, and final
host module registration remain integration decisions. No
editor, login, database, or hardware-control behavior is
included in the package. The standalone app retains the team’s
authentication and diagram view; the optional telemetry demo
uses the same access gate, including guest viewer mode.

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
verify real WebSocket delivery. The test replaces the default WebSocket
with an inert stub and suppresses the imported singleton's receive loop.
It uses a local, non-network transport. Fake-publisher stream messages
are intercepted; all adapter topic opens are asserted to be read-only.
Regular `npm test` needs no RiverDash checkout.

The compatibility test's fake publishers use the current
`ReadWrite` API and `Message` values (verified with RiverDash
commit `b1bac85`). These pressure/valve values and tags are test
fixtures, not the final CPSS data contract. This check covers
the reader integration, not all GDT functionality or real
network delivery.

## Sharing readings with a custom canvas

`useTopicReadings(source, topics)` exposes the same read-only subscription
lifecycle used by `PIDViewer`. Topic names are deduplicated, old callbacks
are ignored after cleanup, and reconnecting starts without old readings.
The hook does not change equipment positions or assign visual state meanings.
Its server-rendered snapshot is empty, so server rendering never opens topics.
