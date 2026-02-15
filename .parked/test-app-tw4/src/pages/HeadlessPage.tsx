import { CodeBlock } from "../components/CodeBlock.tsx";

const coreClassCode = `import {
  BugReporter,
  LinearIntegration,
} from "quick-bug-reporter-react";

const integration = new LinearIntegration({
  apiKey: "lin_api_...",
  teamId: "TEAM_ID",
});

const reporter = new BugReporter({ integration });

// Start recording
await reporter.start();

// ... user reproduces the bug ...

// Stop and get artifacts
const artifacts = await reporter.stop();
// artifacts.videoBlob, artifacts.networkLogs, etc.

// Submit
const result = await reporter.submit("Button broken", "Steps to reproduce...");
console.log(result.issueUrl);`;

const screenshotCode = `// Capture a screenshot instead of recording
const artifacts = await reporter.captureScreenshot();
// artifacts.screenshotBlob

// Or capture a specific region
const artifacts = await reporter.captureScreenshot({
  x: 100,
  y: 200,
  width: 500,
  height: 300,
});`;

const sessionCode = `import { BugSession } from "quick-bug-reporter-react";

const session = new BugSession({
  maxDurationMs: 60_000,
  onAutoStop: (artifacts) => {
    console.log("Recording auto-stopped:", artifacts);
  },
});

// Start recording
await session.start();

// Stop
const artifacts = await session.stop("manual");

// Access artifacts
console.log(artifacts?.videoBlob);
console.log(artifacts?.screenshotBlob);
console.log(artifacts?.networkLogs);`;

const exportsTable = [
  { name: "BugReporter", type: "Class", desc: "Orchestrates capture + submission. Main entry for headless usage." },
  { name: "BugSession", type: "Class", desc: "Manages a single capture session (recording or screenshot)." },
  { name: "ScreenRecorder", type: "Class", desc: "Screen + mic recording via MediaRecorder API." },
  { name: "ScreenshotCapturer", type: "Class", desc: "HTML-to-canvas screenshot engine via html2canvas-pro." },
  { name: "NetworkLogger", type: "Class", desc: "Fetch interception logger — captures all network requests during session." },
  { name: "LinearIntegration", type: "Class", desc: "Linear issue creation + file upload integration." },
  { name: "JiraIntegration", type: "Class", desc: "Jira issue creation + attachment upload integration." },
  { name: "collectClientEnvironmentMetadata", type: "Function", desc: "Collects browser, viewport, device, and connection metadata." },
  { name: "formatNetworkLogs", type: "Function", desc: "Formats network log entries as a readable string." },
];

export function HeadlessPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Headless API</h1>
        <p className="mt-2 text-gray-500">
          Use the core classes directly — no React components required.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">BugReporter Class</h2>
        <p className="text-sm text-gray-600">
          The main orchestrator. Handles recording, screenshot capture, and submission to your configured integration.
        </p>
        <CodeBlock code={coreClassCode} title="Headless usage" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Screenshot Capture</h2>
        <CodeBlock code={screenshotCode} title="Screenshots" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">BugSession (lower-level)</h2>
        <p className="text-sm text-gray-600">
          If you need direct control over the capture session without submission logic.
        </p>
        <CodeBlock code={sessionCode} title="BugSession" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">All Core Exports</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Export</th>
                <th className="px-4 py-2 font-medium">Kind</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exportsTable.map(({ name, type, desc }) => (
                <tr key={name}>
                  <td className="px-4 py-2 font-mono text-xs text-indigo-700">{name}</td>
                  <td className="px-4 py-2 text-gray-500">{type}</td>
                  <td className="px-4 py-2">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">TypeScript Types</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2 font-mono text-xs">BugReportPayload</td>
                <td className="px-4 py-2">Full payload sent to integrations</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">BugSubmitResult</td>
                <td className="px-4 py-2">Result after submitting (issueId, issueKey, issueUrl)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">BugSessionArtifacts</td>
                <td className="px-4 py-2">Captured artifacts (videoBlob, screenshotBlob, networkLogs)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">BugClientMetadata</td>
                <td className="px-4 py-2">Browser, viewport, device, connection metadata</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">BugReporterIntegration</td>
                <td className="px-4 py-2">Interface to implement custom integrations</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">BugTrackerProvider</td>
                <td className="px-4 py-2">"linear" | "jira"</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">NetworkLogEntry</td>
                <td className="px-4 py-2">Single network request log entry</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">CaptureRegion</td>
                <td className="px-4 py-2">Region selection coordinates for screenshot capture</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
