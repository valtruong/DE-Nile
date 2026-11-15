import type { Diagram } from "@de-nile/pid-viewer";

// Storyboard 3.3: download a saved diagram as JSON (to import
// again), a PNG image, or a PDF for test procedures. The image
// formats are drawn from a light-mode copy of the diagram, with
// a title and an optional line legend added around it.

export type ExportFormat = "pdf" | "png" | "json";

/** Known pipe colors and what they carry. */
const LINE_NAMES: Record<string, string> = {
  "#c44900": "Fuel",
  "#00a9d6": "Oxidizer",
  "#667085": "GN2 / pressurant"
};

/** "Config B — v4" → "config-b-v4" */
export function exportFileName(
  name: string,
  version: number,
  format: ExportFormat
): string {
  const slug =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "diagram";
  return `${slug}-v${version}.${format}`;
}

/** The line types used in a diagram, for the legend. */
export function legendEntries(
  diagram: Diagram
): { color: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const connection of diagram.connections) {
    const color = connection.color.toLowerCase();
    if (!seen.has(color)) {
      seen.set(color, LINE_NAMES[color] ?? "Other line");
    }
  }
  return [...seen].map(([color, name]) => ({ color, name }));
}

/** The JSON file: the shared P&ID format, ready to import again. */
export function diagramJson(diagram: Diagram): string {
  return JSON.stringify(diagram, null, 2) + "\n";
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Couldn't draw the diagram."));
    img.src = src;
  });
}

/**
 * Put the diagram picture on a white page with a title line and,
 * optionally, a legend of the line types. Returns a PNG data URL
 * and its size in pixels.
 */
export async function composePage(
  diagramPng: string,
  options: {
    title: string;
    subtitle: string;
    legend: { color: string; name: string }[] | null;
  }
): Promise<ExportPage> {
  const picture = await loadImage(diagramPng);
  const scale = picture.width / 1600; // pixel ratio of the capture
  const pad = 48 * scale;
  const header = 84 * scale;
  const footer = options.legend?.length ? 64 * scale : 0;

  const canvas = document.createElement("canvas");
  canvas.width = picture.width + pad * 2;
  canvas.height = picture.height + header + footer + pad;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("This browser can't create images.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const font =
    "system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#111827";
  ctx.font = `700 ${28 * scale}px ${font}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(options.title, pad, pad + 4 * scale);
  ctx.fillStyle = "#4b5563";
  ctx.font = `${16 * scale}px ${font}`;
  ctx.fillText(options.subtitle, pad, pad + 32 * scale);

  ctx.drawImage(picture, pad, header);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(pad, header, picture.width, picture.height);

  if (options.legend?.length) {
    let x = pad;
    const y = header + picture.height + 40 * scale;
    ctx.font = `${16 * scale}px ${font}`;
    for (const entry of options.legend) {
      ctx.strokeStyle = entry.color;
      ctx.lineWidth = 4 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y - 6 * scale);
      ctx.lineTo(x + 36 * scale, y - 6 * scale);
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.fillText(entry.name, x + 46 * scale, y);
      x +=
        (60 + ctx.measureText(entry.name).width / scale) *
        scale;
    }
  }

  return {
    dataUrl: canvas.toDataURL("image/png"),
    // Smaller copy for the PDF; a white page compresses well.
    jpegDataUrl: canvas.toDataURL("image/jpeg", 0.92),
    width: canvas.width,
    height: canvas.height
  };
}

export type ExportPage = {
  dataUrl: string;
  jpegDataUrl: string;
  width: number;
  height: number;
};

export async function dataUrlToBlob(
  dataUrl: string
): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** A letter-size landscape PDF with the page image fitted in. */
export async function pageToPdf(
  page: ExportPage,
  title: string
): Promise<Blob> {
  // Loaded only when someone exports a PDF.
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter"
  });
  pdf.setProperties({ title, creator: "DE-Nile" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const fit = Math.min(
    (pageW - margin * 2) / page.width,
    (pageH - margin * 2) / page.height
  );
  const w = page.width * fit;
  const h = page.height * fit;
  pdf.addImage(
    page.jpegDataUrl,
    "JPEG",
    (pageW - w) / 2,
    (pageH - h) / 2,
    w,
    h
  );
  return pdf.output("blob");
}
