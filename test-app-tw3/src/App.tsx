import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  LinearIntegration,
  JiraIntegration,
} from "bug-reporter-react";

// Custom fetch that rewrites GCS URLs through the Vite dev proxy
const proxyFetch: typeof fetch = (input, init) => {
  if (typeof input === "string" && input.includes("storage.googleapis.com")) {
    const url = new URL(input);
    input = `/api/gcs${url.pathname}${url.search}`;
  }
  return fetch(input, { ...init, credentials: "omit" });
};

const linearIntegration = new LinearIntegration({
  apiKey: import.meta.env.VITE_LINEAR_API_KEY || undefined,
  teamId: import.meta.env.VITE_LINEAR_TEAM_ID || undefined,
  projectId: import.meta.env.VITE_LINEAR_PROJECT_ID || undefined,
  graphqlEndpoint: "/api/linear/graphql",
  fetchImpl: proxyFetch,
});

const jiraIntegration = new JiraIntegration({
  projectKey: import.meta.env.VITE_JIRA_PROJECT_KEY || undefined,
  issueType: import.meta.env.VITE_JIRA_ISSUE_TYPE || "Bug",
  createIssueProxyEndpoint: "/api/jira/create-issue",
  uploadAttachmentProxyEndpoint: "/api/jira/upload-attachment",
});

const defaultProvider = (import.meta.env.VITE_DEFAULT_PROVIDER as "linear" | "jira") || "linear";

function App() {
  return (
    <BugReporterProvider
      integrations={{ linear: linearIntegration, jira: jiraIntegration }}
      defaultProvider={defaultProvider}
    >
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Tailwind v3 Test App</h1>
          <span className="inline-block rounded-full bg-orange-100 px-3 py-0.5 text-xs font-medium text-orange-700">
            Tailwind CSS v3.4
          </span>
        </nav>

        <main className="mx-auto max-w-3xl px-6 py-12">
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong className="font-semibold">Environment:</strong> Vite + React 19 + Tailwind CSS v3.4 with PostCSS.
            The library's <code className="rounded bg-amber-100 px-1 font-mono text-xs">styles.css</code> is
            imported alongside TW3. Linear &amp; Jira submission is fully wired.
          </div>

          <h2 className="mb-3 text-3xl font-bold text-gray-900">Bug Reporter — TW3 Test</h2>
          <p className="mb-10 text-lg text-gray-500">
            This app verifies that the library works end-to-end inside a Tailwind CSS v3
            project — styling, screenshots, and bug submission to Linear/Jira.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-1 font-semibold text-gray-900">Fixed positioning</h3>
              <p className="text-sm text-gray-500">
                Floating button should be pinned at bottom-right corner (position: fixed).
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-1 font-semibold text-gray-900">Colors</h3>
              <p className="text-sm text-gray-500">
                Button should be dark gray with white text. No invisible or unstyled elements.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-1 font-semibold text-gray-900">Submission</h3>
              <p className="text-sm text-gray-500">
                Submit a bug report — it should create an issue in Linear or Jira with attachments.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-1 font-semibold text-gray-900">No conflicts</h3>
              <p className="text-sm text-gray-500">
                This page's own TW3 classes should render correctly alongside library styles.
              </p>
            </div>
          </div>
        </main>
      </div>

      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}

export default App;
