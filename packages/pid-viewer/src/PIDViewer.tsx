import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
  type NodeChange,
  useReactFlow,
  useNodesInitialized,
  useStore
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
import { useTopicReadings } from "./useTopicReadings";

type EquipmentNode = Node<
  {
    equipment: Equipment;
    reading?: Reading;
    symbol?: ReactNode;
  },
  "equipment"
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
/** Fit after React Flow has measured its panel, never on telemetry ticks. */
function ResponsiveFit({ diagram }: { diagram: Diagram }) {
  const { fitBounds, getNodesBounds, getNodes } =
    useReactFlow();
  const initialized = useNodesInitialized();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  useEffect(() => {
    if (!initialized || width <= 0 || height <= 0) return;
    // fitView queues node changes in React Flow; this controlled read-only canvas
    // instead fits measured bounds directly, without accepting any node edits.
    const frame = requestAnimationFrame(() => {
      void fitBounds(getNodesBounds(getNodes()), {
        padding: 0.2
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    diagram,
    fitBounds,
    getNodesBounds,
    getNodes,
    initialized,
    width,
    height
  ]);
  return null;
}
const nodeTypes = { equipment: PIDSymbolNode };

export interface PIDViewerProps {
  diagram: Diagram;
  dataSource?: TelemetrySource;
  className?: string;
  /** Supply the team’s existing SVG components instead of the provisional defaults. */
  renderSymbol?: (equipment: Equipment) => ReactNode;
}

/** Read-only, parent-sized canvas; changing readings never changes saved positions. */
export function PIDViewer({
  diagram: input,
  dataSource,
  className = "",
  renderSymbol
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
      type: "equipment",
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
      style: { stroke: connection.color, strokeWidth: 2 },
      selectable: false,
      deletable: false,
      reconnectable: false
    })) ?? [];
  if (!diagram)
    return (
      <div role="alert" className="denile-error">
        Invalid diagram: {parsed.error}
      </div>
    );
  return (
    <div
      className={`denile-viewer denile-theme denile-theme--light ${className}`}
      role="region"
      aria-label={diagram.name}>
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
        fitView
        minZoom={0.1}>
        <ResponsiveFit diagram={diagram} />
        <Background />
        <Controls showInteractive={false} />
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
  );
}
