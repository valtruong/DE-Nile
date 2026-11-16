import { toPng } from "html-to-image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  getDiagram,
  type SavedDiagram
} from "../diagram/diagramApi";
import { diagramToCanvas } from "../diagram/diagramFormat";
import {
  composePage,
  dataUrlToBlob,
  diagramJson,
  downloadBlob,
  exportFileName,
  legendEntries,
  pageToPdf,
  type ExportFormat,
  type ExportPage
} from "../diagram/exportDiagram";
import { DiagramView } from "./DiagramView";
import { Modal } from "./Modal";
import "./ExportDialog.css";

// Storyboard 3.3 "Export". Downloads the saved version of a
// diagram. For PDF and PNG, a light-mode copy is drawn off
// screen, captured, and placed on a page with a title and an
// optional legend; the preview shows exactly what you'll get.

const CAPTURE_W = 1600;
const CAPTURE_H = 1000;

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "pdf", label: "PDF — for test procedures" },
  { value: "png", label: "PNG image" },
  { value: "json", label: "JSON — re-import into DE-Nile" }
];

function errorText(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Try again.";
}

// Parts of the canvas that don't belong in a printed drawing.
function keepInImage(node: HTMLElement): boolean {
  if (!(node instanceof Element)) return true;
  if (node.hasAttribute("data-export-hide")) return false;
  const hidden = [
    "react-flow__controls",
    "react-flow__minimap",
    "react-flow__background",
    "react-flow__attribution",
    "react-flow__handle"
  ];
  return !hidden.some((name) => node.classList.contains(name));
}

export function ExportDialog({
  diagramId,
  onClose
}: {
  diagramId: string;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState<SavedDiagram | null>(null);
  const [loadError, setLoadError] = useState<string | null>(
    null
  );
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [legend, setLegend] = useState(true);
  const [labels, setLabels] = useState(true);
  const [preview, setPreview] = useState<ExportPage | null>(
    null
  );
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDiagram(diagramId).then(setSaved, (err) =>
      setLoadError(errorText(err))
    );
  }, [diagramId]);

  // What gets drawn: no live-reading placeholders, and no labels
  // if the user turned them off.
  const drawing = useMemo(() => {
    if (!saved) return null;
    const canvas = diagramToCanvas(saved.diagram);
    canvas.nodes = canvas.nodes.map((node) => ({
      ...node,
      data: {
        kind: node.data.kind,
        label: labels ? node.data.label : ""
      }
    }));
    return canvas;
  }, [saved, labels]);

  const imageFormat = format !== "json";

  const render = useCallback(async () => {
    if (!saved || !stage.current) return null;
    const picture = await toPng(stage.current, {
      width: CAPTURE_W,
      height: CAPTURE_H,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      filter: keepInImage
    });
    return composePage(picture, {
      title: saved.name,
      subtitle: `Version ${saved.version} · ${saved.diagram.equipment.length} components · exported ${new Date().toLocaleDateString()} from DE-Nile`,
      legend: legend ? legendEntries(saved.diagram) : null
    });
  }, [saved, legend]);

  // Redraw the preview when the options change, after the off-
  // screen canvas has laid itself out.
  useEffect(() => {
    if (!drawing || !imageFormat) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setRendering(true);
      render()
        .then((page) => {
          if (!cancelled && page) setPreview(page);
        })
        .catch((err) => {
          if (!cancelled) setError(errorText(err));
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [drawing, imageFormat, render]);

  async function handleExport() {
    if (!saved) return;
    setError(null);
    setBusy(true);
    try {
      const fileName = exportFileName(
        saved.name,
        saved.version,
        format
      );
      if (format === "json") {
        downloadBlob(
          new Blob([diagramJson(saved.diagram)], {
            type: "application/json"
          }),
          fileName
        );
      } else {
        const page = preview ?? (await render());
        if (!page)
          throw new Error("The diagram isn't ready yet.");
        const blob =
          format === "pdf"
            ? await pageToPdf(page, saved.name)
            : await dataUrlToBlob(page.dataUrl);
        downloadBlob(blob, fileName);
      }
      onClose();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const title = saved
    ? `Export ${saved.name} v${saved.version}`
    : "Export diagram";

  return (
    <Modal title={title} onClose={onClose} wide>
      {loadError ? (
        <>
          <p className="modal-error" role="alert">
            {loadError}
          </p>
          <div className="modal-buttons">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}>
              Close
            </button>
          </div>
        </>
      ) : (
        <div className="export-layout">
          <div className="export-form">
            <fieldset className="export-fieldset">
              <legend>Format</legend>
              {FORMATS.map((f) => (
                <label key={f.value} className="export-option">
                  <input
                    type="radio"
                    name="export-format"
                    value={f.value}
                    checked={format === f.value}
                    onChange={() => setFormat(f.value)}
                  />
                  {f.label}
                </label>
              ))}
            </fieldset>

            {imageFormat && (
              <>
                <label className="export-option">
                  <input
                    type="checkbox"
                    checked={legend}
                    onChange={(e) =>
                      setLegend(e.target.checked)
                    }
                  />
                  Include legend
                </label>
                <label className="export-option">
                  <input
                    type="checkbox"
                    checked={labels}
                    onChange={(e) =>
                      setLabels(e.target.checked)
                    }
                  />
                  Include tag IDs and labels
                </label>
              </>
            )}
            <p className="modal-note">
              {format === "json"
                ? "The shared P&ID format. Import it again with Diagrams → Import P&ID."
                : "Exports the last saved version. Live readings aren't included."}
            </p>

            {error && (
              <p className="modal-error" role="alert">
                {error}
              </p>
            )}

            <div className="modal-buttons export-buttons">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  !saved || busy || (imageFormat && !preview)
                }
                onClick={() => void handleExport()}>
                {busy
                  ? "Exporting…"
                  : `Export ${format.toUpperCase()}`}
              </button>
            </div>
          </div>

          <div className="export-preview-col">
            <p className="export-preview-label">
              Preview
              {imageFormat && format === "pdf"
                ? " · Letter, landscape"
                : ""}
            </p>
            <div className="export-preview">
              {format === "json" ? (
                <pre className="export-json">
                  {saved
                    ? diagramJson(saved.diagram).slice(
                        0,
                        1200
                      ) +
                      (diagramJson(saved.diagram).length > 1200
                        ? "\n…"
                        : "")
                    : "Loading…"}
                </pre>
              ) : preview ? (
                <img
                  src={preview.dataUrl}
                  alt={`Preview of ${saved?.name ?? "the diagram"}`}
                  className={
                    rendering ? "export-stale" : undefined
                  }
                />
              ) : (
                <p className="export-wait">Drawing preview…</p>
              )}
            </div>
            {saved && (
              <p className="export-file">
                {exportFileName(
                  saved.name,
                  saved.version,
                  format
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Off-screen copy that the image is captured from. */}
      {drawing && imageFormat && (
        <div className="export-stage" aria-hidden="true">
          <div
            ref={stage}
            style={{
              position: "relative",
              width: CAPTURE_W,
              height: CAPTURE_H
            }}>
            <DiagramView
              key={labels ? "labels" : "plain"}
              editable={false}
              embedded
              diagram={drawing}
              minimap={false}
              initialTheme="light"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
