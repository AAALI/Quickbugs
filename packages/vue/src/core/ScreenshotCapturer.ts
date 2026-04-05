import html2canvas from "html2canvas-pro";

const BUG_REPORTER_UI_ATTR = "data-bug-reporter-ui";
const UNSUPPORTED_COLOR_FUNCTION_PATTERN = /\b(?:lab|lch|oklab|oklch|color)\([^)]*\)/gi;
const COLOR_FALLBACK_VALUE = "rgb(17, 24, 39)";
const DEFAULT_BACKGROUND_COLOR = "#ffffff";

type CaptureAttempt = {
  foreignObjectRendering: boolean;
  sanitizeColorFunctions: boolean;
};

/**
 * Replace modern CSS color functions with a stable RGB fallback.
 *
 * @param value - CSS text or value that may contain modern color functions like `lab()`, `lch()`, `oklab()`, `oklch()`, or `color(...)`
 * @returns The input string with any matched modern color functions replaced by the configured fallback color
 */
function replaceUnsupportedColorFunctions(value: string): string {
  return value.replace(UNSUPPORTED_COLOR_FUNCTION_PATTERN, COLOR_FALLBACK_VALUE);
}

/**
 * Ensure a cloned document's root layout is not height- or overflow-clamped so it can expand to fit content.
 *
 * Applies `height: auto !important` and `overflow: visible !important` to the cloned document's `html` and `body` elements and appends a `<style>` element with the same rules to the cloned document head. If `documentElement` or `body` are missing, those elements are skipped.
 *
 * @param clonedDoc - The cloned `Document` whose layout should be relaxed
 */
function unclampClonedLayout(clonedDoc: Document): void {
  for (const el of [clonedDoc.documentElement, clonedDoc.body]) {
    if (!el) continue;
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("overflow", "visible", "important");
  }
  const overrideStyle = clonedDoc.createElement("style");
  overrideStyle.textContent = `html, body { height: auto !important; overflow: visible !important; }`;
  clonedDoc.head.appendChild(overrideStyle);
}

/**
 * Replaces modern CSS color functions in all <style> elements and inline style attributes
 * within the provided cloned document with a fallback RGB value.
 *
 * @param clonedDocument - The cloned `Document` whose stylesheet text and inline `style` attributes will be sanitized
 */
function sanitizeCloneForModernColors(clonedDocument: Document): void {
  for (const styleElement of clonedDocument.querySelectorAll("style")) {
    if (styleElement.textContent) {
      styleElement.textContent = replaceUnsupportedColorFunctions(styleElement.textContent);
    }
  }
  for (const element of clonedDocument.querySelectorAll<HTMLElement>("[style]")) {
    const style = element.getAttribute("style");
    if (style) element.setAttribute("style", replaceUnsupportedColorFunctions(style));
  }
}

/**
 * Converts an HTMLCanvasElement into a PNG image Blob.
 *
 * @returns A PNG `Blob` (MIME type `image/png`) containing the canvas image.
 * @throws Error if the browser fails to generate the PNG blob.
 */
async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => { canvas.toBlob(resolve, "image/png", 1); });
  if (!blob) throw new Error("Failed to generate screenshot image.");
  return blob;
}

export type CaptureRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScreenshotPrivacyOptions = {
  maskSelectors?: string[];
  blockSelectors?: string[];
};

/**
 * Applies privacy transformations to elements within a cloned document based on selector lists.
 *
 * @param doc - The cloned `Document` whose elements will be modified.
 * @param privacy - Privacy options that control modifications:
 *   - `maskSelectors`: selectors whose matched elements receive `filter: blur(8px) !important`.
 *   - `blockSelectors`: selectors whose matched elements are given a gray background (`#808080 !important`), made text-transparent (`color: transparent !important`), and have their `innerHTML` cleared.
 */
