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
  and `routing: "orthogonal"`.
- Optional equipment `binding`: `topic`, `valueType` (`number`,
  `string`, or `boolean`), optional display `unit`, numeric
  `precision` (0–6), and explicit
  `states: [{value, label, color?}]`. State values must match
  the configured type.

See `packages/pid-viewer/src/example-diagram.json` for a
complete example. Its `demo.*` tags, units, valve meanings, and
symbol paths are simulated/provisional; they are not confirmed
CPSS telemetry or approved symbols.

Use `parseDiagram(jsonTextOrObject)` when opening
configurations. It rejects malformed input, duplicate IDs,
unknown equipment, and unresolved endpoints. Saving a validated
diagram with `JSON.stringify(diagram, null, 2)` preserves the
layout and bindings. Live readings, connections to hardware, and
credentials are never part of the file. Saving/editor UI is
outside these three tasks.
