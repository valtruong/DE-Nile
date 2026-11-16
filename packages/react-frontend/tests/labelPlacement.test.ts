import { describe, expect, it } from "vitest";
import {
  chooseLabelSide,
  occupiedSides
} from "../src/diagram/labelPlacement";
import {
  DEFAULT_ORIENTATION,
  flipHorizontal,
  flipVertical,
  rotate
} from "../src/diagram/orientation";

describe("label placement", () => {
  it("keeps today's spots when nothing is rotated", () => {
    // A tank pipe leaves the bottom edge, so its label goes to the side.
    expect(chooseLabelSide("tank", DEFAULT_ORIENTATION)).toBe(
      "right"
    );
    expect(
      chooseLabelSide("pneumaticValve", DEFAULT_ORIENTATION)
    ).toBe("bottom");
    expect(chooseLabelSide("engine", DEFAULT_ORIENTATION)).toBe(
      "bottom"
    );
    expect(
      chooseLabelSide("pressureTransducer", DEFAULT_ORIENTATION)
    ).toBe("right");
  });

  it("moves a valve's label to the side when pipes go top and bottom", () => {
    const o = rotate(DEFAULT_ORIENTATION, 90);
    expect(occupiedSides("pneumaticValve", o)).toEqual(
      new Set(["top", "bottom"])
    );
    expect(chooseLabelSide("pneumaticValve", o)).toBe("right");
  });

  it("moves a tank's label off the pipes at both ends", () => {
    expect(
      chooseLabelSide("tank", rotate(DEFAULT_ORIENTATION, 90))
    ).toBe("bottom");
    expect(
      chooseLabelSide("tank", flipVertical(DEFAULT_ORIENTATION))
    ).toBe("right");
  });

  it("puts the engine label on top once its pipes are flipped to the bottom", () => {
    expect(
      chooseLabelSide(
        "engine",
        flipVertical(DEFAULT_ORIENTATION)
      )
    ).toBe("top");
  });

  it("moves the transducer label away from a pipe that turns right", () => {
    const o = rotate(DEFAULT_ORIENTATION, 270); // port bottom -> right
    expect(chooseLabelSide("pressureTransducer", o)).toBe(
      "bottom"
    );
  });

  it("never returns an occupied side when a free one exists", () => {
    const kinds = [
      "tank",
      "engine",
      "pneumaticValve",
      "checkValve",
      "pressureTransducer"
    ] as const;
    for (const kind of kinds) {
      for (const flip of [false, true]) {
        for (const turns of [0, 1, 2, 3]) {
          let o = DEFAULT_ORIENTATION;
          for (let i = 0; i < turns; i++) o = rotate(o, 90);
          if (flip) o = flipHorizontal(o);
          expect(
            occupiedSides(kind, o).has(chooseLabelSide(kind, o))
          ).toBe(false);
        }
      }
    }
  });
});