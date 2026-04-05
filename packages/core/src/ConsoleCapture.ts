const MAX_CONSOLE_ENTRIES = 200;
const MAX_ERROR_ENTRIES = 50;
const MAX_ARG_LENGTH = 1000;

// SDK-08: Singleton for boot-time capture
let quickCaptureInstance: ConsoleCapture | null = null;

/**
 * Create and start a singleton ConsoleCapture to capture console output and JavaScript errors early in app startup.
 *
 * Subsequent calls return the same started instance.
 *
 * @returns The singleton ConsoleCapture instance that was created and started
 */
export function quickCapture(): ConsoleCapture {
  if (quickCaptureInstance) return quickCaptureInstance;
  quickCaptureInstance = new ConsoleCapture();
  quickCaptureInstance.start();
  return quickCaptureInstance;
}

/**
 * Get the current boot-time ConsoleCapture singleton instance.
 *
 * @returns The active `ConsoleCapture` instance, or `null` if none has been started.
 */
export function getQuickCaptureInstance(): ConsoleCapture | null {
  return quickCaptureInstance;
}

export type ConsoleLogEntry = {
  level: "log" | "info" | "warn" | "error";
  timestamp: string;
  args: string[];
};

export type CapturedJsError = {
  timestamp: string;
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  type: "error" | "unhandledrejection";
};

function serializeArg(arg: unknown): string {
  if (typeof arg === "string") {
    return arg.length > MAX_ARG_LENGTH ? arg.slice(0, MAX_ARG_LENGTH) + "…" : arg;
  }

  try {
    const json = JSON.stringify(arg);
    return json.length > MAX_ARG_LENGTH ? json.slice(0, MAX_ARG_LENGTH) + "…" : json;
  } catch {
    return String(arg);
  }
}

export class ConsoleCapture {
  private consoleLogs: ConsoleLogEntry[] = [];
  private errors: CapturedJsError[] = [];
  private originals: Partial<Record<string, (...args: unknown[]) => void>> = {};
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
  private active = false;

  start(): void {
    if (this.active || typeof window === "undefined") {
      return;
    }

    this.active = true;
    this.consoleLogs = [];
    this.errors = [];

    const levels = ["log", "info", "warn", "error"] as const;

    for (const level of levels) {
      const original = console[level];
      this.originals[level] = original;

      const capture = this;
      console[level] = (...args: unknown[]) => {
        try {
          capture.consoleLogs.push({
            level,
            timestamp: new Date().toISOString(),
            args: args.map(serializeArg),
          });

          if (capture.consoleLogs.length > MAX_CONSOLE_ENTRIES) {
            capture.consoleLogs.shift();
          }
        } catch {
          // Never let capture logic interfere with the original call
        }

        original.apply(console, args);
      };
    }

    this.errorHandler = (event: ErrorEvent) => {
      try {
        this.errors.push({
          timestamp: new Date().toISOString(),
          message: event.message || "Unknown error",
          source: event.filename || undefined,
          lineno: event.lineno || undefined,
          colno: event.colno || undefined,
          stack: event.error?.stack || undefined,
          type: "error",
        });

        if (this.errors.length > MAX_ERROR_ENTRIES) {
          this.errors.shift();
        }
      } catch {
        // Never interfere with error propagation
      }
    };

    window.addEventListener("error", this.errorHandler);

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason;
        this.errors.push({
          timestamp: new Date().toISOString(),
          message: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack || undefined : undefined,
          type: "unhandledrejection",
        });

        if (this.errors.length > MAX_ERROR_ENTRIES) {
          this.errors.shift();
        }
      } catch {
        // Never interfere with rejection propagation
      }
    };

    window.addEventListener("unhandledrejection", this.rejectionHandler);
  }

  snapshot(): { consoleLogs: ConsoleLogEntry[]; jsErrors: CapturedJsError[] } {
    return {
      consoleLogs: [...this.consoleLogs],
      jsErrors: [...this.errors],
    };
  }

  stop(): void {
    if (!this.active) {
      return;
    }

    for (const [level, original] of Object.entries(this.originals)) {
      if (original) {
        (console as unknown as Record<string, unknown>)[level] = original;
      }
    }

    this.originals = {};

    if (this.errorHandler) {
      window.removeEventListener("error", this.errorHandler);
      this.errorHandler = null;
    }

    if (this.rejectionHandler) {
      window.removeEventListener("unhandledrejection", this.rejectionHandler);
      this.rejectionHandler = null;
    }

    this.active = false;
  }

  clear(): void {
    this.consoleLogs = [];
    this.errors = [];
  }
}
