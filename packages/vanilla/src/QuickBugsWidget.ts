import {
  BreadcrumbCapture,
  ConsoleCapture,
  getQuickCaptureInstance,
  DEFAULT_MAX_RECORDING_MS,
  toErrorMessage,
  type BreadcrumbEntry,
  type BugClientMetadata,
  type BugReporterIntegration,
  type BugReporterIntegrations,
  type BugSessionArtifacts,
  type BugSubmitResult,
  type BugTrackerProvider,
  type ReportCaptureMode,
  type UserIdentity,
} from "@quick-bug-reporter/core";
import { BugReporter } from "./core/BugReporter";
import { injectStyles } from "./styles";

export type QuickBugsInitOptions = {
  integrations: BugReporterIntegrations;
  defaultProvider?: BugTrackerProvider;
  maxDurationMs?: number;
  user?: UserIdentity;
  breadcrumbs?: { clicks?: boolean; navigation?: boolean; forms?: boolean; maxEntries?: number } | false;
  container?: HTMLElement;
};

export type QuickBugsSubmitOptions = {
  title: string;
  description?: string;
  captureMode?: "screenshot" | "none";
};

export class QuickBugsWidget {
  private reporter: BugReporter | null = null;
  private consoleCapture: ConsoleCapture | null = null;
  private breadcrumbCapture: BreadcrumbCapture | null = null;
  private options: QuickBugsInitOptions;
  private selectedProvider: BugTrackerProvider | null = null;
  private draftMode: ReportCaptureMode | null = null;
  private isRecording = false;
  private elapsedMs = 0;
  private elapsedInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  // UI elements
  private root: HTMLElement | null = null;
  private floatingBtn: HTMLElement | null = null;
  private menuEl: HTMLElement | null = null;
  private modalEl: HTMLElement | null = null;
  private recordingEl: HTMLElement | null = null;
  private menuCloseHandler: ((e: PointerEvent) => void) | null = null;

  constructor(options: QuickBugsInitOptions) {
    this.options = options;
    const providers = (["cloud", "linear", "jira"] as const).filter((p) => Boolean(options.integrations[p]));
    this.selectedProvider = options.defaultProvider ?? providers[0] ?? null;

    // Console capture
    const existing = getQuickCaptureInstance();
    if (existing) { this.consoleCapture = existing; }
    else {
      this.consoleCapture = new ConsoleCapture();
      this.consoleCapture.start();
    }

    // Breadcrumb capture
    if (options.breadcrumbs !== false) {
      this.breadcrumbCapture = new BreadcrumbCapture(typeof options.breadcrumbs === "object" ? options.breadcrumbs : {});
      this.breadcrumbCapture.start();
    }

    injectStyles();
    this.renderFloatingButton();
  }

  private getOrCreateReporter(): BugReporter | null {
    if (this.reporter) return this.reporter;
    if (!this.selectedProvider) return null;
    const integration = this.options.integrations[this.selectedProvider];
    if (!integration) return null;

    this.reporter = new BugReporter({
      integration,
      maxDurationMs: this.options.maxDurationMs ?? DEFAULT_MAX_RECORDING_MS,
      onAutoStop: (artifacts) => this.handleAutoStop(artifacts),
    });
    return this.reporter;
  }

  private handleAutoStop(artifacts: BugSessionArtifacts) {
    this.isRecording = false;
    this.elapsedMs = artifacts.elapsedMs;
    this.draftMode = "video";
    this.stopElapsedTimer();
    this.renderFloatingButton();
    this.showModal();
  }

  private collectExtras() {
    const { consoleLogs, jsErrors } = this.consoleCapture?.snapshot() ?? { consoleLogs: [], jsErrors: [] };
    const breadcrumbs: BreadcrumbEntry[] = this.breadcrumbCapture?.snapshot() ?? [];
    return { consoleLogs, jsErrors, breadcrumbs, user: this.options.user };
  }

  // ── Public API ──

  async showReporter(): Promise<void> {
    this.showMenu();
  }

  async submit(options: QuickBugsSubmitOptions): Promise<{ success: boolean; reportId: string; externalIssueUrl: string | null }> {
    const r = this.getOrCreateReporter();
    if (!r) return { success: false, reportId: "", externalIssueUrl: null };

    const captureMode = options.captureMode ?? "none";
    let screenshotBlob: Blob | null = null;

    if (captureMode === "screenshot") {
      try { const a = await r.captureScreenshot(); screenshotBlob = a.screenshotBlob; }
      catch { /* continue */ }
    }

    if (!r.getLastArtifacts() && captureMode !== "screenshot") {
      await r.captureScreenshot().catch(() => {});
    }

    const extras = this.collectExtras();
    try {
      const result = await r.submit(options.title, options.description ?? "", {
        screenshotBlob,
        consoleLogs: extras.consoleLogs, jsErrors: extras.jsErrors, breadcrumbs: extras.breadcrumbs, user: extras.user,
      });
      return { success: true, reportId: result.issueId, externalIssueUrl: result.issueUrl };
    } catch {
      return { success: false, reportId: "", externalIssueUrl: null };
    }
  }

