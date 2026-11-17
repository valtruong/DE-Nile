import {
  useEffect,
  type Dispatch,
  type SetStateAction
} from "react";
import {
  NodeToolbar,
  Position,
  useReactFlow,
  useUpdateNodeInternals
} from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import type { SymbolNode } from "../diagram/types";
import {
  flipHorizontal,
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
    label: "Rotate 90°",
    icon: "↻",
    apply: (o) => rotate(o, 90)
  },
  {
    label: "Mirror flip",
    icon: "⇋",
    apply: flipHorizontal
  }
];

const iconButtonStyle = {
  width: "32px",
  height: "32px",
  fontSize: "18px",
  lineHeight: 1,
  color: "var(--pid-stroke)",
  background: "transparent",
  border: "1px solid var(--pid-stroke)",
  borderRadius: "4px",
  cursor: "pointer"
} as const;

/**
 * Editor-only layout tools for the selected equipment. Orientation is
 * saved with the node's layout data; it never touches telemetry or
 * sends anything to the test stand.
 */
export function OrientationControls({
  nodes,
  setNodes,
  edges,
  setEdges,
  canEdit,
  onDuplicate
}: {
  nodes: SymbolNode[];
  setNodes: Dispatch<SetStateAction<SymbolNode[]>>;
  edges: Edge[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  canEdit: boolean;
  /** Copy and paste the selected components in one step. */
  onDuplicate: () => void;
}) {
  const updateNodeInternals = useUpdateNodeInternals();
  const { deleteElements } = useReactFlow();

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

  const selected = new Set(selectedIds);
  const hasPipes = edges.some(
    (edge) =>
      selected.has(edge.source) || selected.has(edge.target)
  );

  // Removes the pipes only; the selected equipment stays on the diagram.
  function disconnect() {
    setEdges((current) =>
      current.filter(
        (edge) =>
          !selected.has(edge.source) &&
          !selected.has(edge.target)
      )
    );
  }

  // Same path as pressing Delete: React Flow asks for confirmation first.
  function removeComponents() {
    void deleteElements({
      nodes: selectedIds.map((id) => ({ id }))
    });
  }

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
            style={iconButtonStyle}>
            {action.icon}
          </button>
        ))}
        <button
          type="button"
          title="Duplicate (Ctrl+C, Ctrl+V)"
          aria-label="Duplicate"
          onClick={onDuplicate}
          style={iconButtonStyle}>
          ⧉
        </button>
        <button
          type="button"
          title="Remove connections (keeps the component)"
          aria-label="Remove connections"
          disabled={!hasPipes}
          onClick={disconnect}
          style={{
            ...iconButtonStyle,
            cursor: hasPipes ? "pointer" : "not-allowed",
            opacity: hasPipes ? 1 : 0.4
          }}>
          ✂
        </button>
        <button
          type="button"
          title="Delete component"
          aria-label="Delete component"
          onClick={removeComponents}
          style={{
            ...iconButtonStyle,
            color: "var(--pid-state-closed)"
          }}>
          ✕
        </button>
      </div>
    </NodeToolbar>
  );
}
