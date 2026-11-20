import { useRef } from "react";
import type {
  Diagram,
  PIDViewerHandle
} from "@de-nile/pid-viewer";
import { ModuleFrame } from "../../components/ModuleFrame";
import { DiagramPanel } from "./DiagramPanel";

/** Example for Alvin to apply in RiverDash; this file lives only in DE-Nile. */
export function PIDModule({
  title = "P&ID",
  isAffected = false,
  theme = "dark",
  diagram
}: {
  title?: string;
  isAffected?: boolean;
  theme?: "light" | "dark";
  diagram?: Diagram;
}) {
  const viewerRef = useRef<PIDViewerHandle>(null);
  const actions = (
    <span
      data-no-drag
      style={{ display: "inline-flex", gap: 4 }}>
      <button
        type="button"
        aria-label="Zoom in P&ID"
        onClick={() => {
          void viewerRef.current?.zoomIn();
        }}>
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out P&ID"
        onClick={() => {
          void viewerRef.current?.zoomOut();
        }}>
        −
      </button>
      <button
        type="button"
        onClick={() => {
          void viewerRef.current?.fitView();
        }}>
        Fit
      </button>
    </span>
  );
  return (
    <ModuleFrame
      title={title}
      className={isAffected ? "affected-module" : ""}
      actions={actions}>
      <DiagramPanel
        ref={viewerRef}
        theme={theme}
        diagram={diagram}
        showControls={false}
      />
    </ModuleFrame>
  );
}