  setUser(user: UserIdentity): void {
    this.options.user = user;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopElapsedTimer();
    if (this.menuCloseHandler) {
      window.removeEventListener("pointerdown", this.menuCloseHandler);
      this.menuCloseHandler = null;
    }
    this.menuEl?.remove();
    this.menuEl = null;
    if (this.consoleCapture && this.consoleCapture !== getQuickCaptureInstance()) this.consoleCapture.stop();
    this.breadcrumbCapture?.stop();
    if (this.reporter) { void this.reporter.dispose(); this.reporter = null; }
    this.root?.remove();
    this.modalEl?.remove();
    this.root = null;
    this.modalEl = null;
  }

  // ── Floating button ──

  private renderFloatingButton() {
    if (this.destroyed) return;
    if (this.root) this.root.remove();

    this.root = document.createElement("div");
    this.root.setAttribute("data-bug-reporter-ui", "true");
    this.root.className = "qb-floating-root";

    if (this.isRecording) {
      this.root.innerHTML = `
        <div class="qb-recording-group">
          <button class="qb-btn qb-btn-stop" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
            Stop recording
          </button>
          <p class="qb-recording-timer">Recording ${this.formatElapsed(this.elapsedMs)} / ${this.formatElapsed(this.options.maxDurationMs ?? DEFAULT_MAX_RECORDING_MS)}</p>
        </div>`;
      this.root.querySelector(".qb-btn-stop")?.addEventListener("click", () => void this.handleStopRecording());
    } else {
      this.root.innerHTML = `
        <button class="qb-btn qb-btn-main" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Report Bug
        </button>`;
      this.root.querySelector(".qb-btn-main")?.addEventListener("click", () => this.showMenu());
    }

    (this.options.container ?? document.body).appendChild(this.root);
  }

