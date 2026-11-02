import {
  Handle,
  Position,
  type NodeProps
} from "@xyflow/react";

import type {
  SymbolKind,
  SymbolNode
} from "./diagram/types";

import {
  EquipmentSymbol,
  type Equipment
} from "@de-nile/pid-viewer";

const equipmentKinds = {
  checkValve: "check-valve",
  engine: "engine",
  pneumaticValve: "pneumatic-valve",
  pressureTransducer: "pressure-transducer",
  tank: "tank"
} as const satisfies Record<SymbolKind, Equipment["kind"]>;

const symbolSizes = {
  tank: 130,
  engine: 180,
  pneumaticValve: 70,
  checkValve: 70,
  pressureTransducer: 50
} as const satisfies Record<SymbolKind, number>;

function ValveStateLabel({
  state
}: {
  state: "open" | "closedPV1" | "closedPV2" | undefined;
}) {
  if (!state) return null;

  const details = {
    open: {
      label: "OPEN",
      color: "#A5C200"
    },
    closedPV1: {
      label: "CLOSED",
      color: "#C20D00"
    },
    closedPV2: {
      label: "CLOSED",
      color: "#C20D00"
    }
  }[state];

  return (
    <div
      style={{
        marginTop: "4px",
        color: details.color,
        fontSize: "11px",
        fontWeight: 700
      }}>
      {details.label}
    </div>
  );
}

function Port({
  id,
  position,
  top,
  left
}: {
  id: string;
  position: Position;
  top: string;
  left: string;
}) {
  const style = {
    width: "10px",
    height: "10px",
    top,
    left,
    background: "transparent",
    border: "none"
  };

  return (
    <>
      <Handle
        type="source"
        id={`${id}-source`}
        position={position}
        style={style}
      />

      <Handle
        type="target"
        id={`${id}-target`}
        position={position}
        style={style}
      />
    </>
  );
}

function SymbolPorts({
  kind
}: {
  kind: SymbolKind;
}) {
  if (kind === "tank") {
    return (
      <>
        <Port
          id="top"
          position={Position.Top}
          top="4.5%"
          left="50%"
        />

        <Port
          id="bottom"
          position={Position.Bottom}
          top="88.5%"
          left="50%"
        />
      </>
    );
  }

  if (kind === "pressureTransducer") {
    return (
      <Port
        id="bottom"
        position={Position.Bottom}
        top="71%"
        left="50%"
      />
    );
  }

  if (kind === "engine") {
    return (
      <>
        <Port
          id="fuel-top"
          position={Position.Top}
          top="3.5%"
          left="42%"
        />

        <Port
          id="oxidizer-top"
          position={Position.Top}
          top="3.5%"
          left="58%"
        />
      </>
    );
  }

  if (kind === "pneumaticValve") {
    return (
      <>
        <Port
          id="left"
          position={Position.Left}
          top="57%"
          left="8%"
        />

        <Port
          id="right"
          position={Position.Right}
          top="55.5%"
          left="58%"
        />
      </>
    );
  }

  // Check valve pipe entry and exit positions
  return (
    <>
      <Port
        id="left"
        position={Position.Left}
        top="51.5%"
        left="30%"
      />

      <Port
        id="right"
        position={Position.Right}
        top="51.5%"
        left="55%"
      />
    </>
  );
}

  function PIDSymbolNode({ data }: NodeProps<SymbolNode>) {
  const symbolSize = symbolSizes[data.kind];

  const isPressureTransducer = data.kind === "pressureTransducer";

  const valveState =
    data.visualState === "open" ||
    data.visualState === "closedPV1" ||
    data.visualState === "closedPV2"
      ? data.visualState
      : undefined;

  return (
    <div
      style={{
        position: "relative",
        width: "120px",
        textAlign: "center",
        color: "var(--pid-stroke)"
      }}>

    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: `${symbolSize}px`
      }}>
      <div
        style={{
          position: "relative",
          width: `${symbolSize}px`,
          height: `${symbolSize}px`
        }}>
        <EquipmentSymbol
          kind={equipmentKinds[data.kind]}
          visualState={data.visualState}
          size={symbolSize}
        />
        <SymbolPorts kind={data.kind} />
      </div>
    </div>

    <div
      style={
        isPressureTransducer
          ? {
              position: "absolute",
              top: "6px",
              left: "calc(50% + 32px)",
              width: "150px",
              textAlign: "left",
              lineHeight: 1.2
            }
          : undefined
      }>
      {data.label}
    </div>

      {data.kind === "pneumaticValve" && (
        <ValveStateLabel state={valveState} />
      )}

    </div>
  );
}

export default PIDSymbolNode;