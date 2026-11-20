import {
  Handle,
  Position,
  type Node,
  type NodeProps
} from "@xyflow/react";

import type { Binding, Equipment } from "./diagram";
import type { Reading } from "./telemetry";
import type { EquipmentVisualState } from "./symbols";
import type { CSSProperties, ReactNode } from "react";
type SymbolKind = Equipment["kind"];
export type DiagramSymbolNode = Node<{
  kind: SymbolKind;
  label: string;
  visualState?: EquipmentVisualState;
  binding?: Binding;
  reading?: Reading;
  symbol?: ReactNode;
}>;

import { EquipmentSymbol } from "./symbols";
import { formatReading } from "./telemetry";
import { stateArtworkColor } from "./DiagramLegend";

/** Artwork changes only for an explicitly mapped, confirmed live value. */
export function resolveEquipmentVisualState(
  equipment: Equipment,
  reading?: Reading
) {
  return reading?.status === "available" && !reading.freshness
    ? equipment.binding?.states?.find(
        (state) => state.value === reading.value
      )?.visualState
    : undefined;
}

const symbolSizes = {
  tank: 130,
  engine: 180,
  "pneumatic-valve": 70,
  "check-valve": 70,
  "pressure-transducer": 50
} as const satisfies Record<SymbolKind, number>;

function ValveStateLabel({
  state,
  color
}: {
  state: "open" | "closedPV1" | "closedPV2" | undefined;
  color?: string;
}) {
  if (!state) return null;

  const details = {
    open: {
      label: "OPEN",
      color: "var(--pid-state-open)"
    },
    closedPV1: {
      label: "CLOSED",
      color: "var(--pid-state-closed)"
    },
    closedPV2: {
      label: "CLOSED",
      color: "var(--pid-state-closed)"
    }
  }[state];

  return (
    <div
      style={{
        marginTop: "4px",
        color: "var(--pid-stroke)",
        fontSize: "11px",
        fontWeight: 700
      }}>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          marginRight: 4,
          backgroundColor: color ?? details.color
        }}
      />
      {details.label}
    </div>
  );
}

function Port({
  id,
  position,
  top,
  left,
  connectable
}: {
  id: string;
  position: Position;
  top: string;
  left: string;
  connectable: boolean;
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
        isConnectable={connectable}
        type="source"
        id={`${id}-source`}
        position={position}
        style={style}
      />

      <Handle
        isConnectable={connectable}
        type="target"
        id={`${id}-target`}
        position={position}
        style={style}
      />
    </>
  );
}

function SymbolPorts({
  kind,
  connectable
}: {
  kind: SymbolKind;
  connectable: boolean;
}) {
  if (kind === "tank") {
    return (
      <>
        <Port
          connectable={connectable}
          id="top"
          position={Position.Top}
          top="4.5%"
          left="50%"
        />

        <Port
          connectable={connectable}
          id="bottom"
          position={Position.Bottom}
          top="88.5%"
          left="50%"
        />
      </>
    );
  }

  if (kind === "pressure-transducer") {
    return (
      <Port
        connectable={connectable}
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
          connectable={connectable}
          id="fuel-top"
          position={Position.Top}
          top="3.5%"
          left="42%"
        />

        <Port
          connectable={connectable}
          id="oxidizer-top"
          position={Position.Top}
          top="3.5%"
          left="58%"
        />
      </>
    );
  }

  if (kind === "pneumatic-valve") {
    return (
      <>
        <Port
          connectable={connectable}
          id="left"
          position={Position.Left}
          top="57%"
          left="8%"
        />

        <Port
          connectable={connectable}
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
        connectable={connectable}
        id="left"
        position={Position.Left}
        top="51.5%"
        left="30%"
      />

      <Port
        connectable={connectable}
        id="right"
        position={Position.Right}
        top="51.5%"
        left="55%"
      />
    </>
  );
}

export function DiagramSymbolNodeView({
  data,
  isConnectable
}: NodeProps<DiagramSymbolNode>) {
  const symbolSize = symbolSizes[data.kind];
  const display = data.binding
    ? formatReading(data.binding, data.reading)
    : undefined;

  const isPressureTransducer =
    data.kind === "pressure-transducer";

  const valveState =
    data.visualState === "open" ||
    data.visualState === "closedPV1" ||
    data.visualState === "closedPV2"
      ? data.visualState
      : undefined;
  const reading = data.reading;
  const confirmedState =
    reading?.status === "available" && !reading.freshness
      ? data.binding?.states?.find(
          (state) => state.value === reading.value
        )
      : undefined;
  const artworkColor = confirmedState
    ? stateArtworkColor(confirmedState)
    : undefined;

  return (
    <div
      style={
        {
          position: "relative",
          width: "120px",
          textAlign: "center",
          color: "var(--pid-stroke)",
          ...(confirmedState?.color
            ? {
                "--pid-valve-open": confirmedState.color,
                "--pid-valve-closed": confirmedState.color,
                "--pid-tank-fluid": confirmedState.color
              }
            : {})
        } as CSSProperties
      }>
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
          {data.symbol ?? (
            <EquipmentSymbol
              kind={data.kind}
              visualState={data.visualState}
              size={symbolSize}
            />
          )}
          <SymbolPorts
            kind={data.kind}
            connectable={isConnectable}
          />
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

      {data.kind === "pneumatic-valve" && (
        // Reserve the status line so stale/unavailable transitions keep ports fixed.
        <div style={{ height: "19px", display: "flow-root" }}>
          <ValveStateLabel
            state={valveState}
            color={artworkColor}
          />
        </div>
      )}
      {display && (
        <div
          className="pid-telemetry-reading"
          style={{
            width: "100%",
            minHeight: "7em",
            paddingTop: "4px",
            fontSize: "12px",
            lineHeight: 1.4,
            color:
              data.reading?.status === "stale"
                ? "var(--pid-state-stale)"
                : "var(--pid-stroke)"
          }}>
          {data.kind === "pneumatic-valve" && valveState
            ? null
            : display.text}
        </div>
      )}
    </div>
  );
}