  private showMenu() {
    this.hideMenu();
    this.menuEl = document.createElement("div");
    this.menuEl.className = "qb-menu";
    this.menuEl.setAttribute("data-bug-reporter-ui", "true");
    this.menuEl.innerHTML = `
      <button class="qb-menu-item" data-action="screenshot">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
        Full page screenshot
      </button>
      <button class="qb-menu-item" data-action="record">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
        Record flow video
      </button>`;

    this.menuEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
      if (!btn) return;
      const action = btn.dataset.action;
      this.hideMenu();
      if (action === "screenshot") void this.handleScreenshot();
      if (action === "record") void this.handleStartRecording();
    });

    // Close menu on outside click
    this.menuCloseHandler = (e: PointerEvent) => {
      if (!this.menuEl?.contains(e.target as Node) && !this.root?.contains(e.target as Node)) {
        this.hideMenu();
      }
    };
    setTimeout(() => {
      if (this.menuCloseHandler) {
        window.addEventListener("pointerdown", this.menuCloseHandler);
      }
    }, 0);

    (this.options.container ?? document.body).appendChild(this.menuEl);
  }

  private hideMenu() {
    if (this.menuCloseHandler) {
      window.removeEventListener("pointerdown", this.menuCloseHandler);
      this.menuCloseHandler = null;
    }
    this.menuEl?.remove();
    this.menuEl = null;
  }

  // ── Actions ──

  private async handleScreenshot() {
    const r = this.getOrCreateReporter();
    if (!r) return;
    try {
      const artifacts = await r.captureScreenshot();
      if (!artifacts.screenshotBlob) return;
      this.draftMode = "screenshot";
      this.showModal();
    } catch (e) {
      console.error("[QuickBugs]", toErrorMessage(e));
    }
  }

  private async handleStartRecording() {
    const r = this.getOrCreateReporter();
    if (!r) return;
    try {
      await r.start();
      this.isRecording = true;
      this.elapsedMs = 0;
      this.draftMode = "video";
      this.startElapsedTimer();
      this.renderFloatingButton();
    } catch (e) {
      console.error("[QuickBugs]", toErrorMessage(e));
    }
  }

  private async handleStopRecording() {
    if (!this.reporter) return;
    try {
      const artifacts = await this.reporter.stop();
      this.isRecording = false;
      this.elapsedMs = artifacts?.elapsedMs ?? 0;
      this.stopElapsedTimer();
      this.renderFloatingButton();
      if (artifacts?.videoBlob) this.showModal();
    } catch (e) {
      console.error("[QuickBugs]", toErrorMessage(e));
    }
  }

  // ── Modal ──

  showModal() {
    this.hideModal();
    this.modalEl = document.createElement("div");
    this.modalEl.className = "qb-modal-overlay";
    this.modalEl.setAttribute("data-bug-reporter-ui", "true");

    const providers = (["cloud", "linear", "jira"] as const).filter((p) => Boolean(this.options.integrations[p]));
    const providerOptions = providers.map((p) => {
      const label = p === "linear" ? "Linear" : p === "jira" ? "Jira" : "QuickBugs Cloud";
      return `<option value="${p}" ${p === this.selectedProvider ? "selected" : ""}>${label}</option>`;
    }).join("");

    this.modalEl.innerHTML = `
      <div class="qb-modal-backdrop"></div>
      <div class="qb-modal">
        <h2 class="qb-modal-title">Report a Bug</h2>
        <p class="qb-modal-sub">Capture: ${this.draftMode === "screenshot" ? "Screenshot" : this.draftMode === "video" ? "Video" : "None"}</p>
        <form class="qb-modal-form">
          <label class="qb-label">Title *</label>
          <input class="qb-input" name="title" maxlength="140" placeholder="Short summary of the bug" required />
          <label class="qb-label">Steps to reproduce</label>
          <textarea class="qb-textarea" name="steps" placeholder="1. Go to..."></textarea>
          <label class="qb-label">Expected result</label>
          <textarea class="qb-textarea" name="expected" placeholder="What should happen..."></textarea>
          <label class="qb-label">Actual result</label>
          <textarea class="qb-textarea" name="actual" placeholder="What actually happened..."></textarea>
          <label class="qb-label">Additional context</label>
          <textarea class="qb-textarea" name="context" placeholder="Any extra info..."></textarea>
          <label class="qb-label">Submit to</label>
          <select class="qb-select" name="provider">${providerOptions}</select>
          <div class="qb-modal-actions">
            <button type="button" class="qb-btn qb-btn-outline qb-cancel-btn">Cancel</button>
            <button type="submit" class="qb-btn qb-btn-main qb-submit-btn">Submit</button>
          </div>
          <p class="qb-progress" style="display:none;"></p>
        </form>
      </div>`;

    this.modalEl.querySelector(".qb-modal-backdrop")?.addEventListener("click", () => this.hideModal());
    this.modalEl.querySelector(".qb-cancel-btn")?.addEventListener("click", () => this.hideModal());

    const form = this.modalEl.querySelector("form")!;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void this.handleModalSubmit(form);
    });

    document.body.appendChild(this.modalEl);
  }

  private hideModal() {
    this.modalEl?.remove();
    this.modalEl = null;
  }

  private async handleModalSubmit(form: HTMLFormElement) {
    const data = new FormData(form);
    const title = (data.get("title") as string).trim();
    if (!title) return;

    const provider = data.get("provider") as BugTrackerProvider;
    this.selectedProvider = provider;

    const r = this.getOrCreateReporter();
    if (!r) return;

    const integration = this.options.integrations[provider];
    if (integration) r.setIntegration(integration);

    const submitBtn = form.querySelector(".qb-submit-btn") as HTMLButtonElement;
    const progress = form.querySelector(".qb-progress") as HTMLElement;
    submitBtn.disabled = true;
    progress.style.display = "block";
    progress.textContent = "Preparing submission...";

    const stepsToReproduce = data.get("steps") as string;
    const expectedResult = data.get("expected") as string;
    const actualResult = data.get("actual") as string;
    const additionalContext = data.get("context") as string;

    const sections: string[] = [];
    if (stepsToReproduce?.trim()) sections.push(`## Steps to Reproduce\n${stepsToReproduce.trim()}`);
    if (expectedResult?.trim()) sections.push(`## Expected Result\n${expectedResult.trim()}`);
    if (actualResult?.trim()) sections.push(`## Actual Result\n${actualResult.trim()}`);
    if (additionalContext?.trim()) sections.push(`## Additional Context\n${additionalContext.trim()}`);
    const description = sections.length > 0 ? sections.join("\n\n") : "No description provided";

    const extras = this.collectExtras();

    try {
      await r.submit(title, description, {
        stepsToReproduce, expectedResult, actualResult, additionalContext,
        consoleLogs: extras.consoleLogs, jsErrors: extras.jsErrors, breadcrumbs: extras.breadcrumbs, user: extras.user,
        onProgress: (msg) => { progress.textContent = msg; },
      });
      this.draftMode = null;
      this.hideModal();
    } catch (e) {
      progress.textContent = `Error: ${toErrorMessage(e)}`;
      progress.style.color = "#dc2626";
      submitBtn.disabled = false;
    }
  }

  // ── Timers ──

  private startElapsedTimer() {
    this.stopElapsedTimer();
    this.elapsedInterval = setInterval(() => {
      if (!this.reporter) return;
      this.elapsedMs = this.reporter.getElapsedMs();
      // Update timer display
      const timer = this.root?.querySelector(".qb-recording-timer");
      if (timer) timer.textContent = `Recording ${this.formatElapsed(this.elapsedMs)} / ${this.formatElapsed(this.options.maxDurationMs ?? DEFAULT_MAX_RECORDING_MS)}`;
    }, 250);
  }

  private stopElapsedTimer() {
    if (this.elapsedInterval) { clearInterval(this.elapsedInterval); this.elapsedInterval = null; }
  }

  private formatElapsed(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
  }
}