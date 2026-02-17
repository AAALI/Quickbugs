"use client";

import { useState } from "react";
import { IconCopy, IconCheck } from "@tabler/icons-react";

type DocsContentProps = {
  projectKey: string;
};

export function DocsContent({ projectKey }: DocsContentProps) {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Documentation</h1>
        <p className="mt-2 text-sm text-slate-500">
          Everything you need to integrate QuickBugs into your app.
        </p>
      </div>

      {/* Quick start */}
      <Section id="quickstart" title="Quick start">
        <P>Get bug reporting working in your React app in under 2 minutes.</P>
        <Step n={1} title="Install the SDK">
          <CodeBlock
            lang="bash"
            code="npm install quick-bug-reporter-react"
          />
          <P className="mt-2">Or with other package managers:</P>
          <CodeBlock
            lang="bash"
            code={`pnpm add quick-bug-reporter-react\nyarn add quick-bug-reporter-react`}
          />
        </Step>

        <Step n={2} title="Add the provider to your app">
          <CodeBlock
            lang="tsx"
            code={`import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  CloudIntegration,
} from "quick-bug-reporter-react";
import "quick-bug-reporter-react/styles.css";

const cloud = new CloudIntegration({
  projectKey: "${projectKey}",
  endpoint: "https://your-domain.com/api/ingest",
});

function App() {
  return (
    <BugReporterProvider
      integrations={{ cloud }}
      defaultProvider="cloud"
    >
      {/* Your app content */}
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}`}
          />
        </Step>

        <Step n={3} title="Test it">
          <P>
            Run your app, click the floating bug button in the bottom-right corner,
            submit a test report. It should appear in your dashboard within seconds.
          </P>
        </Step>
      </Section>

      {/* CloudIntegration options */}
      <Section id="cloud-integration" title="CloudIntegration options">
        <CodeBlock
          lang="tsx"
          code={`const cloud = new CloudIntegration({
  // Required — your project key from the dashboard
  projectKey: "${projectKey}",

  // Optional — defaults to "/api/ingest"
  // Set this to your dashboard's full URL in production
  endpoint: "https://your-domain.com/api/ingest",

  // Optional — custom fetch implementation
  // Useful for proxying through your own server
  fetchImpl: customFetch,
});`}
        />
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Option</th>
                <th className="px-4 py-2 font-medium text-slate-600">Type</th>
                <th className="px-4 py-2 font-medium text-slate-600">Required</th>
                <th className="px-4 py-2 font-medium text-slate-600">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-2 font-mono text-xs text-teal-700">projectKey</td>
                <td className="px-4 py-2 text-xs text-slate-500">string</td>
                <td className="px-4 py-2 text-xs text-slate-500">Yes</td>
                <td className="px-4 py-2 text-xs text-slate-500">Your project key from the dashboard</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs text-teal-700">endpoint</td>
                <td className="px-4 py-2 text-xs text-slate-500">string</td>
                <td className="px-4 py-2 text-xs text-slate-500">No</td>
                <td className="px-4 py-2 text-xs text-slate-500">Ingest URL. Defaults to <code className="bg-slate-100 px-1 rounded">/api/ingest</code></td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs text-teal-700">fetchImpl</td>
                <td className="px-4 py-2 text-xs text-slate-500">typeof fetch</td>
                <td className="px-4 py-2 text-xs text-slate-500">No</td>
                <td className="px-4 py-2 text-xs text-slate-500">Custom fetch for proxying or auth headers</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Components */}
      <Section id="components" title="Components">
        <H3>BugReporterProvider</H3>
        <P>
          Wraps your app and provides the bug reporting context. Must be at the
          root of your component tree.
        </P>
        <CodeBlock
          lang="tsx"
          code={`<BugReporterProvider
  integrations={{ cloud }}
  defaultProvider="cloud"
>
  {children}
</BugReporterProvider>`}
        />
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Prop</th>
                <th className="px-4 py-2 font-medium text-slate-600">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-2 font-mono text-xs text-teal-700">integrations</td>
                <td className="px-4 py-2 text-xs text-slate-500">Object with integration instances (cloud, linear, jira)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs text-teal-700">defaultProvider</td>
                <td className="px-4 py-2 text-xs text-slate-500">Which integration to use by default</td>
              </tr>
            </tbody>
          </table>
        </div>

        <H3 className="mt-6">FloatingBugButton</H3>
        <P>
          Renders a floating action button (bottom-right) that opens the bug
          reporter modal when clicked. No props required.
        </P>

        <H3 className="mt-6">BugReporterModal</H3>
        <P>
          The modal dialog for capturing and submitting bug reports. Features a
          two-step wizard: (1) Review screenshot/video, (2) Add bug details with
          structured fields (Steps to Reproduce, Expected Result, Actual Result,
          Additional Context). All fields optional, 4000 char combined limit.
          No props required.
        </P>
      </Section>

      {/* Direct integrations */}
      <Section id="direct-integrations" title="Direct integrations (no dashboard)">
        <P>
          You can also use QuickBugs without the cloud dashboard by connecting
          directly to Linear or Jira. This sends bug reports straight to your
          tracker without going through QuickBugs servers.
        </P>

        <H3>Linear</H3>
        <CodeBlock
          lang="tsx"
          code={`import { LinearIntegration } from "quick-bug-reporter-react";

const linear = new LinearIntegration({
  apiKey: "lin_api_...",
  teamId: "TEAM_ID",       // optional
  projectId: "PROJECT_ID", // optional
});

// Use in BugReporterProvider
<BugReporterProvider
  integrations={{ linear }}
  defaultProvider="linear"
>`}
        />

        <H3 className="mt-6">Jira</H3>
        <CodeBlock
          lang="tsx"
          code={`import { JiraIntegration } from "quick-bug-reporter-react";

const jira = new JiraIntegration({
  projectKey: "BUG",
  issueType: "Bug",
  createIssueProxyEndpoint: "/api/jira/create-issue",
  uploadAttachmentProxyEndpoint: "/api/jira/upload-attachment",
});

// Use in BugReporterProvider
<BugReporterProvider
  integrations={{ jira }}
  defaultProvider="jira"
>`}
        />
        <P className="mt-2">
          Jira requires a server-side proxy to avoid exposing your API token in the browser.
        </P>
      </Section>

      {/* What gets captured */}
      <Section id="captured-data" title="What gets captured">
        <P>Each bug report automatically collects:</P>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
          <Li>Screenshot or video recording of the bug</Li>
          <Li><strong>Structured bug details</strong> (Steps to Reproduce, Expected/Actual Results, Context)</Li>
          <Li>Browser name and version</Li>
          <Li>Operating system</Li>
          <Li>Device type (desktop / mobile / tablet)</Li>
          <Li>Screen resolution and viewport size</Li>
          <Li>Page URL where the bug was reported</Li>
          <Li>Console logs and JS errors</Li>
          <Li>Network requests</Li>
          <Li>Color scheme, locale, timezone</Li>
          <Li>Connection type</Li>
        </ul>
        <P className="mt-3">
          No media files are stored on QuickBugs servers — screenshots and
          videos are forwarded to your tracker (Linear/Jira) and only
          metadata is retained for analytics.
        </P>
      </Section>

      {/* Structured bug reports */}
      <Section id="structured-fields" title="Structured bug report fields">
        <P>
          The bug report modal features a tab-based UI for structured bug details.
          Users can fill in:
        </P>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
          <Li><strong>Steps to Reproduce</strong> — Auto-numbered list (press Enter to increment)</Li>
          <Li><strong>Expected Result</strong> — What should happen</Li>
          <Li><strong>Actual Result</strong> — What actually happened</Li>
          <Li><strong>Additional Context</strong> — Extra notes, workarounds, etc.</Li>
        </ul>
        <P className="mt-3">
          All fields are optional with a 4000 character combined limit. The structured
          data is formatted beautifully in Linear and Jira with proper headers and bold
          formatting.
        </P>
      </Section>

      {/* Proxy setup */}
      <Section id="proxy" title="Proxy setup (dev)">
        <P>
          During local development, your app and the QuickBugs dashboard run on
          different ports. Set up a proxy in your bundler to forward{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/api/ingest</code>{" "}
          to the dashboard.
        </P>

        <H3>Vite</H3>
        <CodeBlock
          lang="ts"
          code={`// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/ingest': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});`}
        />

        <H3 className="mt-6">Next.js (rewrites)</H3>
        <CodeBlock
          lang="js"
          code={`// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/ingest',
        destination: 'http://localhost:3000/api/ingest',
      },
    ];
  },
};`}
        />

        <P className="mt-3">
          In production, point the <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">endpoint</code>{" "}
          option directly to your deployed QuickBugs dashboard URL.
        </P>
      </Section>

      {/* Your project key */}
      <Section id="project-key" title="Your project key">
        <P>Your project key is pre-filled in the examples above:</P>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3">
          <code className="flex-1 font-mono text-sm text-emerald-400">
            {projectKey}
          </code>
          <CopyButton text={projectKey} />
        </div>
        <P className="mt-2">
          You can also find this on your dashboard or in Settings → Projects.
        </P>
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id}>
      <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span className="flex size-5 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-700">
          {n}
        </span>
        {title}
      </h3>
      <div className="mt-2 pl-7">{children}</div>
    </div>
  );
}

function H3({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-sm font-semibold text-slate-800 ${className}`}>
      {children}
    </h3>
  );
}

function P({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm text-slate-600 leading-relaxed ${className}`}>
      {children}
    </p>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-400" />
      {children}
    </li>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="relative mt-2 rounded-lg bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {lang}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
      title="Copy"
    >
      {copied ? (
        <IconCheck className="size-3.5 text-emerald-400" />
      ) : (
        <IconCopy className="size-3.5" />
      )}
    </button>
  );
}
