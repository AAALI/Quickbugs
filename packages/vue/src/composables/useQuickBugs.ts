import { inject, type InjectionKey, type Ref } from "vue";
import type {
  BugTrackerProvider,
  BugSubmitResult,
  ReportCaptureMode,
  ScreenshotHighlightRegion,
} from "@quick-bug-reporter/core";

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

export type QuickBugsContext = {
  isOpen: Ref<boolean>;
  openModal: () => void;
  closeModal: () => void;
  draftMode: Ref<ReportCaptureMode | null>;
  hasDraft: Ref<boolean>;
  isRecording: Ref<boolean>;
  elapsedMs: Ref<number>;
  maxDurationMs: number;
  isSubmitting: Ref<boolean>;
  submissionProgress: Ref<string | null>;
  isCapturingScreenshot: Ref<boolean>;
  isSelectingRegion: Ref<boolean>;
  error: Ref<string | null>;
  success: Ref<string | null>;
  autoStopNotice: Ref<string | null>;
  availableProviders: Ref<BugTrackerProvider[]>;
  selectedProvider: Ref<BugTrackerProvider | null>;
  setSelectedProvider: (provider: BugTrackerProvider) => void;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<boolean>;
  captureQuickScreenshot: () => Promise<boolean>;
  startRegionSelection: () => void;
  cancelRegionSelection: () => void;
  videoPreviewUrl: Ref<string | null>;
  screenshotPreviewUrl: Ref<string | null>;
  screenshotHighlightCount: Ref<number>;
  updateScreenshotAnnotation: (annotation: {
    annotatedBlob: Blob | null;
    highlights: ScreenshotHighlightRegion[];
    imageWidth: number;
    imageHeight: number;
  }) => void;
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
  captureAndSubmit: (options: HeadlessCaptureOptions) => Promise<HeadlessCaptureResult>;
};

export const QuickBugsKey: InjectionKey<QuickBugsContext> = Symbol("QuickBugs");

/**
 * Retrieves the QuickBugs context from the current Vue injection scope.
 *
 * @returns The injected `QuickBugsContext`.
 * @throws Error if called outside a `<QuickBugsProvider>`.
 */
export function useQuickBugs(): QuickBugsContext {
  const context = inject(QuickBugsKey);
  if (!context) {
    throw new Error("useQuickBugs() must be used inside <QuickBugsProvider>.");
  }
  return context;
}
