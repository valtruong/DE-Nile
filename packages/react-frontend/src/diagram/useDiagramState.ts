import { useReducer } from "react";
import {
  parseDiagram,
  type Diagram
} from "@de-nile/pid-viewer";
import {
  createDefaultDocument,
  diagramReducer,
  type DiagramMode
} from "./diagramState";

/** Own once above the canvas; library/import code can replace the document here. */
export function useDiagramState(
  initialDiagram?: Diagram,
  initialMode: DiagramMode = "edit"
) {
  const [state, dispatch] = useReducer(
    diagramReducer,
    undefined,
    () => ({
      diagram: parseDiagram(
        initialDiagram ?? createDefaultDocument()
      ),
      mode: initialMode
    })
  );
  return { ...state, dispatch };
}

export type DiagramController = ReturnType<
  typeof useDiagramState
>;
