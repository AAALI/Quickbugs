"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CircleDot, Crop, FilePenLine, Square, TriangleAlert } from "lucide-react";

import { Button } from "./primitives/button";

import { useBugReporter } from "./BugReporterProvider";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function FloatingBugButton() {
  const {
    availableProviders,
    captureQuickScreenshot,
    draftMode,
    elapsedMs,
    hasDraft,
    isCapturingScreenshot,
    isRecording,
    isSelectingRegion,
    maxDurationMs,
    openModal,
    startRecording,
    startRegionSelection,
    stopRecording,
  } = useBugReporter();

  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const elapsed = useMemo(() => formatElapsed(elapsedMs), [elapsedMs]);
  const maxElapsed = useMemo(() => formatElapsed(maxDurationMs), [maxDurationMs]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!containerRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  if (availableProviders.length === 0) {
    return null;
  }

  const handleQuickScreenshot = async () => {
    setMenuOpen(false);
    await captureQuickScreenshot();
    openModal();
  };

  const handleStartRecording = async () => {
    setMenuOpen(false);
    await startRecording();
  };

  const handleStopRecording = async () => {
    const ok = await stopRecording();
    if (ok) {
      openModal();
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 1100 }}
      className="flex flex-col items-end"
      data-bug-reporter-ui="true"
    >
      {isRecording ? (
        <div className="space-y-2">
          <Button className="h-11 gap-2 rounded-full px-4 shadow-lg shadow-black/20" type="button" variant="destructive" onClick={() => void handleStopRecording()}>
            <Square className="size-4" />
            Stop recording
          </Button>
          <p className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-700">
            Recording {elapsed} / {maxElapsed}
          </p>
        </div>
      ) : (
        <>
          {menuOpen ? (
            <div className="mb-2 w-72 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl" data-bug-reporter-ui="true">
              <Button
                className="h-10 w-full justify-start gap-2 rounded-xl"
                disabled={isCapturingScreenshot || isSelectingRegion}
                type="button"
                variant="ghost"
                onClick={() => void handleQuickScreenshot()}
              >
                <Camera className="size-4" />
                Full page screenshot
              </Button>

              <Button
                className="h-10 w-full justify-start gap-2 rounded-xl"
                disabled={isCapturingScreenshot || isSelectingRegion}
                type="button"
                variant="ghost"
                onClick={() => {
                  setMenuOpen(false);
                  startRegionSelection();
                }}
              >
                <Crop className="size-4" />
                Select area
              </Button>

              <Button
                className="h-10 w-full justify-start gap-2 rounded-xl"
                disabled={isCapturingScreenshot || isSelectingRegion}
                type="button"
                variant="ghost"
                onClick={() => void handleStartRecording()}
              >
                <CircleDot className="size-4" />
                Record flow video
              </Button>

              {hasDraft ? (
                <Button
                  className="h-10 w-full justify-start gap-2 rounded-xl"
                  disabled={isCapturingScreenshot || isSelectingRegion}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMenuOpen(false);
                    openModal();
                  }}
                >
                  <FilePenLine className="size-4" />
                  Continue draft
                  <span className="ml-auto text-xs text-gray-500">
                    {draftMode === "screenshot" ? "Screenshot" : "Video"}
                  </span>
                </Button>
              ) : null}
            </div>
          ) : null}

          <Button
            className="h-11 gap-2 rounded-full px-4 shadow-lg shadow-black/15"
            disabled={isCapturingScreenshot || isSelectingRegion}
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span className="relative inline-flex items-center">
              <TriangleAlert className="size-4" />
              {hasDraft ? (
                <span
                  aria-hidden
                  className="absolute -right-1.5 -top-1.5 inline-flex size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.2)]"
                />
              ) : null}
            </span>
            Report Bug
          </Button>
        </>
      )}
    </div>
  );
}
