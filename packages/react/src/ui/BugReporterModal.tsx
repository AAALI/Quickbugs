"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, CircleDot, Crop } from "lucide-react";

import { Button } from "./primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./primitives/dialog";
import { Input } from "./primitives/input";
import { Textarea } from "./primitives/textarea";

import { BugTrackerProvider } from "@quick-bug-reporter/core";
import { ScreenshotAnnotator } from "./ScreenshotAnnotator";
import { useBugReporter } from "./BugReporterProvider";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function providerLabel(provider: BugTrackerProvider): string {
  if (provider === "linear") return "Linear";
  if (provider === "jira") return "Jira";
  if (provider === "cloud") return "QuickBugs Cloud";
  return provider;
}

type WizardStep = "review" | "context";

export function BugReporterModal() {
  const {
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
    isSubmitting,
    submissionProgress,
    openModal,
    resetMessages,
    screenshotHighlightCount,
    screenshotPreviewUrl,
    selectedProvider,
    setSelectedProvider,
    startRecording,
    startRegionSelection,
    submitReport,
    success,
    updateScreenshotAnnotation,
    videoPreviewUrl,
  } = useBugReporter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<WizardStep>("review");

  const elapsedLabel = useMemo(() => formatElapsed(elapsedMs), [elapsedMs]);

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      openModal();
      return;
    }

    closeModal();
    setStep("review");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = await submitReport(title, description);
    if (result) {
      setTitle("");
      setDescription("");
      setStep("review");
    }
  };

  const hasIntegrations = availableProviders.length > 0;

  const canSubmit =
    !isSubmitting &&
    !isCapturingScreenshot &&
    hasIntegrations &&
    !!selectedProvider &&
    hasDraft &&
    title.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        data-bug-reporter-ui="true"
        showCloseButton={!isSubmitting}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* ── Step 1: Review capture ── */}
          {step === "review" ? (
            <>
              <DialogHeader>
                <DialogTitle>Review capture</DialogTitle>
                <DialogDescription>
                  Step 1 of 2. Review your {draftMode === "video" ? "video" : "screenshot"}, annotate if needed, or retake.
                </DialogDescription>
              </DialogHeader>

              {!hasDraft ? (
                <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-100/20 px-4 py-3 text-sm">
                  <p className="font-medium">No capture draft yet</p>
                  <p className="text-gray-500">
                    Start from the Report Bug button and choose Quick screenshot or Record flow first.
                  </p>
                </div>
              ) : draftMode === "screenshot" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-gray-500">
                      Drag on the image to highlight exactly where the issue appears.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        className="gap-2"
                        disabled={isSubmitting || isCapturingScreenshot}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => {
                          closeModal();
                          void captureQuickScreenshot().then(() => openModal());
                        }}
                      >
                        <Camera className="size-4" />
                        Full page
                      </Button>
                      <Button
                        className="gap-2"
                        disabled={isSubmitting || isCapturingScreenshot}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => {
                          closeModal();
                          startRegionSelection();
                        }}
                      >
                        <Crop className="size-4" />
                        Select area
                      </Button>
                    </div>
                  </div>

                  {screenshotPreviewUrl ? (
                    <ScreenshotAnnotator
                      key={screenshotPreviewUrl}
                      imageUrl={screenshotPreviewUrl}
                      onChange={updateScreenshotAnnotation}
                    />
                  ) : null}

                  <p className="text-xs text-gray-500">Highlights added: {screenshotHighlightCount}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-gray-500">
                      Duration: {elapsedLabel}. Screen + microphone attached.
                    </p>
                    <Button
                      className="gap-2"
                      disabled={isSubmitting || isCapturingScreenshot}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        closeModal();
                        void startRecording();
                      }}
                    >
                      <CircleDot className="size-4" />
                      Record again
                    </Button>
                  </div>

                  {videoPreviewUrl ? (
                    <video
                      className="w-full rounded-lg border border-gray-200 bg-black"
                      controls
                      playsInline
                      preload="metadata"
                      src={videoPreviewUrl}
                    />
                  ) : null}

                  <p className="text-xs text-amber-700">
                    Video recording uses the browser share prompt each time by web platform design.
                  </p>
                </div>
              )}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <DialogFooter>
                <Button
                  disabled={isSubmitting || isCapturingScreenshot}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    clearDraft();
                    resetMessages();
                    closeModal();
                    setStep("review");
                  }}
                >
                  Discard draft
                </Button>

                <Button
                  className="gap-2"
                  disabled={!hasDraft || isCapturingScreenshot}
                  type="button"
                  onClick={() => { resetMessages(); setStep("context"); }}
                >
                  Next
                  <ArrowRight className="size-4" />
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* ── Step 2: Add context & submit ── */
            <>
              <DialogHeader>
                <DialogTitle>Add context</DialogTitle>
                <DialogDescription>
                  Step 2 of 2. Describe the issue and submit. Metadata and network logs are attached automatically.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="bug-title">
                    Title
                  </label>
                  <Input
                    id="bug-title"
                    maxLength={140}
                    placeholder="Short summary of the bug"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="bug-description">
                    Quick note
                  </label>
                  <Textarea
                    id="bug-description"
                    maxLength={4000}
                    placeholder="What did you expect, what happened, and any quick repro steps."
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="bug-provider">
                    Submit to
                  </label>
                  <select
                    id="bug-provider"
                    className="bg-gray-100/30 border-gray-300 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/50 h-9 w-full rounded-4xl border px-3 text-sm text-gray-900 outline-none focus-visible:ring-[3px]"
                    disabled={isSubmitting || isCapturingScreenshot || !hasIntegrations}
                    value={selectedProvider ?? ""}
                    onChange={(event) => setSelectedProvider(event.target.value as BugTrackerProvider)}
                  >
                    {availableProviders.map((provider) => (
                      <option key={provider} value={provider}>
                        {providerLabel(provider)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-100/20 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Capture</span>
                    <span className="text-gray-500">
                      {draftMode === "screenshot" ? "Screenshot" : draftMode === "video" ? "Video" : "None"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {draftMode === "screenshot"
                      ? `${screenshotHighlightCount} highlight${screenshotHighlightCount === 1 ? "" : "s"} added`
                      : draftMode === "video"
                        ? `Duration: ${elapsedLabel}`
                        : "Missing capture"}
                  </p>
                </div>
              </div>

              {autoStopNotice ? <p className="text-sm text-amber-700">{autoStopNotice}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

              <DialogFooter>
                <Button
                  className="gap-2"
                  disabled={isSubmitting}
                  type="button"
                  variant="outline"
                  onClick={() => { resetMessages(); setStep("review"); }}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>

                <Button disabled={!canSubmit} type="submit">
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {submissionProgress || "Submitting…"}
                    </span>
                  ) : (
                    `Submit to ${selectedProvider ? providerLabel(selectedProvider) : "tracker"}`
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
