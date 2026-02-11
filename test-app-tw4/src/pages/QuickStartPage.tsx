import { CodeBlock } from "../components/CodeBlock.tsx";

const providerCode = `import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  LinearIntegration,
  JiraIntegration,
} from "bug-reporter-react";

// Option A: Linear via backend proxy (recommended)
const linear = new LinearIntegration({
  submitProxyEndpoint: "/api/bug-report",
});

// Option B: Jira via backend proxy
const jira = new JiraIntegration({
  submitProxyEndpoint: "/api/bug-report",
});

export default function App({ children }) {
  return (
    <BugReporterProvider
      integrations={{ linear, jira }}
      defaultProvider="linear"
    >
      {children}
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}`;

const linearDirectCode = `// Direct API (dev/testing only — exposes API key!)
const linear = new LinearIntegration({
  apiKey: "lin_api_...",
  teamId: "TEAM_ID",
  projectId: "PROJECT_ID", // optional
});`;

const jiraDirectCode = `// Direct API (dev/testing only)
const jira = new JiraIntegration({
  baseUrl: "https://your-domain.atlassian.net",
  email: "you@example.com",
  apiToken: "...",
  projectKey: "BUG",
});`;

const providerPropsCode = `<BugReporterProvider
  integrations={{ linear, jira }}  // Required: at least one integration
  defaultProvider="linear"          // Optional: pre-select provider
  maxDurationMs={120_000}           // Optional: max recording duration (default 2min)
>`;

export function QuickStartPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Quick Start</h1>
        <p className="mt-2 text-gray-500">
          The fastest way to add bug reporting — just 3 components.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Wrap your app</h2>
        <p className="text-sm text-gray-600">
          Place <code className="rounded bg-gray-100 px-1.5 py-0.5 text-indigo-700">BugReporterProvider</code> at the
          root of your app. Add <code className="rounded bg-gray-100 px-1.5 py-0.5 text-indigo-700">FloatingBugButton</code> and{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-indigo-700">BugReporterModal</code> inside it.
        </p>
        <CodeBlock code={providerCode} title="App.tsx" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Provider Props</h2>
        <CodeBlock code={providerPropsCode} title="Props" />
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Prop</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2 font-mono text-xs">integrations</td>
                <td className="px-4 py-2 text-gray-500">BugReporterIntegrations</td>
                <td className="px-4 py-2">Object with <code>linear</code> and/or <code>jira</code> integration instances</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">defaultProvider</td>
                <td className="px-4 py-2 text-gray-500">"linear" | "jira"</td>
                <td className="px-4 py-2">Pre-selected provider in the modal</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">maxDurationMs</td>
                <td className="px-4 py-2 text-gray-500">number</td>
                <td className="px-4 py-2">Max video recording duration in ms (default: 120000)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Integration Options</h2>
        <h3 className="font-medium text-gray-700">Linear — Direct API</h3>
        <CodeBlock code={linearDirectCode} title="Direct Linear (dev only)" />
        <h3 className="mt-4 font-medium text-gray-700">Jira — Direct API</h3>
        <CodeBlock code={jiraDirectCode} title="Direct Jira (dev only)" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Try it</h2>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-800">
          The floating bug button is active on this page. Click it in the
          bottom-right corner to:
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Take a quick screenshot</li>
            <li>Select a region to capture</li>
            <li>Record your screen</li>
          </ul>
          Then annotate, add a title & description, and submit.
        </div>
      </section>
    </div>
  );
}
