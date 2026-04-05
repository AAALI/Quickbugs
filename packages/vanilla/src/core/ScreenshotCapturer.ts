import html2canvas from "html2canvas-pro";

const BUG_REPORTER_UI_ATTR = "data-bug-reporter-ui";
const COLOR_PATTERN = /\b(?:lab|lch|oklab|oklch|color)\([^)]*\)/gi;
const COLOR_FALLBACK = "rgb(17, 24, 39)";

export type CaptureRegion = { x: number; y: number; width: number; height: number };
export type ScreenshotPrivacyOptions = { maskSelectors?: string[]; blockSelectors?: string[] };

function applyPrivacy(doc: Document, p: ScreenshotPrivacyOptions): void {
  if (p.maskSelectors) for (const s of p.maskSelectors) for (const el of doc.querySelectorAll<HTMLElement>(s)) el.style.setProperty("filter", "blur(8px)", "important");
  if (p.blockSelectors) for (const s of p.blockSelectors) for (const el of doc.querySelectorAll<HTMLElement>(s)) { el.style.setProperty("background", "#808080", "important"); el.style.setProperty("color", "transparent", "important"); el.innerHTML = ""; }
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png", 1));
  if (!blob) throw new Error("Failed to generate screenshot image.");
  return blob;
}

export class ScreenshotCapturer {
  private privacy: ScreenshotPrivacyOptions;
  constructor(privacy: ScreenshotPrivacyOptions = {}) { this.privacy = privacy; }

  async capture(): Promise<Blob> {
    if (typeof window === "undefined") throw new Error("Screenshot capture is not available.");
    const target = document.documentElement;
    const vw = Math.max(1, window.innerWidth); const vh = Math.max(1, window.innerHeight);
    const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    const bg = window.getComputedStyle(document.body).backgroundColor;
    const backgroundColor = bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "#ffffff";
    const sx = window.scrollX; const sy = window.scrollY;
    window.scrollTo(0, 0);

    const htmlEl = document.documentElement; const bodyEl = document.body;
    const oh = [htmlEl.style.height, htmlEl.style.overflow, bodyEl.style.height, bodyEl.style.overflow];
    htmlEl.style.setProperty("height", "auto", "important"); htmlEl.style.setProperty("overflow", "visible", "important");
    bodyEl.style.setProperty("height", "auto", "important"); bodyEl.style.setProperty("overflow", "visible", "important");

    try {
      const attempts = [
        { foreignObjectRendering: true, sanitize: false },
        { foreignObjectRendering: false, sanitize: false },
        { foreignObjectRendering: false, sanitize: true },
      ];
      let lastErr: unknown;
      for (const a of attempts) {
        try {
          const full = await html2canvas(target, {
            backgroundColor, logging: false, useCORS: true, allowTaint: false, scale, windowWidth: vw, windowHeight: vh, scrollX: 0, scrollY: 0,
            foreignObjectRendering: a.foreignObjectRendering,
            ignoreElements: (el: Element) => el instanceof HTMLElement && el.getAttribute(BUG_REPORTER_UI_ATTR) === "true",
            onclone: (doc: Document) => {
              for (const el of [doc.documentElement, doc.body]) { if (el) { el.style.setProperty("height", "auto", "important"); el.style.setProperty("overflow", "visible", "important"); } }
              if (a.sanitize) {
                for (const s of doc.querySelectorAll("style")) { if (s.textContent) s.textContent = s.textContent.replace(COLOR_PATTERN, COLOR_FALLBACK); }
                for (const el of doc.querySelectorAll<HTMLElement>("[style]")) { const v = el.getAttribute("style"); if (v) el.setAttribute("style", v.replace(COLOR_PATTERN, COLOR_FALLBACK)); }
              }
              applyPrivacy(doc, this.privacy);
            },
          });
          const cw = Math.round(vw * scale); const ch = Math.round(vh * scale);
          const crop = document.createElement("canvas"); crop.width = cw; crop.height = ch;
          const ctx = crop.getContext("2d");
          if (!ctx) return await canvasToPng(full);
          ctx.drawImage(full, Math.round(sx * scale), Math.round(sy * scale), cw, ch, 0, 0, cw, ch);
          return await canvasToPng(crop);
        } catch (e) { lastErr = e; }
      }
      throw lastErr ?? new Error("Screenshot failed.");
    } finally {
      htmlEl.style.height = oh[0]; htmlEl.style.overflow = oh[1]; bodyEl.style.height = oh[2]; bodyEl.style.overflow = oh[3];
      window.scrollTo(sx, sy);
    }
  }

  async captureRegion(region: CaptureRegion): Promise<Blob> {
    const full = await this.capture();
    const bm = await createImageBitmap(full);
    const s = bm.width / (window.innerWidth || 1);
    const sw = Math.round(region.width * s); const sh = Math.round(region.height * s);
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, sw); canvas.height = Math.max(1, sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) { bm.close(); throw new Error("Could not create canvas."); }
    ctx.drawImage(bm, Math.round(region.x * s), Math.round(region.y * s), sw, sh, 0, 0, sw, sh);
    bm.close();
    return canvasToPng(canvas);
  }
}
