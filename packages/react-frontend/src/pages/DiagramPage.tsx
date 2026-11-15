import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";
import { AuthError } from "../auth/authApi";
import { useAuth } from "../auth/AuthContext";
import { canEdit } from "../auth/roles";
import { DiagramView } from "../components/DiagramView";
import { ExportDialog } from "../components/ExportDialog";
import { Modal } from "../components/Modal";
import {
  createDiagram,
  getDiagram,
  updateDiagram
} from "../diagram/diagramApi";
import {
  canvasFingerprint,
  canvasToDiagram,
  diagramToCanvas,
  type Canvas
} from "../diagram/diagramFormat";
import { createStarterCanvas } from "../diagram/starterDiagram";
import "./DiagramPage.css";

// Issue #11 (display a saved diagram) and #17 (save edits).
// Opens one diagram from the library. Editors can move, connect
// and delete symbols, then save a new version or save a copy.
// Everyone else sees it read-only.

type Meta = {
  id: string | null; // null until a new diagram is first saved
  name: string;
  version: number;
  active: boolean;
};

type SaveMode = "save" | "copy";

function errorText(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Try again.";
}

export function DiagramPage({
  diagramId,
  onBack
}: {
  /** A saved diagram's ID, or "new" for the starter layout. */
  diagramId: string;
  onBack: () => void;
}) {
  const { role } = useAuth();
  const editor = role !== null && canEdit(role);

  const [loaded, setLoaded] = useState<{
    canvas: Canvas;
    meta: Meta;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(
    null
  );
  // Bumped to show a freshly loaded diagram in a new canvas.
  const [canvasKey, setCanvasKey] = useState(0);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [savedPrint, setSavedPrint] = useState<string | null>(
    null
  );
  const [currentPrint, setCurrentPrint] = useState<
    string | null
  >(null);
  const current = useRef<Canvas | null>(null);
  // The layout being saved is captured when the dialog opens.
  const [saving, setSaving] = useState<{
    mode: SaveMode;
    canvas: Canvas;
  } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Fetches the diagram; returns an error message instead of
  // throwing so the effect below sets state in one place.
  const load = useCallback(async (): Promise<
    { canvas: Canvas; meta: Meta } | { error: string }
  > => {
    try {
      if (diagramId === "new") {
        return {
          canvas: createStarterCanvas(),
          meta: {
            id: null,
            name: "Untitled diagram",
            version: 0,
            active: false
          }
        };
      }
      const saved = await getDiagram(diagramId);
      return {
        canvas: diagramToCanvas(saved.diagram),
        meta: {
          id: saved.id,
          name: saved.name,
          version: saved.version,
          active: saved.active
        }
      };
    } catch (err) {
      return {
        error:
          err instanceof AuthError
            ? err.message
            : "This diagram couldn't be read. It may have been saved in an older or broken format."
      };
    }
  }, [diagramId]);

  const show = useCallback(
    (
      result: { canvas: Canvas; meta: Meta } | { error: string }
    ) => {
      if ("error" in result) {
        setLoadError(result.error);
        return;
      }
      setLoaded(result);
      setMeta(result.meta);
      const print = canvasFingerprint(result.canvas);
      setSavedPrint(result.meta.id ? print : null);
      setCurrentPrint(print);
      current.current = result.canvas;
      setCanvasKey((k) => k + 1);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void load().then((result) => {
      if (!cancelled) show(result);
    });
    return () => {
      cancelled = true;
    };
  }, [load, show]);

  const handleChange = useCallback((canvas: Canvas) => {
    current.current = canvas;
    setCurrentPrint(canvasFingerprint(canvas));
  }, []);

  // New diagrams count as unsaved until their first save.
  const dirty =
    editor &&
    meta !== null &&
    (meta.id === null || currentPrint !== savedPrint);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () =>
      window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function openSave(mode: SaveMode) {
    if (current.current) {
      setSaving({ mode, canvas: current.current });
    }
  }

  function handleSaved(next: Meta, mode: SaveMode) {
    setMeta(next);
    setSavedPrint(currentPrint);
    setSaving(null);
    setNotice(
      mode === "copy"
        ? `Saved as a new diagram: ${next.name}.`
        : `Saved ${next.name} v${next.version}${
            next.active ? " (live for operators)" : ""
          }.`
    );
    // Keep the address in sync without reloading the canvas.
    window.history.replaceState(
      null,
      "",
      `#diagram/${next.id}`
    );
  }

  if (loadError) {
    return (
      <main className="diagram-page-message">
        <h1>Can&apos;t open this diagram</h1>
        <p>{loadError}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={onBack}>
          Back to diagrams
        </button>
      </main>
    );
  }

  if (!loaded || !meta) {
    return (
      <main className="diagram-page-message">
        <p>Loading diagram…</p>
      </main>
    );
  }

  return (
    <div className="diagram-page">
      <div className="diagram-toolbar">
        <button
          type="button"
          className="diagram-back"
          onClick={() => (dirty ? setLeaving(true) : onBack())}>
          ← Diagrams
        </button>
        <div className="diagram-title">
          <h1>{meta.name}</h1>
          <span className="diagram-version">
            {meta.id ? `v${meta.version}` : "not saved yet"}
          </span>
          {meta.active && (
            <span className="library-active">Active</span>
          )}
          {dirty && meta.id && (
            <span className="diagram-unsaved" role="status">
              Unsaved changes
            </span>
          )}
        </div>
        {notice && !dirty && (
          <span className="diagram-notice" role="status">
            {notice}
          </span>
        )}
        <div className="diagram-actions">
          {editor ? (
            <>
              {meta.id && (
                <button
                  type="button"
                  className="btn-secondary"
                  title={
                    dirty
                      ? "Exports the last saved version"
                      : undefined
                  }
                  onClick={() => setExporting(true)}>
                  Export
                </button>
              )}
              {meta.id && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => openSave("copy")}>
                  Save as new
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={!dirty}
                onClick={() => openSave("save")}>
                {dirty ? "Save" : "Saved"}
              </button>
            </>
          ) : (
            <span className="diagram-readonly">
              View only · editing is disabled
            </span>
          )}
        </div>
      </div>

      <div className="diagram-canvas">
        <DiagramView
          key={canvasKey}
          editable={editor}
          embedded
          diagram={loaded.canvas}
          onChange={handleChange}
        />
      </div>

      {saving && (
        <SaveDialog
          key={saving.mode}
          mode={saving.mode}
          meta={meta}
          canvas={saving.canvas}
          onClose={() => setSaving(null)}
          onSwitchToCopy={() => openSave("copy")}
          onSaved={handleSaved}
        />
      )}

      {exporting && meta.id && (
        <ExportDialog
          diagramId={meta.id}
          onClose={() => setExporting(false)}
        />
      )}

      {leaving && (
        <Modal
          title="Leave without saving?"
          onClose={() => setLeaving(false)}>
          <p className="modal-text">
            Your changes to {meta.name} haven&apos;t been saved.
          </p>
          <div className="modal-buttons">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setLeaving(false)}>
              Keep editing
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={onBack}>
              Discard changes
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Storyboard 2.5 "Save a new version".
function SaveDialog({
  mode,
  meta,
  canvas,
  onClose,
  onSwitchToCopy,
  onSaved
}: {
  mode: SaveMode;
  meta: Meta;
  canvas: Canvas;
  onClose: () => void;
  onSwitchToCopy: () => void;
  onSaved: (meta: Meta, mode: SaveMode) => void;
}) {
  const isNew = mode === "copy" || meta.id === null;
  const [name, setName] = useState(
    mode === "copy" ? `${meta.name} (copy)` : meta.name
  );
  const [active, setActive] = useState(
    mode === "save" && meta.active
  );
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setConflict(false);

    let diagram;
    try {
      diagram = canvasToDiagram(canvas, {
        id: meta.id ?? "new",
        name: name.trim() || "Untitled"
      });
    } catch {
      setError(
        "Every pipe must connect two components, and every component needs a label. Fix the diagram and try again."
      );
      return;
    }

    setSaving(true);
    try {
      const saved = isNew
        ? await createDiagram(name, diagram, active)
        : await updateDiagram(
            meta.id!,
            name,
            diagram,
            meta.version,
            active
          );
      onSaved(
        {
          id: saved.id,
          name: saved.name,
          version: saved.version,
          active: saved.active
        },
        mode
      );
    } catch (err) {
      setSaving(false);
      setError(errorText(err));
      setConflict(
        err instanceof AuthError &&
          err.code === "VERSION_CONFLICT"
      );
    }
  }

  const title =
    mode === "copy"
      ? "Save as a new diagram"
      : meta.id
        ? "Save a new version"
        : "Save diagram";

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className="modal-label" htmlFor="diagram-name">
          Diagram name
        </label>
        <input
          id="diagram-name"
          className="modal-input"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {!isNew && meta.active ? (
          <p className="modal-note">
            This is the live diagram, so saving updates what
            operators see. To stop showing it, use{" "}
            <strong>Make inactive</strong> in the library.
          </p>
        ) : (
          <label className="diagram-check">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Make this the active diagram for operators
          </label>
        )}
        <p className="modal-note">
          {isNew
            ? "Saves a separate diagram in the library; the one you opened stays as it was."
            : `Saves as v${meta.version + 1} for the whole team.`}
        </p>
        {error && (
          <div className="modal-error" role="alert">
            {error}
            {conflict && (
              <>
                {" "}
                <button
                  type="button"
                  className="users-link"
                  onClick={onSwitchToCopy}>
                  Save yours as a new diagram instead
                </button>
              </>
            )}
          </div>
        )}
        <div className="modal-buttons">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}>
            Back to editing
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}>
            {saving
              ? "Saving…"
              : isNew
                ? "Save diagram"
                : `Save as v${meta.version + 1}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
