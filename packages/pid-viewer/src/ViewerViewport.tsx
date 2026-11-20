import {
  useCallback,
  useEffect,
  useImperativeHandle,
  type Ref
} from "react";
import {
  Controls,
  ControlButton,
  useReactFlow,
  useNodesInitialized,
  useStore,
  type Rect
} from "@xyflow/react";

export interface PIDViewerHandle {
  zoomIn(): Promise<boolean>;
  zoomOut(): Promise<boolean>;
  fitView(): Promise<boolean>;
}

/** Include out-of-flow symbol labels/readings, which node boxes alone omit. */
export function visualBounds(
  bounds: Rect,
  root: HTMLElement | null,
  viewport: { x: number; y: number; zoom: number }
): Rect {
  if (!root || viewport.zoom <= 0) return bounds;
  const origin = root.getBoundingClientRect();
  let left = bounds.x,
    top = bounds.y;
  let right = bounds.x + bounds.width,
    bottom = bounds.y + bounds.height;
  for (const element of root.querySelectorAll<HTMLElement>(
    ".react-flow__node, .react-flow__node div, .react-flow__node span, .react-flow__edge-textwrapper, .react-flow__edgelabel-renderer > *"
  )) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const x =
      (rect.left - origin.left - viewport.x) / viewport.zoom;
    const y =
      (rect.top - origin.top - viewport.y) / viewport.zoom;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + rect.width / viewport.zoom);
    bottom = Math.max(bottom, y + rect.height / viewport.zoom);
  }
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

/** Runs within React Flow's provider, exposing viewport actions without node edits. */
export function ViewerViewport({
  viewerRef,
  geometryKey,
  autoFit,
  showControls
}: {
  viewerRef?: Ref<PIDViewerHandle>;
  geometryKey: string;
  autoFit: boolean;
  showControls: boolean;
}) {
  const {
    fitBounds,
    getNodesBounds,
    getNodes,
    getViewport,
    zoomIn,
    zoomOut
  } = useReactFlow();
  const initialized = useNodesInitialized();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const root = useStore((state) => state.domNode);
  const fitView = useCallback(() => {
    if (!initialized || width <= 0 || height <= 0)
      return Promise.resolve(false);
    const bounds = visualBounds(
      getNodesBounds(getNodes()),
      root,
      getViewport()
    );
    return fitBounds(bounds, { padding: 0.2 });
  }, [
    initialized,
    width,
    height,
    getNodesBounds,
    getNodes,
    root,
    getViewport,
    fitBounds
  ]);
  useImperativeHandle(
    viewerRef,
    () => ({
      zoomIn: () =>
        initialized ? zoomIn() : Promise.resolve(false),
      zoomOut: () =>
        initialized ? zoomOut() : Promise.resolve(false),
      fitView
    }),
    [initialized, zoomIn, zoomOut, fitView]
  );
  useEffect(() => {
    if (!autoFit) return;
    const frame = requestAnimationFrame(() => {
      void fitView();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFit, geometryKey, fitView]);
  if (!showControls) return null;
  return (
    <Controls showInteractive={false} showFitView={false}>
      <ControlButton
        title="Fit diagram"
        aria-label="Fit diagram"
        onClick={() => {
          void fitView();
        }}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </ControlButton>
    </Controls>
  );
}
