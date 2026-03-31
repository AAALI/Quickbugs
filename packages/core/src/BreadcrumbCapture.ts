import { BreadcrumbEntry } from "./types";

export type BreadcrumbOptions = {
  clicks?: boolean;
  navigation?: boolean;
  forms?: boolean;
  maxEntries?: number;
};

const DEFAULT_MAX_ENTRIES = 50;
const MAX_TEXT_LENGTH = 50;

function truncateText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH) + "…" : trimmed;
}

export class BreadcrumbCapture {
  private entries: BreadcrumbEntry[] = [];
  private maxEntries: number;
  private active = false;

  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private popstateHandler: (() => void) | null = null;
  private hashchangeHandler: (() => void) | null = null;
  private submitHandler: ((e: SubmitEvent) => void) | null = null;

  private captureClicks: boolean;
  private captureNavigation: boolean;
  private captureForms: boolean;

  constructor(options: BreadcrumbOptions = {}) {
    this.captureClicks = options.clicks ?? true;
    this.captureNavigation = options.navigation ?? true;
    this.captureForms = options.forms ?? true;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  start(): void {
    if (this.active || typeof window === "undefined") return;
    this.active = true;
    this.entries = [];

    if (this.captureClicks) {
      this.clickHandler = (e: MouseEvent) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        const tag = target.tagName.toLowerCase();
        const text = target.textContent ? truncateText(target.textContent) : undefined;
        const testId = target.getAttribute("data-testid") || undefined;

        this.push({
          type: "click",
          timestamp: new Date().toISOString(),
          element: tag,
          text,
          testId,
        });
      };
      document.addEventListener("click", this.clickHandler, { capture: true });
    }

    if (this.captureNavigation) {
      this.popstateHandler = () => {
        this.push({
          type: "navigation",
          timestamp: new Date().toISOString(),
          url: window.location.href,
        });
      };
      window.addEventListener("popstate", this.popstateHandler);

      this.hashchangeHandler = () => {
        this.push({
          type: "navigation",
          timestamp: new Date().toISOString(),
          url: window.location.href,
        });
      };
      window.addEventListener("hashchange", this.hashchangeHandler);
    }

    if (this.captureForms) {
      this.submitHandler = (e: SubmitEvent) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;

        this.push({
          type: "form_submit",
          timestamp: new Date().toISOString(),
          action: form.action || undefined,
          method: form.method || undefined,
        });
      };
      document.addEventListener("submit", this.submitHandler, { capture: true });
    }
  }

  /** Add a console_error breadcrumb from ConsoleCapture. */
  addConsoleError(message: string): void {
    if (!this.active) return;
    this.push({
      type: "console_error",
      timestamp: new Date().toISOString(),
      message: truncateText(message),
    });
  }

  /** Add a navigation breadcrumb for SPA routers (Next.js, React Router). */
  addNavigation(url: string): void {
    if (!this.active || !this.captureNavigation) return;
    this.push({
      type: "navigation",
      timestamp: new Date().toISOString(),
      url,
    });
  }

  snapshot(): BreadcrumbEntry[] {
    return [...this.entries];
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;

    if (this.clickHandler) {
      document.removeEventListener("click", this.clickHandler, { capture: true });
      this.clickHandler = null;
    }
    if (this.popstateHandler) {
      window.removeEventListener("popstate", this.popstateHandler);
      this.popstateHandler = null;
    }
    if (this.hashchangeHandler) {
      window.removeEventListener("hashchange", this.hashchangeHandler);
      this.hashchangeHandler = null;
    }
    if (this.submitHandler) {
      document.removeEventListener("submit", this.submitHandler, { capture: true });
      this.submitHandler = null;
    }
  }

  clear(): void {
    this.entries = [];
  }

  private push(entry: BreadcrumbEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }
}
