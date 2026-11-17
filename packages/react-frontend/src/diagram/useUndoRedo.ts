import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import type { Edge } from "@xyflow/react";
import type { LinePalette } from "./pipes";
import type { SymbolNode } from "./types";

type Snapshot = {
  nodes: SymbolNode[];
  edges: Edge[];
  palette: LinePalette;
};

const LIMIT = 100;
/** Edits closer together than this (typing, repeated clicks) share one step. */
const MERGE_MS = 400;

/**
 * What counts as a change worth undoing: layout, names, orientation and
 * pipes. Selection, measured sizes and drag-in-progress are ignored.
 */
export function signature(
  nodes: SymbolNode[],
  edges: Edge[],
  palette: LinePalette
) {
  return JSON.stringify({
    p: palette,
    n: nodes.map((node) => [
      node.id,
      node.position.x,
      node.position.y,
      node.data
    ]),
    e: edges.map((edge) => [
      edge.id,
      edge.source,
      edge.target,
      edge.sourceHandle,
      edge.targetHandle,
      edge.style?.stroke,
      edge.label
    ])
  });
}

/**
 * Undo / redo for editor changes. Editor-only: it moves the drawing back
 * and forth and never touches telemetry or the test stand.
 */
export function useUndoRedo({
  nodes,
  edges,
  setNodes,
  setEdges,
  palette,
  setPalette,
  enabled
}: {
  nodes: SymbolNode[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<SymbolNode[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  /** Line colours are part of the drawing, so undo restores them too. */
  palette: LinePalette;
  setPalette: (palette: LinePalette) => void;
  enabled: boolean;
}) {
  const baseline = useRef<Snapshot>({ nodes, edges, palette });
  const baselineSignature = useRef(
    signature(nodes, edges, palette)
  );
  const lastChange = useRef(0);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);

  // Record the state from before each change.
  useEffect(() => {
    if (!enabled) return;
    if (nodes.some((node) => node.dragging)) return;
    const next = signature(nodes, edges, palette);
    if (next === baselineSignature.current) {
      baseline.current = { nodes, edges, palette };
      return;
    }
    const now = Date.now();
    if (now - lastChange.current >= MERGE_MS) {
      const before = baseline.current;
      setPast((stack) => [
        ...stack.slice(-(LIMIT - 1)),
        before
      ]);
    }
    lastChange.current = now;
    setFuture([]);
    baseline.current = { nodes, edges, palette };
    baselineSignature.current = next;
  }, [nodes, edges, palette, enabled]);

  const restore = useCallback(
    (snapshot: Snapshot) => {
      baseline.current = snapshot;
      baselineSignature.current = signature(
        snapshot.nodes,
        snapshot.edges,
        snapshot.palette
      );
      lastChange.current = 0;
      setNodes(
        snapshot.nodes.map((node) => ({
          ...node,
          selected: false,
          dragging: false
        }))
      );
      setEdges(
        snapshot.edges.map((edge) => ({
          ...edge,
          selected: false
        }))
      );
      setPalette(snapshot.palette);
    },
    [setNodes, setEdges, setPalette]
  );

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;
    // Read now: restore() replaces the baseline before updaters run.
    const current = baseline.current;
    setPast(past.slice(0, -1));
    setFuture((stack) => [...stack, current]);
    restore(previous);
  }, [past, restore]);

  const redo = useCallback(() => {
    const next = future[future.length - 1];
    if (!next) return;
    const current = baseline.current;
    setFuture(future.slice(0, -1));
    setPast((stack) => [...stack, current]);
    restore(next);
  }, [future, restore]);

  // Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y, except while typing in a field.
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey)
        return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(
            target.tagName
          ))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) undo();
      else if ((key === "z" && event.shiftKey) || key === "y")
        redo();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () =>
      window.removeEventListener("keydown", onKeyDown);
  }, [enabled, undo, redo]);

  return {
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0
  };
}
