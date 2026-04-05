import {
  defineComponent,
  provide,
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  shallowRef,
  toRef,
  h,
  type PropType,
} from "vue";
import { BugReporter } from "../core/BugReporter";
import type { CaptureRegion } from "../core/ScreenshotCapturer";
import {
  BreadcrumbCapture,
  ConsoleCapture,
  getQuickCaptureInstance,
  DEFAULT_MAX_RECORDING_MS,
  toErrorMessage,
  type BreadcrumbEntry,
  type BugClientMetadata,
  type BugReporterIntegrations,
  type BugSessionArtifacts,
  type BugTrackerProvider,
  type ReportCaptureMode,
  type ScreenshotHighlightRegion,
  type UserIdentity,
} from "@quick-bug-reporter/core";
import {
  QuickBugsKey,
  type HeadlessCaptureOptions,
  type HeadlessCaptureResult,
  type QuickBugsContext,
} from "../composables/useQuickBugs";

export type BreadcrumbConfig = {
  clicks?: boolean;
  navigation?: boolean;
  forms?: boolean;
  maxEntries?: number;
};

type ScreenshotAnnotationState = {
  annotatedBlob: Blob | null;
  highlights: ScreenshotHighlightRegion[];
  imageWidth: number;
  imageHeight: number;
};

