import {
  useMemo,
  useRef,
  useState,
  type DragEvent
} from "react";
import { useAuth } from "../auth/AuthContext";
import { canEdit } from "../auth/roles";
import { DiagramView } from "../components/DiagramView";
import { createDiagram } from "../diagram/diagramApi";
import { diagramToCanvas } from "../diagram/diagramFormat";
import {
  ImportError,
  KIND_NAMES,
  MAX_IMPORT_BYTES,
  buildImportedDiagram,
  needsAttention,
  noFixes,
  previewDiagram,
  readImportFile,
  resolveRows,
  type ImportDraft,
  type ImportFixes,
  type Kind,
  type ResolvedRow
} from "../diagram/importDiagram";
import "./ImportPage.css";

// Issue #32 / storyboard 3.1–3.2: import an existing P&ID file.
// Step 1 picks a DE-Nile .json file; step 2 shows what was
// recognized, lets the editor pick a type or add a tag where
// needed, previews it, and saves it as a new diagram.

const SHOWN_MATCHED = 3;

function errorText(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Try again.";
}

export function ImportPage({
  onCancel,
  onImported
}: {
  onCancel: () => void;
  onImported: (id: string) => void;
}) {
  const { role } = useAuth();
  const [file, setFile] = useState<{
    name: string;
    draft: ImportDraft;
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(
    null
  );
  const [reviewing, setReviewing] = useState(false);

  if (!(role !== null && canEdit(role))) {
    return (
      <main className="import import-message">
        <h1>Only editors can import diagrams</h1>
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}>
          Back to diagrams
        </button>
      </main>
    );
  }

  async function handleFile(picked: File | undefined) {
    if (!picked) return;
    setFile(null);
    setFileError(null);
    if (picked.size > MAX_IMPORT_BYTES) {
      setFileError(
        "This file is over 1 MB, which is too big for a diagram."
      );
      return;
    }
    try {
      const draft = readImportFile(
        await picked.text(),
        picked.name
      );
      setFile({ name: picked.name, draft });
    } catch (err) {
      setFileError(
        err instanceof ImportError
          ? err.message
          : "Couldn't read this file."
      );
    }
  }

  if (reviewing && file) {
    return (
      <ReviewStep
        fileName={file.name}
        draft={file.draft}
        onBack={() => setReviewing(false)}
        onImported={onImported}
      />
    );
  }

  return (
    <main className="import">
      <button
        type="button"
        className="import-back"
        onClick={onCancel}>
        ← Diagrams
      </button>
      <h1 className="import-title">
        Import an existing P&amp;ID
      </h1>
      <DropZone onFile={(f) => void handleFile(f)} />

      {fileError && (
        <p
          className="import-file import-file-error"
          role="alert">
          {fileError}
        </p>
      )}
      {file && (
        <div className="import-file" role="status">
          <span className="import-file-name">{file.name}</span>
          <span className="import-file-ok">Uploaded ✓</span>
        </div>
      )}

      <div className="import-buttons">
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!file}
          onClick={() => setReviewing(true)}>
          Review import
        </button>
      </div>
    </main>
  );
}

