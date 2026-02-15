import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { QuickStartPage } from "./pages/QuickStartPage.tsx";
import { HookDemoPage } from "./pages/HookDemoPage.tsx";
import { SampleAppPage } from "./pages/SampleAppPage.tsx";
import { HeadlessPage } from "./pages/HeadlessPage.tsx";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/quick-start" element={<QuickStartPage />} />
        <Route path="/hook-demo" element={<HookDemoPage />} />
        <Route path="/headless" element={<HeadlessPage />} />
        <Route path="/sample-app" element={<SampleAppPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
