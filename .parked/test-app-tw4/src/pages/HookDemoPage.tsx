import { useState } from "react";
import { useBugReporter } from "quick-bug-reporter-react";
import {
  Camera,
  Video,
  Square,
  Send,
  Trash2,
  Crop,
  Loader2,
} from "lucide-react";
import { CodeBlock } from "../components/CodeBlock.tsx";

const hookCode = `import { useBugReporter } from "quick-bug-reporter-react";

function MyBugUI() {
  const {
    // State
    isRecording,
    elapsedMs,
    hasDraft,
    draftMode,
    isSubmitting,
    submissionProgress,
    isCapturingScreenshot,
    error,
    success,
    videoPreviewUrl,
    screenshotPreviewUrl,
    availableProviders,
    selectedProvider,

    // Actions
    startRecording,
    stopRecording,
    captureQuickScreenshot,
    startRegionSelection,
    clearDraft,
    submitReport,
    setSelectedProvider,
    openModal,
    closeModal,
  } = useBugReporter();

  // Build your own UI with these!
}`;

export function HookDemoPage() {
  const {
    isRecording,
    elapsedMs,
    hasDraft,
    draftMode,
    isSubmitting,
    submissionProgress,
    isCapturingScreenshot,
    error,
    success,
    videoPreviewUrl,
    screenshotPreviewUrl,
    availableProviders,
    selectedProvider,
    setSelectedProvider,
    startRecording,
    stopRecording,
    captureQuickScreenshot,
    startRegionSelection,
    clearDraft,
    submitReport,
  } = useBugReporter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const elapsed = `${String(Math.floor(elapsedMs / 60000)).padStart(2, "0")}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, "0")}`;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const result = await submitReport(title, description);
    if (result) {
      setTitle("");
      setDescription("");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Hook Demo</h1>
        <p className="mt-2 text-gray-500">
          Build a completely custom bug reporting UI using the{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-indigo-700">useBugReporter()</code> hook.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Hook API</h2>
        <CodeBlock code={hookCode} title="useBugReporter()" />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Live Custom UI</h2>
        <p className="text-sm text-gray-500">
          This entire UI below is built with <code className="rounded bg-gray-100 px-1.5 py-0.5 text-indigo-700">useBugReporter()</code> — no FloatingBugButton or BugReporterModal.
        </p>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Status bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-medium ${isRecording ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
              {isRecording ? `Recording ${elapsed}` : "Idle"}
            </span>
            {hasDraft && (
              <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-700">
                Draft: {draftMode}
              </span>
            )}
            {isCapturingScreenshot && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
                Capturing…
              </span>
            )}
            {isSubmitting && (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-700">
                <Loader2 className="size-3 animate-spin" />
                {submissionProgress || "Submitting…"}
              </span>
            )}
          </div>

          {/* Capture actions */}
          <div className="mb-4 flex flex-wrap gap-2">
            {!isRecording ? (
              <>
                <button
                  onClick={() => void captureQuickScreenshot()}
                  disabled={isCapturingScreenshot}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Camera className="size-4" /> Screenshot
                </button>
                <button
                  onClick={() => void startRegionSelection()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  <Crop className="size-4" /> Region
                </button>
                <button
                  onClick={() => void startRecording()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  <Video className="size-4" /> Record
                </button>
              </>
            ) : (
              <button
                onClick={() => void stopRecording()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                <Square className="size-4" /> Stop Recording
              </button>
            )}
            {hasDraft && (
              <button
                onClick={clearDraft}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Trash2 className="size-4" /> Clear Draft
              </button>
            )}
          </div>

          {/* Preview */}
          {screenshotPreviewUrl && (
            <div className="mb-4">
              <p className="mb-1 text-xs font-medium text-gray-500">Screenshot Preview</p>
              <img
                src={screenshotPreviewUrl}
                alt="Screenshot preview"
                className="max-h-48 rounded-lg border border-gray-200 object-contain"
              />
            </div>
          )}
          {videoPreviewUrl && (
            <div className="mb-4">
              <p className="mb-1 text-xs font-medium text-gray-500">Video Preview</p>
              <video
                src={videoPreviewUrl}
                controls
                className="max-h-48 rounded-lg border border-gray-200"
              />
            </div>
          )}

          {/* Submit form */}
          {hasDraft && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Provider</label>
                <div className="flex gap-2">
                  {availableProviders.map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedProvider(p)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        selectedProvider === p
                          ? "bg-indigo-600 text-white"
                          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {p === "linear" ? "Linear" : "Jira"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Bug title…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the bug…"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => void handleSubmit()}
                disabled={isSubmitting || !title.trim() || !selectedProvider}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="size-4" /> Submit Report
              </button>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
              {success}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
