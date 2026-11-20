import type { NodeProps } from "@xyflow/react";
import { DiagramSymbolNodeView } from "@de-nile/pid-viewer";
import type { SymbolNode } from "../diagram/types";
import { equipmentKinds } from "../diagram/equipmentKinds";

// Share Valerie's artwork, labels, dimensions and ports with the embedded viewer.
export default function MonitoringSymbolNode(
  props: NodeProps<SymbolNode>
) {
  return (
    <DiagramSymbolNodeView
      {...props}
      data={{
        ...props.data,
        kind: equipmentKinds[props.data.kind]
      }}
    />
  );
}
