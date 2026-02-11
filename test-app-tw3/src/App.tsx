import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  LinearIntegration,
} from "bug-reporter-react";

const linear = new LinearIntegration({
  submitProxyEndpoint: "/api/bug-report",
});

function App() {
  return (
    <BugReporterProvider
      integrations={{ linear }}
      defaultProvider="linear"
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
            imported through the app's CSS pipeline.
          </div>

          <h2 className="mb-3 text-3xl font-bold text-gray-900">Bug Reporter — TW3 Test</h2>
          <p className="mb-10 text-lg text-gray-500">
            This app verifies that the library's self-contained CSS works alongside
            Tailwind CSS v3 without any theme variable conflicts. Click the floating button ↘
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
              <h3 className="mb-1 font-semibold text-gray-900">Dialog modal</h3>
              <p className="text-sm text-gray-500">
                Clicking "Full page screenshot" then opening the modal should show a styled dialog.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-1 font-semibold text-gray-900">No conflicts</h3>
              <p className="text-sm text-gray-500">
                This page's own Tailwind v3 classes should render correctly alongside library styles.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-2 font-semibold text-gray-900">Checklist</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✅ Floating "Report Bug" button visible at bottom-right</li>
              <li>✅ Button has dark background, white text, icon</li>
              <li>✅ Menu opens with screenshot / record options</li>
              <li>✅ This page's own TW3 styles (bg-gray-50, rounded-xl, etc.) work fine</li>
              <li>✅ No invisible text or broken spacing</li>
            </ul>
          </div>
        </main>
      </div>

      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}

export default App;
