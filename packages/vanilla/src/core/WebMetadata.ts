import type { BugClientMetadata } from "@quick-bug-reporter/core";

export function collectClientEnvironmentMetadata(): Omit<BugClientMetadata, "captureMode" | "capture"> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      locale: null, timezone: null, language: null, languages: [],
      platform: null, referrer: null, colorScheme: "unknown",
      viewport: { width: null, height: null, pixelRatio: null },
      screen: { width: null, height: null, availWidth: null, availHeight: null, colorDepth: null },
      device: { hardwareConcurrency: null, deviceMemoryGb: null, maxTouchPoints: null, online: null, cookieEnabled: null },
      connection: { effectiveType: null, downlinkMbps: null, rttMs: null, saveData: null },
    };
  }

  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    deviceMemory?: number;
    userAgentData?: { platform?: string };
  };
  const conn = nav.connection;
  let colorScheme: "light" | "dark" | "unknown" = "unknown";
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) colorScheme = "dark";
    else if (window.matchMedia("(prefers-color-scheme: light)").matches) colorScheme = "light";
  }
  let timezone: string | null = null;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { /* noop */ }

  return {
    locale: navigator.language ?? null, timezone,
    language: navigator.language ?? null,
    languages: Array.isArray(navigator.languages) ? [...navigator.languages] : [],
    platform: nav.userAgentData?.platform ?? navigator.platform ?? null,
    referrer: document.referrer || null, colorScheme,
    viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio },
    screen: { width: window.screen?.width ?? null, height: window.screen?.height ?? null, availWidth: window.screen?.availWidth ?? null, availHeight: window.screen?.availHeight ?? null, colorDepth: window.screen?.colorDepth ?? null },
    device: { hardwareConcurrency: navigator.hardwareConcurrency ?? null, deviceMemoryGb: nav.deviceMemory ?? null, maxTouchPoints: navigator.maxTouchPoints ?? null, online: navigator.onLine ?? null, cookieEnabled: navigator.cookieEnabled ?? null },
    connection: { effectiveType: conn?.effectiveType ?? null, downlinkMbps: conn?.downlink ?? null, rttMs: conn?.rtt ?? null, saveData: conn?.saveData ?? null },
  };
}
