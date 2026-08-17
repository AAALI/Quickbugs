"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CaptureRegion } from "@quick-bug-reporter/core";

type RegionSelectorProps = {
  onSelect: (region: CaptureRegion) => void;
  onCancel: () => void;
};

type Point = { x: number; y: number };

export function RegionSelector({ onSelect, onCancel }: RegionSelectorProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getRect = useCallback((): CaptureRegion | null => {
    if (!start || !current) {
      return null;
    }

    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    if (width < 8 || height < 8) {
      return null;
    }

    return { x, y, width, height };
  }, [start, current]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    setStart(point);
    setCurrent(point);
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }

    setCurrent({ x: event.clientX, y: event.clientY });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);

    const finalPoint = { x: event.clientX, y: event.clientY };
    setCurrent(finalPoint);

    const sX = start?.x ?? 0;
    const sY = start?.y ?? 0;
    const x = Math.min(sX, finalPoint.x);
    const y = Math.min(sY, finalPoint.y);
    const width = Math.abs(finalPoint.x - sX);
    const height = Math.abs(finalPoint.y - sY);

    if (width >= 8 && height >= 8) {
      onSelect({ x, y, width, height });
    } else {
      onCancel();
    }
  };

  const rect = getRect();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1200] cursor-crosshair"
      data-bug-reporter-ui="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Dimmed background */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Selection rectangle cutout */}
      {rect && (
        <>
          {/* Clear rectangle */}
          <div
            className="absolute border-2 border-dashed border-white bg-white/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
          />
          {/* Dimension label */}
          <div
            className="absolute rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white"
            style={{
              left: rect.x,
              top: rect.y + rect.height + 6,
            }}
          >
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </div>
        </>
      )}

      {/* Instructions */}
      {!isDragging && !rect && (
        <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-xl bg-black/70 px-5 py-3 text-sm font-medium text-white shadow-lg">
          Drag to select an area · Press <kbd className="rounded border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-xs">Esc</kbd> to cancel
        </div>
      )}
    </div>
  );
}
