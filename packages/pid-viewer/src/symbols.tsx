import type { Equipment } from "./diagram";
import tank from "./assets/tank.svg";
import checkValve from "./assets/check-valve.svg";
import pneumaticValve from "./assets/pneumatic-valve.svg";
import pressureTransducer from "./assets/pressure-transducer.svg";
import engine from "./assets/engine.svg";

// These are the team's SVGs from main; the library build embeds them locally.
const symbols: Record<Equipment["kind"], string> = {
  tank,
  "check-valve": checkValve,
  "pneumatic-valve": pneumaticValve,
  "pressure-transducer": pressureTransducer,
  engine
};

/** Use the same equipment artwork in the editor and embedded viewer. */
export function EquipmentSymbol({
  kind
}: {
  kind: Equipment["kind"];
}) {
  return (
    <img
      className="denile-symbol"
      src={symbols[kind]}
      width="90"
      height="90"
      alt=""
      aria-hidden="true"
    />
  );
}
