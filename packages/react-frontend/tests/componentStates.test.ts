import { expect, it } from "vitest";
import { normalizeVisualState } from "../src/telemetry/componentStates";

it("maps tank telemetry to tank display states", () => {
  expect(
    normalizeVisualState("tank1", "tank", "full")
  ).toBe("full");

  expect(
    normalizeVisualState("tank2", "tank", "half")
  ).toBe("half");

  expect(
    normalizeVisualState("tank3", "tank", "empty")
  ).toBe("empty");
});

it("maps closed valve readings using the valve identifier", () => {
  expect(
    normalizeVisualState(
      "pneumatic-valve1",
      "pneumaticValve",
      "closed"
    )
  ).toBe("closedPV1");

  expect(
    normalizeVisualState(
      "pneumatic-valve2",
      "pneumaticValve",
      "closed"
    )
  ).toBe("closedPV2");
});