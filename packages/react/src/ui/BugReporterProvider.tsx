"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { BugReporter } from "../core/BugReporter";
import type { CaptureRegion, ScreenshotPrivacyOptions } from "../core/ScreenshotCapturer";
import {
  BreadcrumbCapture,
  ConsoleCapture,
  getQuickCaptureInstance,
  BugClientMetadata,
  BugSessionArtifacts,
  BugSubmitResult,
  BugTrackerProvider,
  DEFAULT_MAX_RECORDING_MS,
  ReportCaptureMode,
  ScreenshotHighlightRegion,
  toErrorMessage,
  type BreadcrumbEntry,
  type BugReporterIntegrations,
  type UserIdentity,
} from "@quick-bug-reporter/core";
import { RegionSelector } from "./RegionSelector";

// SDK-06: Breadcrumb config
export type BreadcrumbConfig = {
  clicks?: boolean;
  navigation?: boolean;
  forms?: boolean;
  maxEntries?: number;
};

type BugReporterProviderProps = {
  children: ReactNode;
  integrations: BugReporterIntegrations;
  defaultProvider?: BugTrackerProvider;
  maxDurationMs?: number;
  // SDK-03: User identity
  user?: UserIdentity;
  // SDK-06: Breadcrumb configuration
  breadcrumbs?: BreadcrumbConfig | false;
  // SDK-09: Privacy options
  privacy?: ScreenshotPrivacyOptions;
};

type ScreenshotAnnotationState = {
  annotatedBlob: Blob | null;
  highlights: ScreenshotHighlightRegion[];
  imageWidth: number;
  imageHeight: number;
};

// SDK-07: Headless capture options
export type HeadlessCaptureOptions = {
  title: string;
  description?: string;
  captureMode?: "screenshot" | "none";
};

export type HeadlessCaptureResult = {
  success: boolean;
  reportId: string;
  externalIssueUrl: string | null;
};

type BugReporterContextValue = {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  draftMode: ReportCaptureMode | null;
  hasDraft: boolean;
  isRecording: boolean;
  elapsedMs: number;
  maxDurationMs: number;
  isSubmitting: boolean;
  submissionProgress: string | null;
  isCapturingScreenshot: boolean;
  isSelectingRegion: boolean;
  error: string | null;
  success: string | null;
  autoStopNotice: string | null;
  availableProviders: BugTrackerProvider[];
  selectedProvider: BugTrackerProvider | null;
  setSelectedProvider: (provider: BugTrackerProvider) => void;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<boolean>;
  captureQuickScreenshot: () => Promise<boolean>;
  startRegionSelection: () => void;
  videoPreviewUrl: string | null;
  screenshotPreviewUrl: string | null;
  screenshotHighlightCount: number;
  updateScreenshotAnnotation: (annotation: ScreenshotAnnotationState) => void;
  clearDraft: () => void;
  submitReport: (
    title: string,
    structuredFields: {
      stepsToReproduce: string;
      expectedResult: string;
      actualResult: string;
      additionalContext: string;
    }
  ) => Promise<BugSubmitResult | null>;
  resetMessages: () => void;
  // SDK-07: Headless capture
  captureAndSubmit: (options: HeadlessCaptureOptions) => Promise<HeadlessCaptureResult>;
};

const BugReporterContext = createContext<BugReporterContextValue | null>(null);

function getProviderLabel(provider: BugTrackerProvider): string {
  if (provider === "linear") return "Linear";
  if (provider === "jira") return "Jira";
  if (provider === "cloud") return "QuickBugs Cloud";
  return provider;
}

/**
 * Provides the BugReporter context and manages capture, draft, and submission lifecycle for its children.
 *
 * This component initializes and maintains reporter, console, and breadcrumb capture instances; exposes
 * actions for recording, screenshot capture/annotation, and submission; and renders the context provider
 * and a region selector when region selection is active.
 *
 * @param props.integrations - Mapping of bug tracker integrations available to the provider.
 * @param props.defaultProvider - Optional provider to select by default when available.
 * @param props.maxDurationMs - Maximum recording duration in milliseconds.
 * @param props.user - Optional user identity that will be included with submissions.
 * @param props.breadcrumbs - Breadcrumb capture configuration, or `false` to disable breadcrumb capture.
 * @returns The React element tree wrapped with BugReporterContext.Provider (renders children and an active RegionSelector when selecting a region).
 */
