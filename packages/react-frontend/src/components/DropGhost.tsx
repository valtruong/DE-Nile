import { EquipmentSymbol } from "@de-nile/pid-viewer";
import { equipmentKinds } from "../diagram/equipmentKinds";
import {
  orientationTransform,
  type Orientation
} from "../diagram/orientation";
import type { SymbolKind } from "../diagram/types";

/** Dashed preview of where a dragged symbol will land. */
export function DropGhost({
  kind,
  left,
  top,
  size,
  orientation,
  hint
}: {
  kind: SymbolKind;
  left: number;
  top: number;
  size: number;
  orientation: Orientation;
  hint?: string;
}) {
  return (
    <div
      className="denile-ghost"
      style={{ left, top, width: size, height: size }}>
      <div
        className="denile-ghost__symbol"
        style={{
          transform: orientationTransform(orientation)
        }}>
        <EquipmentSymbol
          kind={equipmentKinds[kind]}
          size={size}
        />
      </div>
      {hint && <div className="denile-ghost__hint">{hint}</div>}
    </div>
  );
}