function DropZone({
  onFile
}: {
  onFile: (file?: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    onFile(e.dataTransfer.files[0]);
  }

  return (
    <div
      className={
        over ? "import-drop import-drop-over" : "import-drop"
      }
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}>
      <svg
        className="import-drop-icon"
        viewBox="0 0 24 24"
        aria-hidden="true">
        <path
          d="M12 16V4m0 0-5 5m5-5 5 5M5 20h14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="import-drop-title">
        Drop a file here or{" "}
        <button
          type="button"
          className="import-browse"
          onClick={() => input.current?.click()}>
          browse
        </button>
      </p>
      <p className="import-drop-hint">
        Format: DE-Nile diagram .json (P&amp;ID configuration
        v1)
      </p>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="visually-hidden"
        aria-label="Choose a diagram file"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ReviewStep({
  fileName,
  draft,
  onBack,
  onImported
}: {
  fileName: string;
  draft: ImportDraft;
  onBack: () => void;
  onImported: (id: string) => void;
}) {
  const [fixes, setFixes] = useState<ImportFixes>(noFixes);
  const [name, setName] = useState(draft.name);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => resolveRows(draft, fixes),
    [draft, fixes]
  );
  const attention = rows.filter(needsAttention);
  const matched = rows.filter((r) => !needsAttention(r));
  const shownMatched = showAll
    ? matched
    : matched.slice(0, SHOWN_MATCHED);
  // Rows the user is fixing stay in place while they type,
  // instead of jumping into "matched" mid-word.
  const fixedKeys = new Set([
    ...Object.keys(fixes.kinds),
    ...Object.keys(fixes.tags)
  ]);
  const editable = rows.filter(
    (r) =>
      needsAttention(r) ||
      fixedKeys.has(String(r.key)) ||
      r.kind === null ||
      r.originalTag === null
  );
  const plain = shownMatched.filter(
    (r) => !editable.includes(r)
  );
  const hiddenCount =
    matched.filter((r) => !editable.includes(r)).length -
    plain.length;

  const preview = useMemo(() => {
    try {
      const diagram = previewDiagram(draft, fixes);
      return diagram ? diagramToCanvas(diagram) : null;
    } catch {
      return null;
    }
  }, [draft, fixes]);
  const previewKey = preview
    ? preview.nodes
        .map((n) => `${n.id}:${n.data.kind}`)
        .join("|")
    : "none";

  function setKind(key: number, kind: Kind | "") {
    setFixes((f) => ({
      ...f,
      kinds: { ...f.kinds, [key]: kind || undefined }
    }));
  }
  function setTag(key: number, tag: string) {
    setFixes((f) => ({
      ...f,
      tags: { ...f.tags, [key]: tag }
    }));
  }

  async function handleImport() {
    setError(null);
    setSaving(true);
    try {
      const diagram = buildImportedDiagram(draft, fixes, name);
      const saved = await createDiagram(
        name.trim() || draft.name,
        diagram,
        false
      );
      onImported(saved.id);
    } catch (err) {
      setSaving(false);
      setError(errorText(err));
    }
  }

  return (
    <main className="import import-review">
      <section className="import-review-left">
        <h1 className="import-title">Review {fileName}</h1>
        <p className="import-summary">
          <span className="import-ok">
            {matched.length} recognized
          </span>
          {attention.length > 0 && (
            <>
              {" · "}
              <span className="import-warn">
                {attention.length} need attention
              </span>
            </>
          )}
        </p>

        <label className="modal-label" htmlFor="import-name">
          Diagram name
        </label>
        <input
          id="import-name"
          className="modal-input"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="import-table-card">
          <table className="import-table">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {editable.map((row) => (
                <EditableRow
                  key={row.key}
                  row={row}
                  onKind={(k) => setKind(row.key, k)}
                  onTag={(t) => setTag(row.key, t)}
                />
              ))}
              {plain.map((row) => (
                <tr key={row.key}>
                  <td className="import-mono">{row.tag}</td>
                  <td>{KIND_NAMES[row.finalKind!]}</td>
                  <td className="import-ok">✓ Matched</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hiddenCount > 0 && (
            <button
              type="button"
              className="import-more"
              onClick={() => setShowAll(true)}>
              + {hiddenCount} more matched
            </button>
          )}
        </div>

        {draft.notes.length > 0 && (
          <ul className="import-notes">
            {draft.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        {error && (
          <p className="modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="import-buttons">
          <button
            type="button"
            className="btn-secondary"
            onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={attention.length > 0 || saving}
            onClick={() => void handleImport()}>
            {saving ? "Importing…" : "Import as new diagram"}
          </button>
        </div>
      </section>

      <section className="import-review-right">
        <h2 className="import-preview-label">Preview</h2>
        <div className="import-preview">
          {preview ? (
            <DiagramView
              key={previewKey}
              editable={false}
              embedded
              diagram={preview}
              minimap={false}
            />
          ) : (
            <p className="import-preview-empty">
              Nothing to preview yet.
            </p>
          )}
        </div>
        <p className="import-preview-note">
          {attention.length > 0
            ? "Components that still need attention aren't shown. Import won't finish until every component has a known type and a tag."
            : "Imports as a new draft. Open it to check the layout, then save it or make it active."}
        </p>
      </section>
    </main>
  );
}

function EditableRow({
  row,
  onKind,
  onTag
}: {
  row: ResolvedRow;
  onKind: (kind: Kind | "") => void;
  onTag: (tag: string) => void;
}) {
  const tagEditable = row.originalTag === null;
  const kindEditable = row.kind === null;
  const issue = row.kindIssue ? "Pick a type" : row.tagIssue;
  return (
    <tr className={issue ? "import-row-warn" : undefined}>
      <td>
        {tagEditable ? (
          <>
            <label
              className="import-cell-label"
              htmlFor={`tag-${row.key}`}>
              {row.duplicateTag
                ? "Repeated tag"
                : "Missing tag"}
            </label>
            <input
              id={`tag-${row.key}`}
              className="import-input"
              placeholder="e.g. CV102"
              value={row.tag}
              onChange={(e) => onTag(e.target.value)}
            />
          </>
        ) : (
          <span className="import-mono">{row.tag}</span>
        )}
      </td>
      <td>
        {kindEditable ? (
          <>
            <label
              className="import-cell-label"
              htmlFor={`kind-${row.key}`}>
              Unknown symbol
              {row.originalKind ? ` "${row.originalKind}"` : ""}
            </label>
            <select
              id={`kind-${row.key}`}
              className="import-input"
              value={row.finalKind ?? ""}
              onChange={(e) =>
                onKind(e.target.value as Kind | "")
              }>
              <option value="">Choose a type…</option>
              {(Object.keys(KIND_NAMES) as Kind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_NAMES[k]}
                </option>
              ))}
            </select>
          </>
        ) : (
          KIND_NAMES[row.finalKind!]
        )}
      </td>
      <td className={issue ? "import-warn" : "import-ok"}>
        {issue ? `⚠ ${issue}` : "✓ Fixed"}
      </td>
    </tr>
  );
}
