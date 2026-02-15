import { Link } from "react-router-dom";
import { Zap, MousePointerClick, Code2, AppWindow } from "lucide-react";
import { CodeBlock } from "../components/CodeBlock.tsx";

const installSnippet = `npm install quick-bug-reporter-react
# or
pnpm add quick-bug-reporter-react`;

const quickSetupSnippet = `import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  LinearIntegration,
} from "quick-bug-reporter-react";

const linear = new LinearIntegration({
  submitProxyEndpoint: "/api/bug-report",
});

export default function App({ children }) {
  return (
    <BugReporterProvider
      integrations={{ linear }}
      defaultProvider="linear"
    >
      {children}
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}`;

const cards = [
  {
    to: "/quick-start",
    title: "Quick Start",
    description: "Drop-in setup with Provider, FloatingBugButton, and Modal — 3 components, zero custom UI.",
    icon: Zap,
    color: "text-amber-600 bg-amber-50",
  },
  {
    to: "/hook-demo",
    title: "Hook Demo",
    description: "Build a completely custom UI using the useBugReporter() hook for full control.",
    icon: MousePointerClick,
    color: "text-blue-600 bg-blue-50",
  },
  {
    to: "/headless",
    title: "Headless API",
    description: "Use the BugReporter class directly — no React components needed.",
    icon: Code2,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    to: "/sample-app",
    title: "Sample App",
    description: "A page with interactive forms, tables, and errors — perfect for testing bug reports.",
    icon: AppWindow,
    color: "text-purple-600 bg-purple-50",
  },
];

export function HomePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          quick-bug-reporter-react
        </h1>
        <p className="mt-2 text-lg text-gray-500">
          Drop-in bug reporter for React apps — screenshot capture, video
          recording, annotation, and Linear/Jira integration.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Features</h2>
        <ul className="grid grid-cols-2 gap-3 text-sm text-gray-700">
          <li className="rounded-lg border border-gray-200 bg-white px-4 py-3">📸 Screenshot capture (full-page or region)</li>
          <li className="rounded-lg border border-gray-200 bg-white px-4 py-3">🎥 Video recording (screen + mic)</li>
          <li className="rounded-lg border border-gray-200 bg-white px-4 py-3">✏️ Drag-to-highlight annotation</li>
          <li className="rounded-lg border border-gray-200 bg-white px-4 py-3">🌐 Automatic network log capture</li>
          <li className="rounded-lg border border-gray-200 bg-white px-4 py-3">🔗 Linear & Jira integrations</li>
          <li className="rounded-lg border border-gray-200 bg-white px-4 py-3">🧩 Zero-config floating UI</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Install</h2>
        <CodeBlock code={installSnippet} title="Terminal" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Minimal Setup</h2>
        <CodeBlock code={quickSetupSnippet} title="App.tsx" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Explore the Demos</h2>
        <div className="grid grid-cols-2 gap-4">
          {cards.map(({ to, title, description, icon: Icon, color }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className={`mb-3 inline-flex rounded-lg p-2 ${color}`}>
                <Icon className="size-5" />
              </div>
              <h3 className="font-semibold group-hover:text-indigo-600">
                {title}
              </h3>
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-800">
        <strong>Try it now:</strong> Click the floating bug button in the
        bottom-right corner to capture a screenshot or record a video on any
        page of this test app.
      </section>
    </div>
  );
}
