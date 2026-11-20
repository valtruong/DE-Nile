import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
  type Ref
} from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
  type NodeChange
} from "@xyflow/react";
import {
  parseDiagram,
  type Diagram,
  type Equipment
} from "./diagram";
import {
  formatReading,
  type Reading,
  type TelemetrySource
} from "./telemetry";
import { EquipmentSymbol } from "./symbols";
import {
  DiagramSymbolNodeView,
  resolveEquipmentVisualState
} from "./DiagramSymbolNode";
import { useTopicReadings } from "./useTopicReadings";
import { DiagramLegend } from "./DiagramLegend";
import {
  ViewerViewport,
  type PIDViewerHandle
} from "./ViewerViewport";

type EquipmentNode = Node<
  {
    equipment: Equipment;
    reading?: Reading;
    symbol?: ReactNode;
  },
  "equipment" | "symbol"
>;

/** Render values as text as well as optional configured state colors. */
function PIDSymbolNode({ data }: NodeProps<EquipmentNode>) {
  const display = formatReading(
    data.equipment.binding,
    data.reading
  );
  return (
    <div className="denile-equipment">
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
      />
      <strong>{data.equipment.label}</strong>
      {data.symbol ?? (
        <EquipmentSymbol kind={data.equipment.kind} />
      )}
      <span
        className="denile-equipment-state"
        style={{ color: display.color }}>
        {display.text}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
      />
    </div>
  );
}
function SymbolLayoutNode(props: NodeProps<EquipmentNode>) {
  const { equipment, reading, symbol } = props.data;
  const state = resolveEquipmentVisualState(equipment, reading);
  return (
    <DiagramSymbolNodeView
      {...props}
      data={{
        kind: equipment.kind,
        label: equipment.label,
        binding: equipment.binding,
        reading,
        symbol,
        visualState: state
      }}
    />
  );
}
const nodeTypes = {
  equipment: PIDSymbolNode,
  symbol: SymbolLayoutNode
};

export interface PIDViewerProps {
  /** Host toolbar actions. Cleared on unmount or invalid configuration. */
  ref?: Ref<PIDViewerHandle>;
  diagram: Diagram;
  dataSource?: TelemetrySource;
  className?: string;
  theme?: "light" | "dark";
  /** Hide corner controls when the host provides its own toolbar. */
  showControls?: boolean;
  /** Fit on mount, layout changes and container resize; never on reading updates. */
  autoFit?: boolean;
  /** Use the team's original symbol geometry and named pipe ports. */
  presentation?: "cards" | "symbols";
  /** Supply the team’s existing SVG components instead of the provisional defaults. */
  renderSymbol?: (equipment: Equipment) => ReactNode;
}

/** Read-only, parent-sized canvas; changing readings never changes saved positions. */
export function PIDViewer({
  ref,
  diagram: input,
  dataSource,
  className = "",
  renderSymbol,
  presentation = "cards",
  theme = "light",
  showControls = true,
  autoFit = true
}: PIDViewerProps) {
  const parsed = useMemo(() => {
    try {
      return { diagram: parseDiagram(input), error: undefined };
    } catch (error) {
      return {
        diagram: undefined,
        error:
          error instanceof Error
            ? error.message
            : "Invalid diagram"
      };
    }
  }, [input]);
  const diagram = parsed.diagram;
  const [measurements, setMeasurements] = useState<
    Record<string, { width: number; height: number }>
  >({});
  // Controlled React Flow nodes must retain measured sizes for initialization and
  // responsive fitting. Accept dimensions only; monitoring never accepts edits.
  const onNodesChange = useCallback(
    (changes: NodeChange<EquipmentNode>[]) => {
      setMeasurements((previous) => {
        let next = previous;
        for (const change of changes) {
          if (
            change.type !== "dimensions" ||
            !change.dimensions
          )
            continue;
          const size = change.dimensions;
          if (
            previous[change.id]?.width === size.width &&
            previous[change.id]?.height === size.height
          )
            continue;
          if (next === previous) next = { ...previous };
          next[change.id] = size;
        }
        return next;
      });
    },
    []
  );
  const readings = useTopicReadings(
    dataSource,
    diagram?.equipment.flatMap((equipment) =>
      equipment.binding ? [equipment.binding.topic] : []
    ) ?? []
  );
  const nodes: EquipmentNode[] =
    diagram?.equipment.map((equipment) => ({
      id: equipment.id,
      type: presentation === "symbols" ? "symbol" : "equipment",
      position: { ...equipment.position },
      measured: measurements[equipment.id],
      data: {
        equipment,
        symbol: renderSymbol?.(equipment),
        reading: equipment.binding
          ? readings[equipment.binding.topic]
          : undefined
      },
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false
    })) ?? [];
  const edges =
    diagram?.connections.map((connection) => ({
      ...connection,
      type: "step",
      // Card nodes keep their legacy generic handles; symbols use named ports.
      sourceHandle:
        presentation === "symbols"
          ? connection.sourceHandle
          : undefined,
      targetHandle:
        presentation === "symbols"
          ? connection.targetHandle
          : undefined,
      style: {
        stroke: connection.color,
        strokeWidth: connection.strokeWidth ?? 2
      },
      selectable: false,
      deletable: false,
      reconnectable: false
    })) ?? [];
  // Equivalent JSON objects and live readings must not reset the user's viewport.
  const geometryKey = JSON.stringify([
    presentation,
    diagram?.equipment.map((item) => [
      item.id,
      item.kind,
      item.label,
      item.position,
      measurements[item.id]
    ]),
    diagram?.connections.map((connection) => [
      connection.id,
      connection.label
    ])
  ]);
  if (!diagram)
    return (
      <div role="alert" className="denile-error">
        Invalid diagram: {parsed.error}
      </div>
    );
  return (
    <div
      className={`denile-viewer denile-theme denile-theme--${theme} ${className}`}
      role="region"
      aria-label={diagram.name}>
      <div className="denile-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          colorMode={theme}
          minZoom={0.001}>
          <ViewerViewport
            viewerRef={ref}
            geometryKey={geometryKey}
            autoFit={autoFit}
            showControls={showControls}
          />
          <Background color="var(--pid-grid)" />
        </ReactFlow>
        <details className="denile-readings">
          <summary>Equipment readings</summary>
          <ul>
            {diagram.equipment.map((equipment) => (
              <li key={equipment.id}>
                <strong>{equipment.label}:</strong>{" "}
                {
                  formatReading(
                    equipment.binding,
                    equipment.binding
                      ? readings[equipment.binding.topic]
                      : undefined
                  ).text
                }
              </li>
            ))}
          </ul>
        </details>
      </div>
      <DiagramLegend
        diagram={diagram}
        presentation={presentation}
      />
    </div>
  );
}
