# quick-bug-reporter-react-native

React Native bug reporter SDK with shake-to-report, screenshot capture, screen recording, annotation, and cloud/Jira/Linear submission.

## Installation

```bash
npm install quick-bug-reporter-react-native
```

Install required peers in your app:

```bash
npm install @gorhom/bottom-sheet @react-native-community/netinfo @shopify/react-native-skia react-native-device-info react-native-gesture-handler react-native-nitro-screen-recorder react-native-reanimated react-native-shake react-native-view-shot
```

## Setup Notes

- Supports bare React Native and Expo **Dev Client**.
- Expo Go is not sufficient for this package because native modules are required.
- Ensure `react-native-gesture-handler` and `react-native-reanimated` are configured in your app entrypoint.

## Basic Usage

```tsx
import {
  BugReporterProvider,
  BugReporterModal,
  FloatingBugButton,
  CloudIntegration,
} from "quick-bug-reporter-react-native";

const cloud = new CloudIntegration({
  projectKey: "qb_proj_xxxxx",
  endpoint: "/api/ingest",
  appVersion: "1.2.3",
  environment: "production",
});

export function App() {
  return (
    <BugReporterProvider
      integrations={{ cloud }}
      defaultProvider="cloud"
      shakeEnabled
      captureOnShake="screenshot"
    >
      {/* app navigation/content */}
      <FloatingBugButton />
      <BugReporterModal />
    </BugReporterProvider>
  );
}
```

## Features

- Shake trigger with cooldown (`useShakeDetector`)
- Screenshot capture (`react-native-view-shot`)
- Video recording wrapper (`react-native-nitro-screen-recorder`)
- Screenshot annotation with rectangle highlights (`@shopify/react-native-skia`)
- Console + network log capture
- Submissions via `CloudIntegration`, `JiraIntegration`, or `LinearIntegration`

## Programmatic API

```tsx
import { useBugReporter } from "quick-bug-reporter-react-native";

function ReportButton() {
  const { captureQuickScreenshot, openModal } = useBugReporter();

  return (
    <Button
      title="Report Bug"
      onPress={async () => {
        const ok = await captureQuickScreenshot();
        if (ok) openModal();
      }}
    />
  );
}
```

## Notes on Recording

- iOS prefers in-app recording mode.
- Android defaults to global recording mode.
- If recording is unavailable, screenshot reporting still works.
