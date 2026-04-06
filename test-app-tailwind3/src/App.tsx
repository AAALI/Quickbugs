import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  CloudIntegration,
} from "quick-bug-reporter-react";
import "quick-bug-reporter-react/styles.css";

const cloud = new CloudIntegration({
  projectKey: "qb_wvw73zh91j5a",
  endpoint: "/api/ingest",
});

function App() {
  return (
    <BugReporterProvider
      integrations={{ cloud }}
      defaultProvider="cloud"
    >
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Tailwind v3 Test App</h1>
          <span className="inline-block rounded-full bg-orange-100 px-3 py-0.5 text-xs font-medium text-orange-700">
            Tailwind CSS v3.4
          </span>
        </nav>

        <main className="mx-auto max-w-3xl px-6 py-12">
          <h2 className="mb-3 text-3xl font-bold text-gray-900">Test App</h2>
          <p className="mb-10 text-lg text-gray-500">
            Vite + React 19 + Tailwind CSS v3.4. Integrate QuickBugs here.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-1 font-semibold text-gray-900">Card A</h3>
              <p className="text-sm text-gray-500">Sample content for testing.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-1 font-semibold text-gray-900">Card B</h3>
              <p className="text-sm text-gray-500">Sample content for testing.</p>
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
