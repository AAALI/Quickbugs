"use client";

import { useState } from "react";
import { IconCode, IconCopy, IconCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function StepInstallSdk({
  projectKey,
  onComplete,
}: {
  projectKey: string;
  onComplete: () => void;
}) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const snippet = `import {
  BugReporterProvider,
  BugReporterModal,
  FloatingBugButton,
  CloudIntegration,
} from "quick-bug-reporter-react";

const cloud = new CloudIntegration({
  projectKey: "${projectKey}",
  endpoint: "/api/ingest",
  appVersion: "1.0.0",
  environment: "production",
});

export function AppWithBugReporter({ children }: { children: React.ReactNode }) {
  return (
    <BugReporterProvider integrations={{ cloud }} defaultProvider="cloud">
      {children}
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}`;

  async function copyProjectKey() {
    await navigator.clipboard.writeText(projectKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  }

  return (
    <div>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <IconCode className="size-7" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-slate-900">
        Your project is ready
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Install the SDK and connect it to your project key. Reports will flow
        through `/api/ingest` and forward to your configured tracker.
      </p>

      <div className="mt-8 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Project key
            </p>
            <button
              type="button"
              onClick={copyProjectKey}
              className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600"
            >
              {copiedKey ? (
                <IconCheck className="size-3" />
              ) : (
                <IconCopy className="size-3" />
              )}
              {copiedKey ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 font-mono text-base text-slate-900">{projectKey}</p>
          <p className="mt-3 text-xs text-slate-400">
            This key authenticates your SDK with the ingestion endpoint.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Install
            </p>
            <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
              npm i quick-bug-reporter-react
            </code>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Quick start snippet
              </p>
              <button
                type="button"
                onClick={copySnippet}
                className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600"
              >
                {copiedSnippet ? (
                  <IconCheck className="size-3" />
                ) : (
                  <IconCopy className="size-3" />
                )}
                {copiedSnippet ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">
              <code>{snippet}</code>
            </pre>
          </div>
        </div>
      </div>

      <Button
        onClick={onComplete}
        className="mt-8 h-12 w-full rounded-lg bg-primary text-base text-white hover:bg-primary/90"
      >
        Continue
      </Button>
    </div>
  );
}
