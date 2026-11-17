import type { CSSProperties, ReactNode } from "react";
import {
  Handle,
  Position,
  type NodeProps
} from "@xyflow/react";

import type { SymbolKind, SymbolNode } from "./diagram/types";

import {
  EquipmentSymbol,
  formatReading
} from "@de-nile/pid-viewer";

import { equipmentKinds } from "./diagram/equipmentKinds";
import { portDefs, symbolSizes } from "./diagram/ports";
import {
  chooseLabelSide,
  labelInset,
  slotSide,
  type LabelSlot
} from "./diagram/labelPlacement";
import {
  isDefaultOrientation,
  normalizeOrientation,
  orientPoint,
  orientPosition,
  orientationTransform,
  type Orientation
} from "./diagram/orientation";

function ValveStateLabel({
  state
}: {
  state: "open" | "closedPV1" | "closedPV2" | undefined;
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
  left,
  orientation
}: {
  id: string;
  position: Position;
  top: string;
  left: string;
  orientation: Orientation;
}) {
  const unchanged = isDefaultOrientation(orientation);
  // Ports follow the artwork: move the anchor and the side the pipe leaves from.
  const point = orientPoint(
    { x: parseFloat(left), y: parseFloat(top) },
    orientation
  );
  const orientedPosition = orientPosition(
    position,
    orientation
  );
  const style = {
    width: "10px",
    height: "10px",
    top: unchanged ? top : `${point.y}%`,
    left: unchanged ? left : `${point.x}%`,
    ...(unchanged
      ? {}
      : { transform: "translate(-50%, -50%)" }),
    background: "transparent",
    border: "none"
  };

  return (
    <>
      <Handle
        type="source"
        id={`${id}-source`}
        position={orientedPosition}
        style={style}
      />

      <Handle
        type="target"
        id={`${id}-target`}
        position={orientedPosition}
        style={style}
      />
    </>
  );
}

function SymbolPorts({
  kind,
  orientation
}: {
  kind: SymbolKind;
  orientation: Orientation;
}) {
  return (
    <>
      {portDefs[kind].map((port) => (
        <Port
          key={port.id}
          orientation={orientation}
          id={port.id}
          position={port.position}
          top={`${port.top}%`}
          left={`${port.left}%`}
        />
      ))}
    </>
  );
}

// Labels that leave the default spot are positioned around the symbol box.
type Inset = { x: number; y: number };

/**
 * Position a label around the drawn artwork. `inset` is the empty space
 * between the symbol box and the artwork, so labels sit close to what you see.
 */
function slotStyle(
  slot: LabelSlot,
  inset: Inset
): CSSProperties {
  const side = slotSide(slot);
  const align = slot.endsWith("-start")
    ? "start"
    : slot.endsWith("-end")
      ? "end"
      : "center";

  if (side === "top" || side === "bottom") {
    const across: CSSProperties =
      align === "start"
        ? { left: inset.x, textAlign: "left" }
        : align === "end"
          ? { right: inset.x, textAlign: "right" }
          : {
              left: "50%",
              transform: "translateX(-50%)",
              textAlign: "center"
            };
    return side === "top"
      ? {
          bottom: `calc(100% - ${inset.y}px)`,
          paddingBottom: "4px",
          ...across
        }
      : {
          top: `calc(100% - ${inset.y}px)`,
          paddingTop: "4px",
          ...across
        };
  }

  const along: CSSProperties =
    align === "start"
      ? { top: inset.y }
      : align === "end"
        ? { bottom: inset.y }
        : { top: "50%", transform: "translateY(-50%)" };
  return side === "right"
    ? {
        left: `calc(100% - ${inset.x}px)`,
        paddingLeft: "6px",
        textAlign: "left",
        ...along
      }
    : {
        right: `calc(100% - ${inset.x}px)`,
        paddingRight: "6px",
        textAlign: "right",
        ...along
      };
}

function SideLabel({
  side,
  inset,
  children
}: {
  side: LabelSlot;
  inset: Inset;
  children: ReactNode;
}) {
  return (
    <div
      data-label-side={side}
      style={{
        position: "absolute",
        width: "120px",
        lineHeight: 1.2,
        ...slotStyle(side, inset)
      }}>
      {children}
    </div>
  );
}

function PIDSymbolNode({ data }: NodeProps<SymbolNode>) {
  const symbolSize = symbolSizes[data.kind];
  const display = data.binding
    ? formatReading(data.binding, data.reading)
    : undefined;

  const orientation = normalizeOrientation(data.orientation);

  const isPressureTransducer =
    data.kind === "pressureTransducer";

  // Move the label to a side with no pipe; the default spot stays unchanged.
  const labelSide =
    data.labelSide ?? chooseLabelSide(data.kind, orientation);
  const labelIsDefault =
    labelSide === (isPressureTransducer ? "right" : "bottom");

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
          <div
            data-rotation={orientation.rotation}
            data-flipped={orientation.flipX}
            style={{
              width: `${symbolSize}px`,
              height: `${symbolSize}px`,
              transform: isDefaultOrientation(orientation)
                ? undefined
                : orientationTransform(orientation),
              transformOrigin: "50% 50%"
            }}>
            <EquipmentSymbol
              kind={equipmentKinds[data.kind]}
              visualState={data.visualState}
              size={symbolSize}
            />
          </div>
          <SymbolPorts
            kind={data.kind}
            orientation={orientation}
          />
          {!labelIsDefault && (
            <SideLabel
              side={labelSide}
              inset={labelInset(data.kind, orientation)}>
              <div>{data.label}</div>
              {data.kind === "pneumaticValve" && (
                <ValveStateLabel state={valveState} />
              )}
              {display &&
                !(
                  data.kind === "pneumaticValve" && valveState
                ) && (
                  <div
                    className="pid-telemetry-reading"
                    style={{
                      paddingTop: "4px",
                      fontSize: "12px",
                      lineHeight: 1.4,
                      color:
                        data.reading?.status === "stale"
                          ? "var(--pid-state-stale)"
                          : "var(--pid-stroke)"
                    }}>
                    {display.text}
                  </div>
                )}
            </SideLabel>
          )}
        </div>
      </div>

      {labelIsDefault && (
        <div
          data-label-side={labelSide}
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
          {isPressureTransducer && display && (
            // Keep the reading with its label, beside the symbol, so it does
            // not land on the pipe that leaves the bottom port.
            <div
              className="pid-telemetry-reading"
              style={{
                paddingTop: "4px",
                fontSize: "12px",
                lineHeight: 1.4,
                color:
                  data.reading?.status === "stale"
                    ? "var(--pid-state-stale)"
                    : "var(--pid-stroke)"
              }}>
              {display.text}
            </div>
          )}
        </div>
      )}

      {labelIsDefault && data.kind === "pneumaticValve" && (
        // Reserve the status line so stale/unavailable transitions keep ports fixed.
        <div style={{ height: "19px", display: "flow-root" }}>
          <ValveStateLabel state={valveState} />
        </div>
      )}
      {labelIsDefault &&
        display &&
        !isPressureTransducer &&
        !(data.kind === "pneumaticValve" && valveState) && (
          <div
            className="pid-telemetry-reading"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              width: "100%",
              paddingTop: "4px",
              fontSize: "12px",
              lineHeight: 1.4,
              color:
                data.reading?.status === "stale"
                  ? "var(--pid-state-stale)"
                  : "var(--pid-stroke)"
            }}>
            {display.text}
          </div>
        )}
    </div>
  );
}

export default PIDSymbolNode;
