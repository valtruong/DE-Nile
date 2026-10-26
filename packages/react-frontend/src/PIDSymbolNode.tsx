import {
  Handle,
  Position,
  type Node,
  type NodeProps
} from "@xyflow/react";
import { EquipmentSymbol } from "@de-nile/pid-viewer";

// Keep the editor's existing kind names and IDs; adapt only at the display boundary.
const equipmentKinds = {
  checkValve: "check-valve",
  engine: "engine",
  pneumaticValve: "pneumatic-valve",
  pressureTransducer: "pressure-transducer",
  tank: "tank"
} as const;
export type SymbolNode = Node<
  { kind: keyof typeof equipmentKinds; label: string },
  "pidSymbol"
>;

function PIDSymbolNode({ data }: NodeProps<SymbolNode>) {
  return (
    <div
      style={{
        position: "relative",
        width: "120px",
        textAlign: "center",
        color: "white"
      }}>
      <Handle
        type="target"
        position={Position.Left}
        id="inlet"
      />
      <div
        style={{ display: "flex", justifyContent: "center" }}>
        <EquipmentSymbol kind={equipmentKinds[data.kind]} />
      </div>
      <div>{data.label}</div>
      <Handle
        type="source"
        position={Position.Right}
        id="outlet"
      />
    </div>
  );
}
export default PIDSymbolNode;
