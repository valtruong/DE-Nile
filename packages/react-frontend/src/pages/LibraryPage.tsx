import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { canEdit } from "../auth/roles";
import { ExportDialog } from "../components/ExportDialog";
import { Modal } from "../components/Modal";
import {
  activateDiagram,
  deactivateDiagram,
  deleteDiagram,
  listDiagrams,
  type DiagramSummary
} from "../diagram/diagramApi";
import "./LibraryPage.css";

// Issue #51 / storyboard 1.2 and 2.1: every saved diagram in one
// place. Editors open any diagram to edit it, start new ones,
// choose which one is live, and delete old drafts. Operators
// (and "Continue as viewer" guests) can only open the diagram an
// editor marked active. The server enforces the same rules.

function errorText(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Try again.";
}

function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(
    0,
    Math.round((now - Date.parse(iso)) / 1000)
  );
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function LibraryPage({
  onOpen,
  onNew,
  onImport
}: {
  onOpen: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
}) {
  const { role } = useAuth();
  const editor = role !== null && canEdit(role);
  const [diagrams, setDiagrams] = useState<
    DiagramSummary[] | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(
    null
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] =
    useState<DiagramSummary | null>(null);
  const [stopping, setStopping] =
    useState<DiagramSummary | null>(null);
  const [exporting, setExporting] = useState<string | null>(
    null
  );

  const load = useCallback(
    () =>
      listDiagrams().then(
        (list) => {
          setDiagrams(list);
          setLoadError(null);
        },
        (err) => setLoadError(errorText(err))
      ),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function handleActivate(diagram: DiagramSummary) {
    setNotice(null);
    try {
      await activateDiagram(diagram.id);
      setNotice(`${diagram.name} is now the live diagram.`);
      await load();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  if (loadError) {
    return (
      <main className="library">
        <div className="library-empty">
          <p>{loadError}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void load()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!diagrams) {
    return (
      <main className="library">
        <p className="library-empty">Loading diagrams…</p>
      </main>
    );
  }

  return editor ? (
    <main className="library">
      <div className="library-head">
        <div>
          <h1 className="library-title">Diagrams</h1>
          <p className="library-subtitle">
            Saved P&amp;ID diagrams. The active one is what
            operators see live.
          </p>
        </div>
        <div className="library-head-buttons">
          <button
            type="button"
            className="btn-secondary"
            onClick={onImport}>
            Import P&amp;ID
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onNew}>
            + New diagram
          </button>
        </div>
      </div>

      {notice && (
        <p className="library-notice" role="status">
          {notice}
        </p>
      )}

      {diagrams.length === 0 ? (
        <div className="library-card library-empty">
          <h2>No saved diagrams yet</h2>
          <p>
            Start from the team&apos;s bipropellant layout, or
            import a P&amp;ID file you already have. Saved
            diagrams show up here for the whole team.
          </p>
          <div className="library-empty-buttons">
            <button
              type="button"
              className="btn-primary"
              onClick={onNew}>
              Create your first diagram
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onImport}>
              Import a P&amp;ID file
            </button>
          </div>
        </div>
      ) : (
        <div className="library-card">
          <table className="library-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Last saved</th>
                <th scope="col">
                  <span className="visually-hidden">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {diagrams.map((d) => (
                <tr key={d.id}>
                  <td>
                    <button
                      type="button"
                      className="library-name"
                      onClick={() => onOpen(d.id)}>
                      {d.name}
                    </button>
                    <div className="library-meta">
                      {d.componentCount} components
                    </div>
                  </td>
                  <td className="library-mono">v{d.version}</td>
                  <td>
                    {d.active ? (
                      <span className="library-active">
                        Active
                      </span>
                    ) : (
                      <span className="library-draft">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="library-meta">
                    {timeAgo(d.updatedAt)}
                    {d.updatedByName &&
                      ` by ${d.updatedByName}`}
                  </td>
                  <td className="library-actions">
                    <button
                      type="button"
                      className="users-link"
                      aria-label={`Open ${d.name}`}
                      onClick={() => onOpen(d.id)}>
                      Open
                    </button>
                    <button
                      type="button"
                      className="users-link"
                      aria-label={`Export ${d.name}`}
                      onClick={() => setExporting(d.id)}>
                      Export
                    </button>
                    {d.active ? (
                      <button
                        type="button"
                        className="users-link users-link-danger"
                        aria-label={`Make ${d.name} inactive`}
                        onClick={() => {
                          setNotice(null);
                          setStopping(d);
                        }}>
                        Make inactive
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="users-link"
                          aria-label={`Make ${d.name} active`}
                          onClick={() =>
                            void handleActivate(d)
                          }>
                          Make active
                        </button>
                        <button
                          type="button"
                          className="users-link users-link-danger"
                          aria-label={`Delete ${d.name}`}
                          onClick={() => {
                            setNotice(null);
                            setDeleting(d);
                          }}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {exporting && (
        <ExportDialog
          diagramId={exporting}
          onClose={() => setExporting(null)}
        />
      )}

      {stopping && (
        <DeactivateDialog
          diagram={stopping}
          onClose={() => setStopping(null)}
          onDone={() => {
            setNotice(
              `${stopping.name} is no longer live. Operators will see "No live diagram yet" until you make a diagram active.`
            );
            setStopping(null);
            void load();
          }}
        />
      )}

      {deleting && (
        <DeleteDialog
          diagram={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setNotice(`${deleting.name} was deleted.`);
            setDeleting(null);
            void load();
          }}
        />
      )}
    </main>
  ) : (
    <OperatorPicker diagrams={diagrams} onOpen={onOpen} />
  );
}

// Storyboard 1.2: "Which test stand are you watching?"
function OperatorPicker({
  diagrams,
  onOpen
}: {
  diagrams: DiagramSummary[];
  onOpen: (id: string) => void;
}) {
  const sorted = [...diagrams].sort(
    (a, b) => Number(b.active) - Number(a.active)
  );
  return (
    <main className="library library-narrow">
      <h1 className="library-title">
        Which test stand are you watching?
      </h1>
      <p className="library-subtitle">
        Only the diagram an editor marked active can be opened
        live.
      </p>
      {!diagrams.some((d) => d.active) ? (
        <div className="library-card library-empty">
          <h2>No live diagram yet</h2>
          <p>
            An editor needs to save a diagram and mark it active
            before it can be watched here.
          </p>
        </div>
      ) : (
        <ul className="library-picker">
          {sorted.map((d) => (
            <li
              key={d.id}
              className={
                d.active
                  ? "library-pick library-pick-active"
                  : "library-pick"
              }>
              <div>
                <div className="library-pick-name">
                  {d.name}
                  {d.active && (
                    <span className="library-active">
                      Active
                    </span>
                  )}
                </div>
                <div className="library-mono library-meta">
                  v{d.version} ·{" "}
                  {d.active
                    ? `${d.componentCount} components`
                    : "not active"}
                </div>
              </div>
              {d.active ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onOpen(d.id)}>
                  Open live view
                </button>
              ) : (
                <span className="library-meta">
                  Not selectable
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

// Making the live diagram inactive leaves operators with nothing
// to watch, so it always asks first.
function DeactivateDialog({
  diagram,
  onClose,
  onDone
}: {
  diagram: DiagramSummary;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDeactivate() {
    setBusy(true);
    setError(null);
    try {
      await deactivateDiagram(diagram.id);
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Stop showing ${diagram.name} live?`}
      onClose={onClose}>
      <p className="modal-text">
        Operators watching it will see &ldquo;No live diagram
        yet&rdquo; until a diagram is made active again. The
        diagram itself stays in the library as a draft, so you
        can make it active again or delete it.
      </p>
      {error && (
        <p className="modal-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-buttons">
        <button
          type="button"
          className="btn-secondary"
          onClick={onClose}>
          Keep it live
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={busy}
          onClick={() => void handleDeactivate()}>
          {busy ? "Updating…" : "Make inactive"}
        </button>
      </div>
    </Modal>
  );
}

function DeleteDialog({
  diagram,
  onClose,
  onDeleted
}: {
  diagram: DiagramSummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteDiagram(diagram.id);
      onDeleted();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Delete ${diagram.name}?`} onClose={onClose}>
      <p className="modal-text">
        This deletes it for the whole team. It can&apos;t be
        undone.
      </p>
      {error && (
        <p className="modal-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-buttons">
        <button
          type="button"
          className="btn-secondary"
          onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={busy}
          onClick={() => void handleDelete()}>
          {busy ? "Deleting…" : "Delete diagram"}
        </button>
      </div>
    </Modal>
  );
}
