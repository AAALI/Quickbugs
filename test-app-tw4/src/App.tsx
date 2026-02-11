import { Routes, Route } from "react-router-dom";
import {
  BugReporterProvider,
  FloatingBugButton,
  BugReporterModal,
  LinearIntegration,
  JiraIntegration,
} from "bug-reporter-react";
import { Layout } from "./components/Layout.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { QuickStartPage } from "./pages/QuickStartPage.tsx";
import { HookDemoPage } from "./pages/HookDemoPage.tsx";
import { SampleAppPage } from "./pages/SampleAppPage.tsx";
import { HeadlessPage } from "./pages/HeadlessPage.tsx";

// Custom fetch that rewrites external URLs to go through the Vite dev proxy
// and prevents browser from sending stale cookies (e.g. atlassian.xsrf.token)
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
  // Route through Vite dev proxy to avoid CORS
  graphqlEndpoint: "/api/linear/graphql",
  fetchImpl: proxyFetch,
});

const jiraIntegration = new JiraIntegration({
  // Server-side endpoints handled by jiraServerPlugin in vite.config.ts
  // This matches the production pattern (Next.js API routes, Express, etc.)
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
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/quick-start" element={<QuickStartPage />} />
          <Route path="/hook-demo" element={<HookDemoPage />} />
          <Route path="/headless" element={<HeadlessPage />} />
          <Route path="/sample-app" element={<SampleAppPage />} />
        </Routes>
      </Layout>
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}

export default App;
