import {
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import type { Edge } from "@xyflow/react";
import type { SymbolNode } from "../diagram/types";
import {
  composeLabel,
  nameOf,
  paletteItem,
  tagOf
} from "../diagram/palette";
import {
  normalizeOrientation,
  type Rotation
} from "../diagram/orientation";
import {
  LINE_TYPES,
  lineTypeFor,
  type LinePalette,
  type LineTypeId
} from "../diagram/pipes";

/** One step of the "Build a diagram" list. */
function Step({
  done,
  later,
  children
}: {
  done?: boolean;
  later?: boolean;
  children: string;
}) {
  return (
    <li className={later ? "denile-steps__later" : undefined}>
      <span
        className={`denile-steps__mark${
          done ? " denile-steps__done" : ""
        }`}>
        {done ? "✓" : "•"}
      </span>
      {children}
    </li>
  );
}

function BuildSteps({
  placed,
  tagged,
  piped
}: {
  placed: boolean;
  tagged: boolean;
  piped: boolean;
}) {
  return (
    <>
      <div className="denile-editor__heading">
        Build a diagram
      </div>
      <ol className="denile-steps">
        <Step done={placed}>Drag symbols from the palette</Step>
        <Step done={tagged}>
          Give each one a tag ID that matches the feed
        </Step>
        <Step done={piped}>
          Connect them with fuel, oxidizer or GN2 pipes
        </Step>
        <Step later>
          Save as a named version (not available yet)
        </Step>
      </ol>
    </>
  );
}

/** Edit the selected component. Remounted per component via `key`. */
function Properties({
  node,
  nodes,
  setNodes
}: {
  node: SymbolNode;
  nodes: SymbolNode[];
  setNodes: Dispatch<SetStateAction<SymbolNode[]>>;
}) {
  const [tag, setTag] = useState(tagOf(node));
  const [name, setName] = useState(nameOf(node));
  const rotation = normalizeOrientation(
    node.data.orientation
  ).rotation;

  const trimmed = tag.trim().toUpperCase();
  // Untagged components are fine; only a real tag can clash.
  const duplicate =
    trimmed !== "" &&
    nodes.some(
      (other) =>
        other.id !== node.id &&
        tagOf(other).toUpperCase() === trimmed
    );
  // An empty tag is fine while you are still setting things up.
  const error = duplicate ? "That tag is already used" : "";

  function commit(
    nextTag: string,
    nextName: string,
    confirmTag: boolean
  ) {
    setNodes((current) =>
      current.map((item) =>
        item.id === node.id
          ? {
              ...item,
              data: {
                ...item.data,
                tag: nextTag,
                name: nextName,
                label: composeLabel(nextTag, nextName),
                tagConfirmed: nextTag
                  ? confirmTag ||
                    item.data.tagConfirmed !== false
                  : false
              }
            }
          : item
      )
    );
  }

  return (
    <>
      <div className="denile-editor__heading">
        Properties · {paletteItem(node.data.kind).title}
      </div>

      <div className="denile-field">
        <label htmlFor="denile-tag">
          Tag ID (must match feed)
        </label>
        <input
          id="denile-tag"
          value={tag}
          placeholder="e.g. PV101"
          aria-invalid={error !== ""}
          onChange={(event) => {
            const value = event.target.value.toUpperCase();
            setTag(value);
            const next = value.trim();
            const taken =
              next !== "" &&
              nodes.some(
                (other) =>
                  other.id !== node.id &&
                  tagOf(other).toUpperCase() === next
              );
            if (!taken) commit(next, name, next !== "");
          }}
        />
        {error && (
          <span className="denile-field__error">{error}</span>
        )}
      </div>

      <div className="denile-field">
        <label htmlFor="denile-name">Label</label>
        <input
          id="denile-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!duplicate) {
              commit(trimmed, event.target.value, false);
            }
          }}
        />
      </div>

      <div className="denile-field">
        <label htmlFor="denile-rotation">Rotation</label>
        <select
          id="denile-rotation"
          value={rotation}
          onChange={(event) => {
            const next = Number(event.target.value) as Rotation;
            setNodes((current) =>
              current.map((item) =>
                item.id === node.id
                  ? {
                      ...item,
                      data: {
                        ...item.data,
                        orientation: {
                          ...normalizeOrientation(
                            item.data.orientation
                          ),
                          rotation: next
                        }
                      }
                    }
                  : item
              )
            );
          }}>
          {[0, 90, 180, 270].map((degrees) => (
            <option key={degrees} value={degrees}>
              {degrees}°
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

/**
 * Right column. Nothing selected: the build checklist. One component
 * selected: its properties. Line type for new pipes is always available.
 */
export function EditorPanel({
  nodes,
  setNodes,
  selected,
  addedNodes,
  addedPipes,
  lineType,
  palette,
  selectedPipes,
  onLineType
}: {
  nodes: SymbolNode[];
  setNodes: Dispatch<SetStateAction<SymbolNode[]>>;
  selected: SymbolNode[];
  addedNodes: SymbolNode[];
  addedPipes: number;
  /** New pipes use this line type. */
  lineType: LineTypeId;
  palette: LinePalette;
  /** Pipes currently selected; choosing a line type recolors them. */
  selectedPipes: Edge[];
  onLineType: (id: LineTypeId) => void;
}) {
  const single =
    selected.length === 1 ? selected[0] : undefined;
  // With pipes selected the radios show (and change) those pipes.
  const pipeTypes = new Set(
    selectedPipes.map(
      (edge) =>
        lineTypeFor(edge.style?.stroke, palette)?.id ?? "other"
    )
  );
  const shownType: string | undefined =
    selectedPipes.length === 0
      ? lineType
      : pipeTypes.size === 1
        ? [...pipeTypes][0]
        : undefined;
  return (
    <aside
      className="denile-editor__side denile-editor__side--right"
      aria-label="Properties">
      {single ? (
        <Properties
          key={single.id}
          node={single}
          nodes={nodes}
          setNodes={setNodes}
        />
      ) : (
        <BuildSteps
          placed={addedNodes.length > 0}
          tagged={
            addedNodes.length > 0 &&
            addedNodes.every(
              (node) => node.data.tagConfirmed !== false
            )
          }
          piped={addedPipes > 0}
        />
      )}

      {/* Only needed once something is selected. */}
      {selected.length === 0 &&
      selectedPipes.length === 0 ? null : (
        <>
          {!single && <div className="denile-editor__spacer" />}
          <fieldset
            style={{ margin: 0, padding: 0, border: 0 }}
            aria-label="Line type for new pipes">
            <div className="denile-editor__heading">
              {selectedPipes.length > 0
                ? `Line type · ${selectedPipes.length} selected`
                : "Line type"}
            </div>
            {LINE_TYPES.map((line) => (
              <label key={line.id} className="denile-radio">
                <input
                  type="radio"
                  name="denile-line-type"
                  checked={shownType === line.id}
                  onChange={() => onLineType(line.id)}
                />
                <span
                  className="denile-palette__swatch"
                  style={{ borderColor: palette[line.id] }}
                />
                {line.label}
              </label>
            ))}
          </fieldset>
        </>
      )}
    </aside>
  );
}
