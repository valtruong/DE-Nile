import {
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
      <span style={{ color: display.color }}>
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
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  useEffect(() => {
    if (initialized && width > 0 && height > 0)
      void fitView({ padding: 0.2 });
  }, [diagram, fitView, initialized, width, height]);
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
  const [snapshot, setSnapshot] = useState<{
    diagram?: Diagram;
    source?: TelemetrySource;
    readings: Record<string, Reading>;
  }>({ readings: {} });
  useEffect(() => {
    if (!diagram || !dataSource) return;
    let active = true;
    const topics = new Set(
      diagram.equipment.flatMap((item) =>
        item.binding ? [item.binding.topic] : []
      )
    );
    const unsubscribers = [...topics].map((topic) =>
      dataSource.subscribe(topic, (reading) => {
        if (!active) return;
        setSnapshot((previous) => ({
          diagram,
          source: dataSource,
          readings: {
            ...(previous.diagram === diagram &&
            previous.source === dataSource
              ? previous.readings
              : {}),
            [topic]: reading
          }
        }));
      })
    );
    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [diagram, dataSource]);
  const readings =
    snapshot.diagram === diagram &&
    snapshot.source === dataSource
      ? snapshot.readings
      : {};
  const nodes: EquipmentNode[] =
    diagram?.equipment.map((equipment) => ({
      id: equipment.id,
      type: "equipment",
      position: { ...equipment.position },
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
      className={`denile-viewer ${className}`}
      role="region"
      aria-label={diagram.name}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
