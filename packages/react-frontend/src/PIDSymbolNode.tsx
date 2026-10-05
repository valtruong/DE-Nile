import { Handle, Position } from "@xyflow/react";

import checkValve from "./assets/check-valve.svg";
import engine from "./assets/engine.svg";
import pneumaticValve from "./assets/pneumatic-valve.svg";
import pressureTransducer from "./assets/pressure-transducer.svg";
import tank from "./assets/tank.svg";

const symbols =
{
    checkValve: checkValve,
    engine: engine,
    pneumaticValve: pneumaticValve,
    pressureTransducer: pressureTransducer,
    tank: tank,
};

function PIDSymbolNode ({data}: any) {
    const symbolImage = symbols[data.kind as keyof typeof symbols];

  return (
    <div
      style={{
        position: "relative",
        width: "120px",
        textAlign: "center",
        color: "white",
      }}
    >
      {/* A pipe can connect into the left side */}
      <Handle type="target" position={Position.Left} id="inlet" />

      {/* Your SVG symbol */}
      <img
        src={symbolImage}
        alt={data.label}
        style={{
          width: "90px",
          height: "90px",
          objectFit: "contain",
          display: "block",
          margin: "0 auto",
        }}
      />

      {/* The P&ID label beneath the symbol */}
      <div>{data.label}</div>

      {/* A pipe can connect out from the right side */}
      <Handle type="source" position={Position.Right} id="outlet" />
    </div>
  );
}

export default PIDSymbolNode;