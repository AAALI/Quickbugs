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
import type { CaptureRegion } from "../core/ScreenshotCapturer";
import {
  ConsoleCapture,
  BugClientMetadata,
  BugSessionArtifacts,
  BugSubmitResult,
  BugTrackerProvider,
  DEFAULT_MAX_RECORDING_MS,
  ReportCaptureMode,
  ScreenshotHighlightRegion,
  toErrorMessage,
  type BugReporterIntegrations,
} from "@quick-bug-reporter/core";
import { RegionSelector } from "./RegionSelector";

type BugReporterProviderProps = {
  children: ReactNode;
  integrations: BugReporterIntegrations;
  defaultProvider?: BugTrackerProvider;
  maxDurationMs?: number;
};

type ScreenshotAnnotationState = {
  annotatedBlob: Blob | null;
  highlights: ScreenshotHighlightRegion[];
  imageWidth: number;
  imageHeight: number;
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
  submitReport: (title: string, description: string) => Promise<BugSubmitResult | null>;
  resetMessages: () => void;
};

const BugReporterContext = createContext<BugReporterContextValue | null>(null);

function getProviderLabel(provider: BugTrackerProvider): string {
  if (provider === "linear") return "Linear";
  if (provider === "jira") return "Jira";
  if (provider === "cloud") return "QuickBugs Cloud";
  return provider;
}

export function BugReporterProvider({
  children,
  integrations,
  defaultProvider,
  maxDurationMs = DEFAULT_MAX_RECORDING_MS,
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

  useEffect(() => {
    const capture = new ConsoleCapture();
    capture.start();
    consoleCaptureRef.current = capture;

    return () => {
      capture.stop();
      consoleCaptureRef.current = null;
    };
  }, []);

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

  const submitReport = useCallback(
    async (title: string, description: string) => {
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

      const { consoleLogs, jsErrors } = consoleCaptureRef.current?.snapshot() ?? {
        consoleLogs: [],
        jsErrors: [],
      };

      try {
        const result = await reporter.submit(title, description, {
          screenshotBlob: screenshotBlobForSubmit,
          metadata,
          consoleLogs,
          jsErrors,
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
      draftMode,
      getOrCreateReporter,
      integrations,
      screenshotAnnotation,
      screenshotBlob,
      selectedProvider,
    ],
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
    }),
    [
      autoStopNotice,
      availableProviders,
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
