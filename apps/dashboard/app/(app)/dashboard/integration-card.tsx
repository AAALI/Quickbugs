"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  IconPlug,
  IconCheck,
  IconCopy,
  IconRefresh,
  IconCircleCheck,
  IconAlertCircle,
  IconLoader2,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";

type IntegrationCardProps = {
  projectId: string;
  projectKey: string;
  integration: {
    id: string;
    provider: string;
    config: Record<string, string> | null;
    created_at: string;
  } | null;
};

export function IntegrationCard({
  projectId,
  projectKey,
  integration,
}: IntegrationCardProps) {
  const router = useRouter();
  const [showSnippet, setShowSnippet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);

    try {
      // Build a full FormData test report with dummy attachments
      const fd = new FormData();
      fd.set("project_key", projectKey);
      fd.set("title", "[Connection Test] — ignore this report");
      fd.set("provider", "cloud");
      fd.set("capture_mode", "screenshot");
      fd.set("has_screenshot", "true");
      fd.set("has_video", "false");
      fd.set("has_network_logs", "true");
      fd.set("has_console_logs", "true");
      fd.set("js_error_count", "0");
      fd.set("user_agent", navigator.userAgent);
      fd.set("browser_name", "Test Browser");
      fd.set("os_name", "Test OS");
      fd.set("device_type", "desktop");
      fd.set("screen_resolution", `${screen.width}x${screen.height}`);
      fd.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
      fd.set("page_url", window.location.href);
      fd.set("environment", "test");
      fd.set("sync_forwarding", "true");

      // Generate a small test screenshot (1x1 red PNG)
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#10b981";
        ctx.fillRect(0, 0, 200, 100);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("QuickBugs Test", 100, 55);
      }
      const screenshotBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b ?? new Blob()), "image/png")
      );
      fd.append("screenshot", screenshotBlob, "test-screenshot.png");

      // Dummy console logs
      fd.append(
        "console_logs",
        new Blob(
          ["=== Console Output ===\n[info] Test connection from QuickBugs dashboard\n[info] " + new Date().toISOString()],
          { type: "text/plain" }
        ),
        "console-logs.txt"
      );

      // Dummy network logs
      fd.append(
        "network_logs",
        new Blob(
          ["=== Network Logs ===\nGET " + window.location.href + " → 200 OK (test)"],
          { type: "text/plain" }
        ),
        "network-logs.txt"
      );

      // Client metadata
      fd.append(
        "metadata",
        new Blob(
          [JSON.stringify({ test: true, timestamp: new Date().toISOString(), userAgent: navigator.userAgent }, null, 2)],
          { type: "application/json" }
        ),
        "client-metadata.json"
      );

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        setTestResult({
          ok: true,
          message: "Connection works! Report with screenshot, console & network logs was forwarded to your tracker.",
        });
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setTestResult({
          ok: false,
          message: (body as { error?: string }).error ?? `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: "Network error — is the server running?",
      });
    }

    setTesting(false);
  }

  function copySnippet() {
    const snippet = getSnippet(projectKey);
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const snippet = getSnippet(projectKey);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-teal-50">
            <IconPlug className="size-5 text-teal-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Integration
            </h3>
            {integration ? (
              <p className="text-xs text-slate-500">
                Connected to <span className="font-medium capitalize">{integration.provider}</span>
                {integration.config?.team_id && (
                  <> · {integration.config.team_id}</>
                )}
              </p>
            ) : (
              <p className="text-xs text-amber-600">
                No tracker connected — reports are stored but not forwarded.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? (
              <IconLoader2 className="size-3.5 animate-spin" />
            ) : (
              <IconRefresh className="size-3.5" />
            )}
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`mx-6 mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
            testResult.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {testResult.ok ? (
            <IconCircleCheck className="mt-0.5 size-4 shrink-0" />
          ) : (
            <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
          )}
          {testResult.message}
        </div>
      )}

      {/* SDK snippet toggle */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setShowSnippet(!showSnippet)}
          className="flex w-full items-center justify-between px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <span>SDK integration code</span>
          {showSnippet ? (
            <IconChevronUp className="size-4 text-slate-400" />
          ) : (
            <IconChevronDown className="size-4 text-slate-400" />
          )}
        </button>

        {showSnippet && (
          <div className="px-6 pb-5">
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-300">
                <code>{snippet}</code>
              </pre>
              <button
                onClick={copySnippet}
                className="absolute right-3 top-3 rounded-md bg-slate-700 p-1.5 text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <IconCheck className="size-3.5 text-emerald-400" />
                ) : (
                  <IconCopy className="size-3.5" />
                )}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Install the SDK:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                npm install quick-bug-reporter-react
              </code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function getSnippet(projectKey: string): string {
  return `import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  CloudIntegration,
} from "quick-bug-reporter-react";

const cloud = new CloudIntegration({
  projectKey: "${projectKey}",
  endpoint: "${typeof window !== "undefined" ? window.location.origin : "https://your-app.com"}/api/ingest",
  appVersion: "1.0.0",
  environment: "production",
});

function App() {
  return (
    <BugReporterProvider
      integrations={{ cloud }}
      defaultProvider="cloud"
    >
      {/* your app */}
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}`;
}
