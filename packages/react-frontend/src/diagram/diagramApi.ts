import type { Diagram } from "@de-nile/pid-viewer";
import { apiCall } from "../auth/apiCall";

// Wrappers around the backend's /api/diagrams routes. The server
// decides who may do what: anyone can list diagrams and open the
// active one; saving, activating and deleting need editor.

export type DiagramSummary = {
  id: string;
  name: string;
  version: number;
  active: boolean;
  componentCount: number;
  updatedAt: string;
  updatedByName: string | null;
};

export type SavedDiagram = DiagramSummary & {
  diagram: Diagram;
};

export async function listDiagrams(): Promise<
  DiagramSummary[]
> {
  const body = await apiCall<{ diagrams: DiagramSummary[] }>(
    "GET",
    "/api/diagrams"
  );
  return body.diagrams;
}

export async function getDiagram(
  id: string
): Promise<SavedDiagram> {
  const body = await apiCall<{ diagram: SavedDiagram }>(
    "GET",
    `/api/diagrams/${encodeURIComponent(id)}`
  );
  return body.diagram;
}

export async function createDiagram(
  name: string,
  diagram: Diagram,
  active: boolean
): Promise<SavedDiagram> {
  const body = await apiCall<{ diagram: SavedDiagram }>(
    "POST",
    "/api/diagrams",
    { name, diagram, active }
  );
  return body.diagram;
}

/** Throws AuthError code "VERSION_CONFLICT" if someone saved since `version`. */
export async function updateDiagram(
  id: string,
  name: string,
  diagram: Diagram,
  version: number,
  active: boolean
): Promise<SavedDiagram> {
  const body = await apiCall<{ diagram: SavedDiagram }>(
    "PUT",
    `/api/diagrams/${encodeURIComponent(id)}`,
    { name, diagram, version, active }
  );
  return body.diagram;
}

export async function activateDiagram(
  id: string
): Promise<void> {
  await apiCall(
    "POST",
    `/api/diagrams/${encodeURIComponent(id)}/activate`
  );
}

export async function deleteDiagram(id: string): Promise<void> {
  await apiCall(
    "DELETE",
    `/api/diagrams/${encodeURIComponent(id)}`
  );
}
