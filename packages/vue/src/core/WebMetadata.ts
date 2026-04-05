import type { BugClientMetadata } from "@quick-bug-reporter/core";

/**
 * Collects runtime client/browser environment metadata for bug reports.
 *
 * Gathers locale and language information, resolved timezone (when available), platform and referrer,
 * preferred color scheme (`"light" | "dark" | "unknown"`), viewport and screen metrics, device capabilities
 * (CPU cores, device memory in GB, touch points, online and cookie support), and network connection details
 * (effective type, downlink Mbps, RTT ms, save-data preference). Fields are populated with concrete values
 * when available and set to `null` when unavailable or when executed outside a browser environment.
 *
 * @returns An object containing `locale`, `timezone`, `language`, `languages`, `platform`, `referrer`, `colorScheme`,
 *          `viewport`, `screen`, `device`, and `connection` populated with the collected metadata or `null`/empty arrays
 *          where values cannot be determined.
 */
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
    mozConnection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    webkitConnection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    deviceMemory?: number;
    userAgentData?: { platform?: string };
  };

  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

  let colorScheme: "light" | "dark" | "unknown" = "unknown";
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) colorScheme = "dark";
    else if (window.matchMedia("(prefers-color-scheme: light)").matches) colorScheme = "light";
  }

  let timezone: string | null = null;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { timezone = null; }

  return {
    locale: typeof navigator.language === "string" ? navigator.language : null,
    timezone,
    language: typeof navigator.language === "string" ? navigator.language : null,
    languages: Array.isArray(navigator.languages) ? [...navigator.languages] : [],
    platform: (typeof nav.userAgentData?.platform === "string" && nav.userAgentData.platform) || (typeof navigator.platform === "string" ? navigator.platform : null),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    colorScheme,
    viewport: {
      width: typeof window.innerWidth === "number" ? window.innerWidth : null,
      height: typeof window.innerHeight === "number" ? window.innerHeight : null,
      pixelRatio: typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : null,
    },
    screen: {
      width: typeof window.screen?.width === "number" ? window.screen.width : null,
      height: typeof window.screen?.height === "number" ? window.screen.height : null,
      availWidth: typeof window.screen?.availWidth === "number" ? window.screen.availWidth : null,
      availHeight: typeof window.screen?.availHeight === "number" ? window.screen.availHeight : null,
      colorDepth: typeof window.screen?.colorDepth === "number" ? window.screen.colorDepth : null,
    },
    device: {
      hardwareConcurrency: typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null,
      deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
      maxTouchPoints: typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : null,
      online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
      cookieEnabled: typeof navigator.cookieEnabled === "boolean" ? navigator.cookieEnabled : null,
    },
    connection: {
      effectiveType: typeof connection?.effectiveType === "string" ? connection.effectiveType : null,
      downlinkMbps: typeof connection?.downlink === "number" ? connection.downlink : null,
      rttMs: typeof connection?.rtt === "number" ? connection.rtt : null,
      saveData: typeof connection?.saveData === "boolean" ? connection.saveData : null,
    },
  };
}