function applyPrivacyToClone(doc: Document, privacy: ScreenshotPrivacyOptions): void {
  if (privacy.maskSelectors) {
    for (const selector of privacy.maskSelectors) {
      for (const el of doc.querySelectorAll<HTMLElement>(selector)) {
        el.style.setProperty("filter", "blur(8px)", "important");
      }
    }
  }
  if (privacy.blockSelectors) {
    for (const selector of privacy.blockSelectors) {
      for (const el of doc.querySelectorAll<HTMLElement>(selector)) {
        const tagName = el.tagName.toLowerCase();

        // Handle replaced elements
        if (tagName === "img") {
          el.removeAttribute("src");
          el.removeAttribute("srcset");
        } else if (tagName === "video") {
          const video = el as HTMLVideoElement;
          video.pause();
          video.removeAttribute("src");
          video.removeAttribute("poster");
          const sources = video.querySelectorAll("source");
          sources.forEach(s => s.remove());
        } else if (tagName === "audio") {
          const audio = el as HTMLAudioElement;
          audio.pause();
          audio.removeAttribute("src");
          const sources = audio.querySelectorAll("source");
          sources.forEach(s => s.remove());
        } else if (tagName === "canvas") {
          const canvas = el as HTMLCanvasElement;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else if (tagName === "input" || tagName === "textarea") {
          (el as HTMLInputElement | HTMLTextAreaElement).value = "";
        } else if (tagName === "select") {
          (el as HTMLSelectElement).selectedIndex = -1;
        }

        // Remove background images
        el.style.setProperty("background-image", "none", "important");

        // Apply blocking styles
        el.style.setProperty("background", "#808080", "important");
        el.style.setProperty("color", "transparent", "important");
        el.innerHTML = "";
      }
    }
  }
}

export class ScreenshotCapturer {
  private privacy: ScreenshotPrivacyOptions;

  constructor(privacy: ScreenshotPrivacyOptions = {}) {
    this.privacy = privacy;
  }

  async capture(): Promise<Blob> {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("Screenshot capture is not available in this environment.");
    }
    const target = document.documentElement;
    if (!target) throw new Error("Could not find a capture target for screenshot.");

    try {
      return await this.captureViaDomSnapshot(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown DOM capture error.";
      throw new Error(`Quick screenshot failed in this browser (${message}). Try video capture for this page.`);
    }
  }

  private async captureViaDomSnapshot(target: HTMLElement): Promise<Blob> {
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    const bodyBackgroundColor = window.getComputedStyle(document.body).backgroundColor;
    const backgroundColor = bodyBackgroundColor && bodyBackgroundColor !== "rgba(0, 0, 0, 0)" ? bodyBackgroundColor : DEFAULT_BACKGROUND_COLOR;

    const savedScrollX = window.scrollX;
    const savedScrollY = window.scrollY;
    window.scrollTo(0, 0);

    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const origHtmlHeight = htmlEl.style.height;
    const origHtmlOverflow = htmlEl.style.overflow;
    const origBodyHeight = bodyEl.style.height;
    const origBodyOverflow = bodyEl.style.overflow;
    htmlEl.style.setProperty("height", "auto", "important");
    htmlEl.style.setProperty("overflow", "visible", "important");
    bodyEl.style.setProperty("height", "auto", "important");
    bodyEl.style.setProperty("overflow", "visible", "important");

    const sharedOptions = {
      backgroundColor,
      logging: false,
      useCORS: true,
      allowTaint: false,
      scale,
      windowWidth: viewportWidth,
      windowHeight: viewportHeight,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (element: Element) => element instanceof HTMLElement && element.getAttribute(BUG_REPORTER_UI_ATTR) === "true",
    };

    let lastError: unknown = null;
    const attempts: CaptureAttempt[] = [
      { foreignObjectRendering: true, sanitizeColorFunctions: false },
      { foreignObjectRendering: false, sanitizeColorFunctions: false },
      { foreignObjectRendering: false, sanitizeColorFunctions: true },
    ];

    try {
      for (const attempt of attempts) {
        try {
          const fullCanvas = await html2canvas(target, {
            ...sharedOptions,
            foreignObjectRendering: attempt.foreignObjectRendering,
            onclone: (clonedDocument: Document) => {
              unclampClonedLayout(clonedDocument);
              if (attempt.sanitizeColorFunctions) sanitizeCloneForModernColors(clonedDocument);
              applyPrivacyToClone(clonedDocument, this.privacy);
            },
          });

          const cropW = Math.round(viewportWidth * scale);
          const cropH = Math.round(viewportHeight * scale);
          const cropX = Math.round(savedScrollX * scale);
          const cropY = Math.round(savedScrollY * scale);

          const cropCanvas = document.createElement("canvas");
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          const ctx = cropCanvas.getContext("2d");
          if (!ctx) return await canvasToPngBlob(fullCanvas);

          ctx.drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          return await canvasToPngBlob(cropCanvas);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error("DOM snapshot capture failed.");
    } finally {
      htmlEl.style.height = origHtmlHeight;
      htmlEl.style.overflow = origHtmlOverflow;
      bodyEl.style.height = origBodyHeight;
      bodyEl.style.overflow = origBodyOverflow;
      window.scrollTo(savedScrollX, savedScrollY);
    }
  }

  async captureRegion(region: CaptureRegion): Promise<Blob> {
    const fullBlob = await this.capture();
    return this.cropBlob(fullBlob, region);
  }

  private async cropBlob(blob: Blob, region: CaptureRegion): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    const scale = bitmap.width / (window.innerWidth || 1);
    const sx = Math.round(region.x * scale);
    const sy = Math.round(region.y * scale);
    const sw = Math.round(region.width * scale);
    const sh = Math.round(region.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, sw);
    canvas.height = Math.max(1, sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); throw new Error("Could not create canvas for region crop."); }

    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    bitmap.close();
    return canvasToPngBlob(canvas);
  }
}