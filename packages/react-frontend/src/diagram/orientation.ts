import { Position } from "@xyflow/react";

/** Clockwise quarter turns, applied after the symbol's own mirror. */
export type Rotation = 0 | 90 | 180 | 270;

export type Orientation = {
  rotation: Rotation;
  /** Mirror the artwork left-to-right before rotating. */
  flipX: boolean;
};

export const DEFAULT_ORIENTATION: Orientation = {
  rotation: 0,
  flipX: false
};

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

function toRotation(degrees: number): Rotation {
  const turn = ((Math.round(degrees / 90) % 4) + 4) % 4;
  return ROTATIONS[turn];
}

/** Accept missing or hand-edited data and always return a valid orientation. */
export function normalizeOrientation(
  value?: Partial<Orientation>
): Orientation {
  return {
    rotation: toRotation(Number(value?.rotation ?? 0) || 0),
    flipX: value?.flipX === true
  };
}

export function isDefaultOrientation(
  orientation: Orientation
): boolean {
  return orientation.rotation === 0 && !orientation.flipX;
}

export function rotate(
  orientation: Orientation,
  degrees: 90 | -90
): Orientation {
  return {
    ...orientation,
    rotation: toRotation(orientation.rotation + degrees)
  };
}

/**
 * Mirror left-to-right as the user sees it on screen. A screen mirror
 * after a rotation equals the opposite rotation of a mirrored symbol.
 */
export function flipHorizontal(
  orientation: Orientation
): Orientation {
  return {
    rotation: toRotation(-orientation.rotation),
    flipX: !orientation.flipX
  };
}

/** Mirror top-to-bottom as seen on screen (a horizontal flip plus a half turn). */
export function flipVertical(
  orientation: Orientation
): Orientation {
  return rotate(rotate(flipHorizontal(orientation), 90), 90);
}

export function orientationTransform({
  rotation,
  flipX
}: Orientation): string {
  return `rotate(${rotation}deg) scaleX(${flipX ? -1 : 1})`;
}

const CLOCKWISE = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left
] as const;

/** Where a port at `position` ends up after the symbol is mirrored and rotated. */
export function orientPosition(
  position: Position,
  { rotation, flipX }: Orientation
): Position {
  let next = position;
  if (flipX) {
    if (next === Position.Left) next = Position.Right;
    else if (next === Position.Right) next = Position.Left;
  }
  const index = CLOCKWISE.indexOf(next);
  return CLOCKWISE[(index + rotation / 90) % 4];
}

/**
 * Move a point given as percentages of the symbol's square box. The
 * transform pivots on the box center, matching the CSS transform.
 */
export function orientPoint(
  point: { x: number; y: number },
  { rotation, flipX }: Orientation
): { x: number; y: number } {
  let x = (flipX ? 100 - point.x : point.x) - 50;
  let y = point.y - 50;
  for (let turn = 0; turn < rotation / 90; turn++) {
    [x, y] = [-y, x]; // 90 degrees clockwise with y pointing down
  }
  return { x: x + 50, y: y + 50 };
}