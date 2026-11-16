import {
  useEffect,
  type Dispatch,
  type SetStateAction
} from "react";
import {
  NodeToolbar,
  Position,
  useUpdateNodeInternals
} from "@xyflow/react";
import type { SymbolNode } from "../diagram/types";
import {
  flipHorizontal,
  flipVertical,
  normalizeOrientation,
  rotate,
  type Orientation
} from "../diagram/orientation";

type Action = {
  label: string;
  icon: string;
  apply: (orientation: Orientation) => Orientation;
};

const actions: Action[] = [
  {
    label: "Rotate left 90°",
    icon: "↺",
    apply: (o) => rotate(o, -90)
  },
  {
    label: "Rotate right 90°",
    icon: "↻",
    apply: (o) => rotate(o, 90)
  },
  {
    label: "Flip horizontal",
    icon: "⇋",
    apply: flipHorizontal
  },
  {
    label: "Flip vertical",
    icon: "⇅",
    apply: flipVertical
  }
];

/**
 * Editor-only layout tools for the selected equipment. Orientation is
 * saved with the node's layout data; it never touches telemetry or
 * sends anything to the test stand.
 */
export function OrientationControls({
  nodes,
  setNodes,
  canEdit
}: {
  nodes: SymbolNode[];
  setNodes: Dispatch<SetStateAction<SymbolNode[]>>;
  canEdit: boolean;
}) {
  const updateNodeInternals = useUpdateNodeInternals();

  // Ports move with the artwork, so React Flow must re-measure them.
  const signature = nodes
    .map((node) => {
      const o = normalizeOrientation(node.data.orientation);
      return `${node.id}:${o.rotation}:${o.flipX}`;
    })
    .join("|");
  useEffect(() => {
    updateNodeInternals(nodes.map((node) => node.id));
    // `signature` captures every orientation change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, updateNodeInternals]);

  const selectedIds = nodes
    .filter((node) => node.selected)
    .map((node) => node.id);
  if (!canEdit || selectedIds.length === 0) return null;

  function applyToSelection(apply: Action["apply"]) {
    setNodes((current) =>
      current.map((node) =>
        node.selected
          ? {
              ...node,
              data: {
                ...node.data,
                orientation: apply(
                  normalizeOrientation(node.data.orientation)
                )
              }
            }
          : node
      )
    );
  }

  return (
    <NodeToolbar
      nodeId={selectedIds}
      isVisible
      position={Position.Top}
      offset={12}>
      <div
        role="toolbar"
        aria-label="Orient selected equipment"
        style={{
          display: "flex",
          gap: "4px",
          padding: "4px",
          background: "var(--pid-surface)",
          border: "1px solid var(--pid-stroke)",
          borderRadius: "6px"
        }}>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.label}
            aria-label={action.label}
            onClick={() => applyToSelection(action.apply)}
            style={{
              width: "32px",
              height: "32px",
              fontSize: "18px",
              lineHeight: 1,
              color: "var(--pid-stroke)",
              background: "transparent",
              border: "1px solid var(--pid-stroke)",
              borderRadius: "4px",
              cursor: "pointer"
            }}>
            {action.icon}
          </button>
        ))}
      </div>
    </NodeToolbar>
  );
}