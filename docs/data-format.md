# P&ID configuration v1 (#9)

This is an initial DE-Nile-owned JSON interchange format for
team review, not a claim that RiverDash has adopted a new
telemetry schema. Validation lives in
`packages/pid-viewer/src/diagram.ts`. Zod supplies one runtime
validator and the inferred TypeScript types, avoiding separate
definitions that drift apart.

- `schemaVersion`: exactly `1`; unsupported versions are
  rejected.
- `id`, `name`: nonempty diagram identifiers and display name.
- `equipment`: at least one item with a unique stable `id`,
  `kind`, `label`, and finite `{x, y}` position in canvas
  coordinates.
- Supported kinds: `tank`, `check-valve`, `pneumatic-valve`,
  `pressure-transducer`, and `engine`.
- `connections`: unique IDs, existing source/target equipment
  IDs, optional label, six-digit hex color (default `#667085`),
  `routing: "orthogonal"`, and optional `sourceHandle` /
  `targetHandle` (which side of each symbol the pipe attaches to
  in the editor, e.g. `"bottom-source"`).
- Optional equipment `binding`: `topic`, `valueType` (`number`,
  `string`, or `boolean`), optional display `unit`, numeric
  `precision` (0–6), and explicit
  `states: [{value, label, color?}]`. State values must match
  the configured type.

See `packages/pid-viewer/src/example-diagram.json` for a
complete example. Its `demo.*` tags, units, and valve meanings
are simulated and are not confirmed CPSS telemetry. The viewer
uses the team's SVG assets from main; final CPSS convention
approval remains a team decision.

Use `parseDiagram(jsonTextOrObject)` when opening
configurations. It rejects malformed input, duplicate IDs,
unknown equipment, and unresolved endpoints. Saving a validated
diagram with `JSON.stringify(diagram, null, 2)` preserves the
layout and bindings. Live readings, connections to hardware, and
credentials are never part of the file. Saving/editor UI is
outside these three tasks.

Saved diagrams (#17, #11, #51) are stored in this format by the
backend's `/api/diagrams` routes. The editor converts its canvas
to and from it in
`packages/react-frontend/src/diagram/diagramFormat.ts`.

Importing a file (#32, **Diagrams → Import P&ID**, editors only)
is more forgiving than saving: it accepts editor-style symbol
names (`checkValve`, `Check Valve`), places components that have
no position, skips pipes to missing components and drops invalid
bindings, then asks the editor to pick a type for unknown
symbols and add tags that are missing or repeated. The result is
checked with `parseDiagram` before it's saved as a new draft.
That logic is in
`packages/react-frontend/src/diagram/importDiagram.ts`.
