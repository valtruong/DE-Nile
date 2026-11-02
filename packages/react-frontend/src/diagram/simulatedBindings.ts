import type { Binding } from "@de-nile/pid-viewer";

// Demo tags and units only: replace these once RiverDash confirms its contract.
export const simulatedBindings: Record<string, Binding> = {
  "pressure-transducer1": {
    topic: "demo.pressure.pt101",
    valueType: "number",
    unit: "kPa",
    precision: 1
  },
  "pressure-transducer2": {
    topic: "demo.pressure.pt201",
    valueType: "number",
    unit: "kPa",
    precision: 1
  },
  "pneumatic-valve1": {
    topic: "demo.valve.pv101",
    valueType: "string",
    states: [
      { value: "open", label: "Open", color: "#16794b" },
      { value: "closed", label: "Closed", color: "#b42318" }
    ]
  },
  "pneumatic-valve2": {
    topic: "demo.valve.pv201",
    valueType: "string",
    states: [
      { value: "open", label: "Open", color: "#16794b" },
      { value: "closed", label: "Closed", color: "#b42318" }
    ]
  }
};