export function BugReporterProvider({
  children,
  integrations,
  defaultProvider,
  maxDurationMs = DEFAULT_MAX_RECORDING_MS,
  user,
  breadcrumbs: breadcrumbConfig,
  privacy,
}: BugReporterProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoStopNotice, setAutoStopNotice] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<BugTrackerProvider | null>(defaultProvider ?? null);

  const [draftMode, setDraftMode] = useState<ReportCaptureMode | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);
  const [screenshotAnnotation, setScreenshotAnnotation] = useState<ScreenshotAnnotationState>({
    annotatedBlob: null,
    highlights: [],
    imageWidth: 0,
    imageHeight: 0,
  });

  const reporterRef = useRef<BugReporter | null>(null);
  const consoleCaptureRef = useRef<ConsoleCapture | null>(null);
  const breadcrumbCaptureRef = useRef<BreadcrumbCapture | null>(null);
  const userRef = useRef<UserIdentity | undefined>(user);

  // Keep userRef current without re-renders
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // SDK-08: Reuse quickCapture() instance if it was started before React
  useEffect(() => {
    const existing = getQuickCaptureInstance();
    if (existing) {
      consoleCaptureRef.current = existing;
      return; // don't stop it on unmount — it was started externally
    }

    const capture = new ConsoleCapture();
    capture.start();
    consoleCaptureRef.current = capture;

    return () => {
      capture.stop();
      consoleCaptureRef.current = null;
    };
  }, []);

  // SDK-06: Breadcrumb capture
  const memoizedBreadcrumbConfig = useMemo(() => breadcrumbConfig, [
    breadcrumbConfig === false ? false : JSON.stringify(breadcrumbConfig)
  ]);

  useEffect(() => {
    if (memoizedBreadcrumbConfig === false) return;

    const bc = new BreadcrumbCapture(
      typeof memoizedBreadcrumbConfig === "object" ? memoizedBreadcrumbConfig : {},
    );
    bc.start();
    breadcrumbCaptureRef.current = bc;

    return () => {
      bc.stop();
      breadcrumbCaptureRef.current = null;
    };
  }, [memoizedBreadcrumbConfig]);

  const availableProviders = useMemo(() => {
    return (["cloud", "linear", "jira"] as const).filter((provider) => Boolean(integrations[provider]));
  }, [integrations]);

  const hasDraft = useMemo(() => {
    if (draftMode === "video") {
      return Boolean(videoBlob);
    }

    if (draftMode === "screenshot") {
      return Boolean(screenshotBlob);
    }

    return false;
  }, [draftMode, screenshotBlob, videoBlob]);

  useEffect(() => {
    if (!videoBlob) {
      setVideoPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return null;
      });
      return;
    }

    const nextUrl = URL.createObjectURL(videoBlob);
    setVideoPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return nextUrl;
    });

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [videoBlob]);

  useEffect(() => {
    if (availableProviders.length === 0) {
      setSelectedProvider(null);
      return;
    }

    if (defaultProvider && availableProviders.includes(defaultProvider)) {
      setSelectedProvider((current) => current ?? defaultProvider);
      return;
    }

    setSelectedProvider((current) => {
      if (current && availableProviders.includes(current)) {
        return current;
      }

      return availableProviders[0];
    });
  }, [availableProviders, defaultProvider]);

  useEffect(() => {
    if (!screenshotBlob) {
      setScreenshotPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return null;
      });
      return;
    }

    const nextUrl = URL.createObjectURL(screenshotBlob);
    setScreenshotPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return nextUrl;
    });

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [screenshotBlob]);

  const handleAutoStop = useCallback(
    (artifacts: BugSessionArtifacts) => {
      setIsRecording(false);
      setElapsedMs(artifacts.elapsedMs);
      setDraftMode("video");
      setVideoBlob(artifacts.videoBlob ?? null);

      if (artifacts.stopReason === "time_limit") {
        const durationSeconds = Math.round(maxDurationMs / 1000);
        setAutoStopNotice(`Recording reached the ${durationSeconds}-second limit and stopped automatically.`);
        return;
      }

      if (artifacts.stopReason === "screen_ended") {
        setAutoStopNotice("Screen sharing ended and recording was stopped.");
      }
    },
    [maxDurationMs],
  );

  useEffect(() => {
    if (!selectedProvider) {
      return;
    }

    const integration = integrations[selectedProvider];
    if (!integration) {
      return;
    }

    if (!reporterRef.current) {
      reporterRef.current = new BugReporter({
        integration,
        maxDurationMs,
        onAutoStop: handleAutoStop,
        privacy,
      });
      return;
    }

    reporterRef.current.setIntegration(integration);
  }, [handleAutoStop, integrations, maxDurationMs, selectedProvider]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const interval = window.setInterval(() => {
      const reporter = reporterRef.current;
      if (!reporter) {
        return;
      }

      setElapsedMs(reporter.getElapsedMs());
      if (!reporter.isRecording()) {
        setIsRecording(false);
      }
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      setScreenshotPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return null;
      });

      setVideoPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return null;
      });

      if (reporterRef.current) {
        void reporterRef.current.dispose();
        reporterRef.current = null;
      }
    };
  }, []);

  const resetMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
    setAutoStopNotice(null);
  }, []);

  const clearDraft = useCallback(() => {
    reporterRef.current?.clearDraft();
    setDraftMode(null);
    setVideoBlob(null);
    setScreenshotBlob(null);
    setScreenshotAnnotation({
      annotatedBlob: null,
      highlights: [],
      imageWidth: 0,
      imageHeight: 0,
    });
    setElapsedMs(0);
  }, []);

  const getOrCreateReporter = useCallback((): BugReporter | null => {
    if (reporterRef.current) {
      return reporterRef.current;
    }

    const fallbackProvider = selectedProvider ?? availableProviders[0];
    if (!fallbackProvider) {
      return null;
    }

    const integration = integrations[fallbackProvider];
    if (!integration) {
      return null;
    }

    reporterRef.current = new BugReporter({
      integration,
      maxDurationMs,
      onAutoStop: handleAutoStop,
      privacy,
    });

    if (!selectedProvider) {
      setSelectedProvider(fallbackProvider);
    }

    return reporterRef.current;
  }, [availableProviders, handleAutoStop, integrations, maxDurationMs, selectedProvider]);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    const reporter = getOrCreateReporter();

    if (!reporter) {
      setError("No bug tracker integration is configured.");
      return false;
    }

    resetMessages();
    clearDraft();

    try {
      await reporter.start();
      setElapsedMs(0);
      setIsRecording(true);
      setDraftMode("video");
      return true;
    } catch (error) {
      setIsRecording(false);
      setError(toErrorMessage(error));
      return false;
    }
  }, [clearDraft, getOrCreateReporter, resetMessages]);

  const stopRecording = useCallback(async (): Promise<boolean> => {
    const reporter = reporterRef.current;

    if (!reporter) {
      return false;
    }

    try {
      const artifacts = await reporter.stop();
      setElapsedMs(artifacts?.elapsedMs ?? reporter.getElapsedMs());
      setIsRecording(false);

      if (artifacts?.videoBlob) {
        setDraftMode("video");
        setVideoBlob(artifacts.videoBlob);
        return true;
      }

      return false;
    } catch (error) {
      setError(toErrorMessage(error));
      return false;
    }
  }, []);

  const startRegionSelection = useCallback(() => {
    if (isRecording) {
      return;
    }

    resetMessages();
    setIsSelectingRegion(true);
  }, [isRecording, resetMessages]);

  const cancelRegionSelection = useCallback(() => {
    setIsSelectingRegion(false);
  }, []);

  const handleRegionSelected = useCallback(
    async (region: CaptureRegion) => {
      setIsSelectingRegion(false);

      const reporter = getOrCreateReporter();
      if (!reporter) {
        setError("No bug tracker integration is configured.");
        return;
      }

      resetMessages();
      clearDraft();
      setIsCapturingScreenshot(true);

      try {
        const artifacts = await reporter.captureScreenshot(region);

        if (!artifacts.screenshotBlob) {
          throw new Error("Region screenshot returned no image.");
        }

        setDraftMode("screenshot");
        setScreenshotBlob(artifacts.screenshotBlob);
        setScreenshotAnnotation({
          annotatedBlob: null,
          highlights: [],
          imageWidth: 0,
          imageHeight: 0,
        });
        setElapsedMs(artifacts.elapsedMs);
        setIsRecording(false);
        setAutoStopNotice(null);
        setIsOpen(true);
      } catch (error) {
        setError(toErrorMessage(error));
      } finally {
        setIsCapturingScreenshot(false);
      }
    },
    [clearDraft, getOrCreateReporter, resetMessages],
  );

  const captureQuickScreenshot = useCallback(async (): Promise<boolean> => {
    const reporter = getOrCreateReporter();

    if (!reporter) {
      setError("No bug tracker integration is configured.");
      return false;
    }

    if (isRecording) {
      const stopped = await stopRecording();
      if (!stopped) {
        return false;
      }
    }

    resetMessages();
    clearDraft();
    setIsCapturingScreenshot(true);

    try {
      const artifacts = await reporter.captureScreenshot();

      if (!artifacts.screenshotBlob) {
        throw new Error("Quick screenshot returned no image.");
      }

      setDraftMode("screenshot");
      setScreenshotBlob(artifacts.screenshotBlob);
      setScreenshotAnnotation({
        annotatedBlob: null,
        highlights: [],
        imageWidth: 0,
        imageHeight: 0,
      });
      setElapsedMs(artifacts.elapsedMs);
      setIsRecording(false);
      setAutoStopNotice(null);
      return true;
    } catch (error) {
      setError(toErrorMessage(error));
      return false;
    } finally {
      setIsCapturingScreenshot(false);
    }
  }, [clearDraft, getOrCreateReporter, isRecording, resetMessages, stopRecording]);

  const updateScreenshotAnnotation = useCallback((annotation: ScreenshotAnnotationState) => {
    setScreenshotAnnotation(annotation);
  }, []);

  // Helper: collect shared submission data
  const collectSubmissionExtras = useCallback(() => {
    const { consoleLogs, jsErrors } = consoleCaptureRef.current?.snapshot() ?? {
      consoleLogs: [],
      jsErrors: [],
    };
    const breadcrumbEntries: BreadcrumbEntry[] = breadcrumbCaptureRef.current?.snapshot() ?? [];
    return { consoleLogs, jsErrors, breadcrumbs: breadcrumbEntries, user: userRef.current };
  }, []);

  const submitReport = useCallback(
    async (
      title: string,
      structuredFields: {
        stepsToReproduce: string;
        expectedResult: string;
        actualResult: string;
        additionalContext: string;
      }
    ) => {
      const reporter = getOrCreateReporter();

      if (!reporter) {
        setError("No bug tracker integration is configured.");
        return null;
      }

      if (!selectedProvider || !integrations[selectedProvider]) {
        setError("Select a bug tracker provider before submitting.");
        return null;
      }

      const artifacts = reporter.getLastArtifacts();

      if (!artifacts || !draftMode || artifacts.captureMode !== draftMode) {
        setError("Capture evidence first, then tag and submit.");
        return null;
      }

      reporter.setIntegration(integrations[selectedProvider]!);

      setIsSubmitting(true);
      setSubmissionProgress("Preparing submission…");
      setError(null);
      setSuccess(null);

      // Build concatenated description from structured fields for backward compatibility
      const { stepsToReproduce, expectedResult, actualResult, additionalContext } = structuredFields;
      const sections: string[] = [];

      if (stepsToReproduce.trim()) {
        sections.push(`## Steps to Reproduce\n${stepsToReproduce.trim()}`);
      }
      if (expectedResult.trim()) {
        sections.push(`## Expected Result\n${expectedResult.trim()}`);
      }
      if (actualResult.trim()) {
        sections.push(`## Actual Result\n${actualResult.trim()}`);
      }
      if (additionalContext.trim()) {
        sections.push(`## Additional Context\n${additionalContext.trim()}`);
      }

      const description = sections.length > 0 ? sections.join('\n\n') : 'No description provided';

      const screenshotBlobForSubmit =
        draftMode === "screenshot" ? screenshotAnnotation.annotatedBlob ?? screenshotBlob : null;

      const metadata: Partial<BugClientMetadata> = {
        annotation:
          draftMode === "screenshot" && screenshotAnnotation.highlights.length > 0
            ? {
                imageWidth: screenshotAnnotation.imageWidth,
                imageHeight: screenshotAnnotation.imageHeight,
                highlights: screenshotAnnotation.highlights,
              }
            : undefined,
      };

      const extras = collectSubmissionExtras();

      try {
        const result = await reporter.submit(title, description, {
          stepsToReproduce,
          expectedResult,
          actualResult,
          additionalContext,
          screenshotBlob: screenshotBlobForSubmit,
          metadata,
          consoleLogs: extras.consoleLogs,
          jsErrors: extras.jsErrors,
          breadcrumbs: extras.breadcrumbs,
          user: extras.user,
          onProgress: setSubmissionProgress,
        });

        if (result.provider === "cloud" && !result.issueUrl) {
          setSuccess("Report received by QuickBugs Cloud. Tracker forwarding is running in the background.");
        } else {
          setSuccess(`Submitted to ${getProviderLabel(result.provider)} (${result.issueKey}).`);
        }
        clearDraft();
        setIsOpen(false);
        return result;
      } catch (error) {
        setError(toErrorMessage(error));
        return null;
      } finally {
        setIsSubmitting(false);
        setSubmissionProgress(null);
      }
    },
    [
      clearDraft,
      collectSubmissionExtras,
      draftMode,
      getOrCreateReporter,
      integrations,
      screenshotAnnotation,
      screenshotBlob,
      selectedProvider,
    ],
  );

  // SDK-07: Headless capture and submit
  const captureAndSubmit = useCallback(
    async (options: HeadlessCaptureOptions): Promise<HeadlessCaptureResult> => {
      const reporter = getOrCreateReporter();
      if (!reporter) {
        return { success: false, reportId: "", externalIssueUrl: null };
      }

      const captureMode = options.captureMode ?? "none";
      let screenshotBlobHeadless: Blob | null = null;

      if (captureMode === "screenshot") {
        try {
          const artifacts = await reporter.captureScreenshot();
          screenshotBlobHeadless = artifacts.screenshotBlob;
        } catch {
          // continue without screenshot
        }
      }

      const extras = collectSubmissionExtras();

      try {
        // For headless mode, we need artifacts. Create a minimal one if we don't have any.
        if (!reporter.getLastArtifacts()) {
          // Trigger a minimal screenshot capture to create artifacts, but skip if mode is "none"
          if (captureMode !== "screenshot" && captureMode !== "none") {
            await reporter.captureScreenshot().catch(() => {});
          }
        }

        const result = await reporter.submit(
          options.title,
          options.description ?? "",
          {
            screenshotBlob: screenshotBlobHeadless,
            consoleLogs: extras.consoleLogs,
            jsErrors: extras.jsErrors,
            breadcrumbs: extras.breadcrumbs,
            user: extras.user,
          },
        );

        return {
          success: true,
          reportId: result.issueId,
          externalIssueUrl: result.issueUrl,
        };
      } catch {
        return { success: false, reportId: "", externalIssueUrl: null };
      }
    },
    [collectSubmissionExtras, getOrCreateReporter],
  );

  const value = useMemo<BugReporterContextValue>(
    () => ({
      isOpen,
      openModal,
      closeModal,
      draftMode,
      hasDraft,
      isRecording,
      elapsedMs,
      maxDurationMs,
      isSubmitting,
      submissionProgress,
      isCapturingScreenshot,
      isSelectingRegion,
      error,
      success,
      autoStopNotice,
      availableProviders,
      selectedProvider,
      setSelectedProvider,
      startRecording,
      stopRecording,
      captureQuickScreenshot,
      startRegionSelection,
      videoPreviewUrl,
      screenshotPreviewUrl,
      screenshotHighlightCount: screenshotAnnotation.highlights.length,
      updateScreenshotAnnotation,
      clearDraft,
      submitReport,
      resetMessages,
      captureAndSubmit,
    }),
    [
      autoStopNotice,
      availableProviders,
      captureAndSubmit,
      captureQuickScreenshot,
      clearDraft,
      closeModal,
      draftMode,
      elapsedMs,
      error,
      hasDraft,
      isCapturingScreenshot,
      isOpen,
      isRecording,
      isSelectingRegion,
      isSubmitting,
      submissionProgress,
      maxDurationMs,
      openModal,
      resetMessages,
      screenshotAnnotation.highlights.length,
      startRegionSelection,
      videoPreviewUrl,
      screenshotPreviewUrl,
      selectedProvider,
      startRecording,
      stopRecording,
      submitReport,
      success,
      updateScreenshotAnnotation,
    ],
  );

  return (
    <BugReporterContext.Provider value={value}>
      {children}
      {isSelectingRegion && (
        <RegionSelector
          onSelect={(region) => void handleRegionSelected(region)}
          onCancel={cancelRegionSelection}
        />
      )}
    </BugReporterContext.Provider>
  );
}

export function useBugReporter(): BugReporterContextValue {
  const context = useContext(BugReporterContext);

  if (!context) {
    throw new Error("useBugReporter must be used within BugReporterProvider.");
  }

  return context;
}