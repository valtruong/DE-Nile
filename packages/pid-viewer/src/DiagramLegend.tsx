import type { Diagram } from "./diagram";

export function stateArtworkColor(state: {
  color?: string;
  visualState?: string;
}) {
  if (state.color) return state.color;
  if (state.visualState === "open")
    return "var(--pid-valve-open)";
  if (
    state.visualState === "closedPV1" ||
    state.visualState === "closedPV2"
  )
    return "var(--pid-valve-closed)";
  if (
    state.visualState === "full" ||
    state.visualState === "half"
  )
    return "var(--pid-tank-fluid)";
  return "var(--pid-stroke)";
}

export function diagramLegendEntries(diagram: Diagram) {
  const entries = new Map<
    string,
    {
      label: string;
      color: string;
      kind: "state" | "pipe";
      equipment: string[];
    }
  >();
  for (const equipment of diagram.equipment) {
    for (const state of equipment.binding?.states ?? []) {
      const color = stateArtworkColor(state);
      const key = JSON.stringify(["state", state.label, color]);
      const existing = entries.get(key);
      if (existing) existing.equipment.push(equipment.label);
      else
        entries.set(key, {
          label: state.label,
          color,
          kind: "state",
          equipment: [equipment.label]
        });
    }
  }
  for (const connection of diagram.connections) {
    const label =
      connection.legendLabel ?? connection.label ?? "Pipe";
    const key = JSON.stringify([
      "pipe",
      label,
      connection.color.toLowerCase()
    ]);
    if (!entries.has(key))
      entries.set(key, {
        label,
        color: connection.color,
        kind: "pipe",
        equipment: []
      });
  }
  const values = [...entries.values()];
  return values.map((entry) => ({
    ...entry,
    label: values.some(
      (other) =>
        other !== entry &&
        other.kind === entry.kind &&
        other.label === entry.label &&
        other.color !== entry.color
    )
      ? `${entry.label} — ${entry.kind === "state" ? entry.equipment.join(", ") : entry.color}`
      : entry.label
  }));
}

/** Generated from configuration, never from the current reading. */
export function DiagramLegend({
  diagram,
  presentation = "symbols"
}: {
  diagram: Diagram;
  presentation?: "cards" | "symbols";
}) {
  const entries = diagramLegendEntries(diagram);
  return (
    <aside className="denile-legend" aria-label="Color legend">
      <strong>Color legend</strong>
      <ul>
        {entries.map((entry) => (
          <li
            key={`${entry.kind}:${entry.label}:${entry.color}`}>
            <span
              className={`denile-legend-swatch denile-legend-swatch--${entry.kind}`}
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span>{entry.label}</span>
          </li>
        ))}
        <li>
          <span
            className="denile-legend-swatch"
            style={{
              backgroundColor:
                presentation === "symbols"
                  ? "var(--pid-state-stale)"
                  : "#b54708"
            }}
            aria-hidden="true"
          />
          <span>Stale data</span>
        </li>
        <li>
          <span
            className="denile-legend-swatch denile-legend-swatch--neutral"
            aria-hidden="true"
          />
          <span>Unavailable / unconfirmed</span>
        </li>
      </ul>
    </aside>
  );
}
