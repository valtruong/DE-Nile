import { useState } from "react";
import { EquipmentSymbol } from "@de-nile/pid-viewer";
import { equipmentKinds } from "../diagram/equipmentKinds";
import { PALETTE } from "../diagram/palette";
import {
  COLOR_PRESETS,
  LINE_TYPES,
  presetFor,
  sameColor,
  type LinePalette,
  type LineTypeId
} from "../diagram/pipes";
import type { SymbolKind } from "../diagram/types";

// An invisible drag image, so the browser doesn't drag a copy of the palette
// button over the preview that the canvas draws itself.
const blankDragImage =
  typeof Image === "undefined" ? undefined : new Image();
if (blankDragImage) {
  blankDragImage.src =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
}

/** MIME type for a symbol dragged from the palette. */
export const PALETTE_DRAG_TYPE = "application/x-denile-symbol";

/**
 * Left column: drag a symbol onto the canvas. Enter or Space adds it at the
 * centre of the canvas for anyone not using a mouse.
 */
export function EditorPalette({
  draggingKind,
  onDragStart,
  onDragEnd,
  onAdd,
  palette,
  onPalette
}: {
  draggingKind: SymbolKind | null;
  onDragStart: (kind: SymbolKind) => void;
  onDragEnd: () => void;
  onAdd: (kind: SymbolKind) => void;
  /** Colour of each line type. */
  palette: LinePalette;
  onPalette: (palette: LinePalette) => void;
}) {
  const preset = presetFor(palette);
  const [clash, setClash] = useState("");

  function setColor(id: LineTypeId, color: string) {
    const other = LINE_TYPES.find(
      (type) =>
        type.id !== id && sameColor(palette[type.id], color)
    );
    // Two types in one colour could not be told apart again.
    if (other) {
      setClash(`Already used by ${other.label}`);
      return;
    }
    setClash("");
    onPalette({ ...palette, [id]: color });
  }
  return (
    <aside
      className="denile-editor__side denile-editor__side--left"
      aria-label="Palette">
      <div className="denile-editor__heading">
        Palette · drag onto canvas
      </div>
      {PALETTE.map((item) => (
        <button
          key={item.kind}
          type="button"
          draggable
          className={`denile-palette__item${
            draggingKind === item.kind
              ? " denile-palette__item--dragging"
              : ""
          }`}
          onDragStart={(event) => {
            event.dataTransfer.setData(
              PALETTE_DRAG_TYPE,
              item.kind
            );
            event.dataTransfer.effectAllowed = "copy";
            if (blankDragImage)
              event.dataTransfer.setDragImage(
                blankDragImage,
                0,
                0
              );
            onDragStart(item.kind);
          }}
          onDragEnd={onDragEnd}
          onClick={() => onAdd(item.kind)}>
          <span className="denile-palette__icon">
            <EquipmentSymbol
              kind={equipmentKinds[item.kind]}
              size={32}
            />
          </span>
          {item.title}
        </button>
      ))}

      <div className="denile-editor__heading">Lines</div>
      {LINE_TYPES.map((line) => (
        <label key={line.id} className="denile-palette__line">
          <input
            type="color"
            className="denile-palette__color"
            value={palette[line.id].toLowerCase()}
            aria-label={`${line.label} line color`}
            onChange={(event) =>
              setColor(line.id, event.target.value)
            }
          />
          {line.label}
        </label>
      ))}
      <label className="denile-palette__scheme">
        <span>Color scheme</span>
        <select
          value={preset?.id ?? "custom"}
          onChange={(event) => {
            const chosen = COLOR_PRESETS.find(
              (item) => item.id === event.target.value
            );
            if (chosen) {
              setClash("");
              onPalette({ ...chosen.colors });
            }
          }}>
          {COLOR_PRESETS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
          {!preset && (
            <option value="custom" disabled>
              Custom
            </option>
          )}
        </select>
      </label>
      {clash && (
        <span className="denile-field__error">{clash}</span>
      )}
    </aside>
  );
}