export const QuickBugsProvider = defineComponent({
  name: "QuickBugsProvider",
  props: {
    integrations: { type: Object as PropType<BugReporterIntegrations>, required: true },
    defaultProvider: { type: String as PropType<BugTrackerProvider>, default: undefined },
    maxDurationMs: { type: Number, default: DEFAULT_MAX_RECORDING_MS },
    user: { type: Object as PropType<UserIdentity>, default: undefined },
    breadcrumbs: { type: [Object, Boolean] as PropType<BreadcrumbConfig | false>, default: undefined },
  },
  setup(props, { slots }) {
    const isOpen = ref(false);
    const isRecording = ref(false);
    const elapsedMs = ref(0);
    const isSubmitting = ref(false);
    const submissionProgress = ref<string | null>(null);
    const isCapturingScreenshot = ref(false);
    const isSelectingRegion = ref(false);
    const error = ref<string | null>(null);
    const success = ref<string | null>(null);
    const autoStopNotice = ref<string | null>(null);
    const selectedProvider = ref<BugTrackerProvider | null>(props.defaultProvider ?? null);
    const draftMode = ref<ReportCaptureMode | null>(null);
    const videoBlob = shallowRef<Blob | null>(null);
    const videoPreviewUrl = ref<string | null>(null);
    const screenshotBlob = shallowRef<Blob | null>(null);
    const screenshotPreviewUrl = ref<string | null>(null);
    const screenshotAnnotation = ref<ScreenshotAnnotationState>({
      annotatedBlob: null, highlights: [], imageWidth: 0, imageHeight: 0,
    });

    let reporter: BugReporter | null = null;
    let consoleCapture: ConsoleCapture | null = null;
    let breadcrumbCapture: BreadcrumbCapture | null = null;
    let elapsedInterval: ReturnType<typeof setInterval> | null = null;
    let currentUser: UserIdentity | undefined = props.user;

    watch(() => props.user, (u) => { currentUser = u; });

    const availableProviders = computed<BugTrackerProvider[]>(() =>
      (["cloud", "linear", "jira"] as const).filter((p) => Boolean(props.integrations[p]))
    );

    const hasDraft = computed(() => {
      if (draftMode.value === "video") return Boolean(videoBlob.value);
      if (draftMode.value === "screenshot") return Boolean(screenshotBlob.value);
      return false;
    });

    const screenshotHighlightCount = computed(() => screenshotAnnotation.value.highlights.length);

    /**
     * Replace a stored object URL with one created from `blob`, revoking the previous URL if present.
     *
     * @param urlRef - A ref containing the current object URL string or `null` (e.g., `videoPreviewUrl` or `screenshotPreviewUrl`)
     * @param blob - The Blob to create an object URL from, or `null` to clear the ref
     */
    function revokeAndSet(urlRef: typeof videoPreviewUrl, blob: Blob | null) {
      if (urlRef.value) URL.revokeObjectURL(urlRef.value);
      urlRef.value = blob ? URL.createObjectURL(blob) : null;
    }

    watch(videoBlob, (b) => revokeAndSet(videoPreviewUrl, b));
    watch(screenshotBlob, (b) => revokeAndSet(screenshotPreviewUrl, b));

    watch([availableProviders, toRef(props, "defaultProvider")], ([providers, dp]) => {
      if (providers.length === 0) { selectedProvider.value = null; return; }
      if (dp && providers.includes(dp) && !selectedProvider.value) { selectedProvider.value = dp; return; }
      if (selectedProvider.value && providers.includes(selectedProvider.value)) return;
      selectedProvider.value = providers[0];
    }, { immediate: true });

    onMounted(() => {
      const existing = getQuickCaptureInstance();
      if (existing) { consoleCapture = existing; }
      else { consoleCapture = new ConsoleCapture(); consoleCapture.start(); }
    });

    onUnmounted(() => {
      if (consoleCapture && consoleCapture !== getQuickCaptureInstance()) consoleCapture.stop();
      consoleCapture = null;
    });

    watch(() => props.breadcrumbs, (config) => {
      if (breadcrumbCapture) { breadcrumbCapture.stop(); breadcrumbCapture = null; }
      if (config === false) return;
      breadcrumbCapture = new BreadcrumbCapture(typeof config === "object" ? config : {});
      breadcrumbCapture.start();
    }, { immediate: true, deep: true });

    onUnmounted(() => { breadcrumbCapture?.stop(); breadcrumbCapture = null; });

    /**
     * Apply artifacts from an automatic recording stop to the component state.
     *
     * Updates recording state, elapsed time, draft mode, stored video blob, and sets an informational auto-stop notice based on the stop reason.
     *
     * @param artifacts - The session artifacts containing `elapsedMs`, optional `videoBlob`, and `stopReason` (`"time_limit"` or `"screen_ended"`) used to update state
     */
    function handleAutoStop(artifacts: BugSessionArtifacts) {
      isRecording.value = false;
      elapsedMs.value = artifacts.elapsedMs;
      draftMode.value = "video";
      videoBlob.value = artifacts.videoBlob ?? null;
      if (artifacts.stopReason === "time_limit") {
        autoStopNotice.value = `Recording reached the ${Math.round(props.maxDurationMs / 1000)}-second limit and stopped automatically.`;
      } else if (artifacts.stopReason === "screen_ended") {
        autoStopNotice.value = "Screen sharing ended and recording was stopped.";
      }
    }

    /**
     * Return the existing BugReporter or create and cache a new one for the current provider.
     *
     * If a reporter is created it is initialized with the provider's integration, `props.maxDurationMs`, and an `onAutoStop` handler; if no `selectedProvider` was set, this function will set it to the provider used.
     *
     * @returns The cached or newly created `BugReporter`, or `null` when no provider integration is available.
     */
    function getOrCreateReporter(): BugReporter | null {
      if (reporter) return reporter;
      const provider = selectedProvider.value ?? availableProviders.value[0];
      if (!provider) return null;
      const integration = props.integrations[provider];
      if (!integration) return null;
      reporter = new BugReporter({ integration, maxDurationMs: props.maxDurationMs, onAutoStop: handleAutoStop });
      if (!selectedProvider.value) selectedProvider.value = provider;
      return reporter;
    }

    watch([selectedProvider, () => props.integrations, () => props.maxDurationMs], () => {
      if (!selectedProvider.value) return;
      const integration = props.integrations[selectedProvider.value];
      if (!integration) return;
      if (!reporter) {
        reporter = new BugReporter({ integration, maxDurationMs: props.maxDurationMs, onAutoStop: handleAutoStop });
        return;
      }
      reporter.setIntegration(integration);
    });

    watch(isRecording, (recording) => {
      if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
      if (!recording) return;
      elapsedInterval = setInterval(() => {
        if (!reporter) return;
        elapsedMs.value = reporter.getElapsedMs();
        if (!reporter.isRecording()) isRecording.value = false;
      }, 250);
    });

    onUnmounted(() => {
      if (elapsedInterval) clearInterval(elapsedInterval);
      if (videoPreviewUrl.value) URL.revokeObjectURL(videoPreviewUrl.value);
      if (screenshotPreviewUrl.value) URL.revokeObjectURL(screenshotPreviewUrl.value);
      if (reporter) { void reporter.dispose(); reporter = null; }
    });

    /**
 * Clear any current UI messages related to reporting.
 *
 * Resets the `error`, `success`, and `autoStopNotice` refs to `null`.
 */
function resetMessages() { error.value = null; success.value = null; autoStopNotice.value = null; }

    /**
     * Clears the current capture draft and resets related UI and metadata state.
     *
     * Resets draft mode, clears stored video and screenshot blobs and annotations, and resets elapsed time. Also instructs the active reporter (if any) to clear its draft state.
     */
    function clearDraft() {
      reporter?.clearDraft();
      draftMode.value = null;
      videoBlob.value = null;
      screenshotBlob.value = null;
      screenshotAnnotation.value = { annotatedBlob: null, highlights: [], imageWidth: 0, imageHeight: 0 };
      elapsedMs.value = 0;
    }

    /**
 * Opens the QuickBugs modal.
 */
function openModal() { isOpen.value = true; }
    /**
 * Closes the QuickBugs modal.
 */
function closeModal() { isOpen.value = false; }

    /**
     * Starts a video recording session with the configured bug reporter.
     *
     * Clears existing messages and any current draft before attempting to start. On success sets `elapsedMs` to 0, `isRecording` to `true`, and `draftMode` to `"video"`. On failure sets `isRecording` to `false` and populates `error`.
     *
     * @returns `true` if recording started successfully, `false` otherwise. Returns `false` and sets `error` when no bug tracker integration is configured or when starting fails.
     */
    async function startRecording(): Promise<boolean> {
      const r = getOrCreateReporter();
      if (!r) { error.value = "No bug tracker integration is configured."; return false; }
      resetMessages(); clearDraft();
      try {
        await r.start(); elapsedMs.value = 0; isRecording.value = true; draftMode.value = "video"; return true;
      } catch (e) { isRecording.value = false; error.value = toErrorMessage(e); return false; }
    }

    /**
     * Stops an in-progress recording and stores any resulting video artifact.
     *
     * On success updates `elapsedMs` from the reporter, sets `isRecording` to `false`,
     * and if a video blob is present sets `draftMode` to `"video"` and stores `videoBlob`.
     * On failure sets the `error` ref with a human-readable message.
     *
     * @returns `true` if a video blob was produced and stored, `false` otherwise (including on error)
     */
    async function stopRecording(): Promise<boolean> {
      if (!reporter) return false;
      try {
        const artifacts = await reporter.stop();
        elapsedMs.value = artifacts?.elapsedMs ?? reporter.getElapsedMs();
        isRecording.value = false;
        if (artifacts?.videoBlob) { draftMode.value = "video"; videoBlob.value = artifacts.videoBlob; return true; }
        return false;
      } catch (e) { error.value = toErrorMessage(e); return false; }
    }

    /**
     * Captures a quick screenshot and prepares it as the current draft evidence.
     *
     * Stops an active recording if present, resets messages and any existing draft, and sets an in-progress capture flag while performing the screenshot capture. On success, stores the captured image as the screenshot draft, initializes screenshot annotation state, updates elapsed time, clears any auto-stop notice, and clears the in-progress flag. On failure, sets the component `error` state and clears the in-progress flag.
     *
     * @returns `true` if a screenshot was captured and stored as the draft, `false` otherwise.
     */
    async function captureQuickScreenshot(): Promise<boolean> {
      const r = getOrCreateReporter();
      if (!r) { error.value = "No bug tracker integration is configured."; return false; }
      if (isRecording.value) { const stopped = await stopRecording(); if (!stopped) return false; }
      resetMessages(); clearDraft(); isCapturingScreenshot.value = true;
      try {
        const artifacts = await r.captureScreenshot();
        if (!artifacts.screenshotBlob) throw new Error("Quick screenshot returned no image.");
        draftMode.value = "screenshot"; screenshotBlob.value = artifacts.screenshotBlob;
        screenshotAnnotation.value = { annotatedBlob: null, highlights: [], imageWidth: 0, imageHeight: 0 };
        elapsedMs.value = artifacts.elapsedMs; isRecording.value = false; autoStopNotice.value = null;
        return true;
      } catch (e) { error.value = toErrorMessage(e); return false; }
      finally { isCapturingScreenshot.value = false; }
    }

    /**
     * Begins interactive region selection for screenshot annotation.
     *
     * Clears any existing messages and enables region-selection mode.
     *
     * If a screen recording is currently active, this is a no-op.
     */
    function startRegionSelection() {
      if (isRecording.value) return;
      resetMessages(); isSelectingRegion.value = true;
    }

    /**
 * Cancels any active region selection mode.
 *
 * Exits region selection by clearing the internal selection flag so the UI stops treating the screen as being selected.
 */
function cancelRegionSelection() { isSelectingRegion.value = false; }

    /**
     * Collects the current console logs, JavaScript errors, breadcrumb entries, and current user identity for inclusion with a report submission.
     *
     * @returns An object containing:
     *  - `consoleLogs` — array of captured console log entries
     *  - `jsErrors` — array of captured JavaScript error records
     *  - `breadcrumbs` — array of `BreadcrumbEntry` items
     *  - `user` — the current user identity (may be `null` or `undefined`)
     */
    function collectSubmissionExtras() {
      const { consoleLogs, jsErrors } = consoleCapture?.snapshot() ?? { consoleLogs: [], jsErrors: [] };
      const breadcrumbs: BreadcrumbEntry[] = breadcrumbCapture?.snapshot() ?? [];
      return { consoleLogs, jsErrors, breadcrumbs, user: currentUser };
    }

    /**
     * Replace the current screenshot annotation state.
     *
     * @param annotation - The new screenshot annotation state to apply
     */
    function updateScreenshotAnnotation(annotation: ScreenshotAnnotationState) {
      screenshotAnnotation.value = annotation;
    }

    /**
     * Set the currently selected bug tracker provider.
     *
     * @param provider - The provider to select
     */
    function setSelectedProvider(provider: BugTrackerProvider) {
      selectedProvider.value = provider;
    }

    /**
     * Submits the current draft evidence and structured report fields to the selected bug tracker.
     *
     * Builds a Markdown description from the provided structured fields, attaches the appropriate
     * screenshot (including annotated version when present), includes collected extras (console logs,
     * JS errors, breadcrumbs, and user), and uploads via the active reporter integration.
     *
     * @param title - Short title for the report
     * @param structuredFields - Structured text sections to include in the report
     * @param structuredFields.stepsToReproduce - Steps to reproduce the issue
     * @param structuredFields.expectedResult - The expected behavior
     * @param structuredFields.actualResult - The observed behavior
     * @param structuredFields.additionalContext - Any additional context or notes
     * @returns The submission result object when submission succeeds, `null` otherwise.
     */
    async function submitReport(
      title: string,
      structuredFields: { stepsToReproduce: string; expectedResult: string; actualResult: string; additionalContext: string }
    ) {
      const r = getOrCreateReporter();
      if (!r) { error.value = "No bug tracker integration is configured."; return null; }
      if (!selectedProvider.value || !props.integrations[selectedProvider.value]) {
        error.value = "Select a bug tracker provider before submitting."; return null;
      }
      const artifacts = r.getLastArtifacts();
      if (!artifacts || !draftMode.value || artifacts.captureMode !== draftMode.value) {
        error.value = "Capture evidence first, then tag and submit."; return null;
      }
      r.setIntegration(props.integrations[selectedProvider.value]!);
      isSubmitting.value = true; submissionProgress.value = "Preparing submission..."; error.value = null; success.value = null;

      const { stepsToReproduce, expectedResult, actualResult, additionalContext } = structuredFields;
      const sections: string[] = [];
      if (stepsToReproduce.trim()) sections.push(`## Steps to Reproduce\n${stepsToReproduce.trim()}`);
      if (expectedResult.trim()) sections.push(`## Expected Result\n${expectedResult.trim()}`);
      if (actualResult.trim()) sections.push(`## Actual Result\n${actualResult.trim()}`);
      if (additionalContext.trim()) sections.push(`## Additional Context\n${additionalContext.trim()}`);
      const description = sections.length > 0 ? sections.join("\n\n") : "No description provided";

      const screenshotBlobForSubmit = draftMode.value === "screenshot" ? screenshotAnnotation.value.annotatedBlob ?? screenshotBlob.value : null;
      const metadata: Partial<BugClientMetadata> = {
        annotation: draftMode.value === "screenshot" && screenshotAnnotation.value.highlights.length > 0
          ? { imageWidth: screenshotAnnotation.value.imageWidth, imageHeight: screenshotAnnotation.value.imageHeight, highlights: screenshotAnnotation.value.highlights }
          : undefined,
      };
      const extras = collectSubmissionExtras();

      try {
        const result = await r.submit(title, description, {
          stepsToReproduce, expectedResult, actualResult, additionalContext,
          screenshotBlob: screenshotBlobForSubmit, metadata,
          consoleLogs: extras.consoleLogs, jsErrors: extras.jsErrors, breadcrumbs: extras.breadcrumbs, user: extras.user,
          onProgress: (msg) => { submissionProgress.value = msg; },
        });
        if (result.provider === "cloud" && !result.issueUrl) {
          success.value = "Report received by QuickBugs Cloud. Tracker forwarding is running in the background.";
        } else {
          const label = result.provider === "linear" ? "Linear" : result.provider === "jira" ? "Jira" : "QuickBugs Cloud";
          success.value = `Submitted to ${label} (${result.issueKey}).`;
        }
        clearDraft(); isOpen.value = false; return result;
      } catch (e) { error.value = toErrorMessage(e); return null; }
      finally { isSubmitting.value = false; submissionProgress.value = null; }
    }

    /**
     * Captures evidence (optionally a headless screenshot) and submits a report using the configured reporter.
     *
     * @param options - Headless capture and submission options including `title`, optional `description`, and optional `captureMode` (e.g., `"screenshot"` or `"none"`)
     * @returns A `HeadlessCaptureResult` containing `success`, the created `reportId` when successful (empty string on failure), and `externalIssueUrl` when the provider returned an external URL (or `null`)
     */
    async function captureAndSubmit(options: HeadlessCaptureOptions): Promise<HeadlessCaptureResult> {
      const r = getOrCreateReporter();
      if (!r) return { success: false, reportId: "", externalIssueUrl: null };
      const captureMode = options.captureMode ?? "none";
      let screenshotBlobHeadless: Blob | null = null;
      if (captureMode === "screenshot") {
        try { const a = await r.captureScreenshot(); screenshotBlobHeadless = a.screenshotBlob; } catch { /* continue */ }
      }
      const extras = collectSubmissionExtras();
      try {
        if (!r.getLastArtifacts() && captureMode !== "screenshot" && captureMode !== "none") {
          await r.captureScreenshot().catch(() => {});
        }
        const submitOptions: any = {
          consoleLogs: extras.consoleLogs,
          jsErrors: extras.jsErrors,
          breadcrumbs: extras.breadcrumbs,
          user: extras.user,
        };
        if (captureMode !== "none") {
          submitOptions.screenshotBlob = screenshotBlobHeadless;
        }
        const result = await r.submit(options.title, options.description ?? "", submitOptions);
        return { success: true, reportId: result.issueId, externalIssueUrl: result.issueUrl };
      } catch { return { success: false, reportId: "", externalIssueUrl: null }; }
    }

    const context: QuickBugsContext = {
      isOpen, openModal, closeModal,
      draftMode, hasDraft,
      isRecording, elapsedMs, maxDurationMs: props.maxDurationMs,
      isSubmitting, submissionProgress,
      isCapturingScreenshot, isSelectingRegion,
      error, success, autoStopNotice,
      availableProviders, selectedProvider, setSelectedProvider,
      startRecording, stopRecording,
      captureQuickScreenshot,
      startRegionSelection, cancelRegionSelection,
      videoPreviewUrl, screenshotPreviewUrl,
      screenshotHighlightCount, updateScreenshotAnnotation,
      clearDraft, submitReport, resetMessages,
      captureAndSubmit,
    };

    provide(QuickBugsKey, context);

    return () => slots.default?.();
  },
});