import type { Dispatch, SetStateAction } from "react";
import type { Edge } from "@xyflow/react";

/**
 * Shown only while a pipe is selected: delete just that pipe here or with
 * the Delete key. Components are never removed from this panel.
 */
export function PipeTools({
  edges,
  setEdges,
  canEdit
}: {
  edges: Edge[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  canEdit: boolean;
}) {
  if (!canEdit) return null;
  const selectedCount = edges.filter(
    (edge) => edge.selected
  ).length;

  const box = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    fontSize: "12px",
    color: "var(--pid-stroke)",
    background: "var(--pid-surface)",
    border: "1px solid var(--editor-line)",
    borderRadius: "6px"
  } as const;

  if (selectedCount === 0) return null;

  return (
    <div style={box} role="toolbar" aria-label="Selected pipe">
      <span>
        {selectedCount} pipe{selectedCount === 1 ? "" : "s"}{" "}
        selected
      </span>
      <button
        type="button"
        onClick={() =>
          setEdges((current) =>
            current.filter((edge) => !edge.selected)
          )
        }
        style={{
          padding: "4px 10px",
          color: "var(--pid-stroke)",
          background: "transparent",
          border: "1px solid var(--editor-line)",
          borderRadius: "4px",
          cursor: "pointer"
        }}>
        ✕ Delete connection
      </button>
    </div>
  );
}
