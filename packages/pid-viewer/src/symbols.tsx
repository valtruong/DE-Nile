import type { Equipment } from "./diagram";

import tank from "./assets/tank.svg?raw";
import fullTank from "./assets/full-tank.svg?raw";
import halfTank from "./assets/half-tank.svg?raw";

import checkValve from "./assets/check-valve.svg?raw";
import engine from "./assets/engine.svg?raw";
import pressureTransducer from "./assets/pressure-transducer.svg?raw";

import pneumaticValve from "./assets/pneumatic-valve.svg?raw";
import openPV from "./assets/open-pv.svg?raw";
import closedPV1 from "./assets/closed-pv-1.svg?raw";
import closedPV2 from "./assets/closed-pv-2.svg?raw";

export type TankState = "full" | "half" | "empty";

export type PneumaticValveState =
  | "open"
  | "closedPV1"
  | "closedPV2";

export type EquipmentVisualState =
  | TankState
  | PneumaticValveState;

const baseSymbols: Record<Equipment["kind"], string> = {
  tank,
  "check-valve": checkValve,
  "pneumatic-valve": pneumaticValve,
  "pressure-transducer": pressureTransducer,
  engine
};

function getSymbol(
  kind: Equipment["kind"],
  visualState?: EquipmentVisualState
) {
  if (kind === "tank") {
    if (visualState === "full") return fullTank;
    if (visualState === "half") return halfTank;
    if (visualState === "empty") return tank;
  }

  if (kind === "pneumatic-valve") {
    if (visualState === "open") return openPV;
    if (visualState === "closedPV1") return closedPV1;
    if (visualState === "closedPV2") return closedPV2;
  }

  return baseSymbols[kind];
}

export function EquipmentSymbol({
  kind,
  visualState,
  size = 90
}: {
  kind: Equipment["kind"];
  visualState?: EquipmentVisualState;
  size?: number;
}) {
  return (
    <span
      className="denile-symbol"
      style={{
        width: size,
        height: size
      }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: getSymbol(kind, visualState)
      }}
    />
  );
}