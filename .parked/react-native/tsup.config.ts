import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-native",
    "@gorhom/bottom-sheet",
    "@react-native-community/netinfo",
    "@shopify/react-native-skia",
    "react-native-device-info",
    "react-native-gesture-handler",
    "react-native-nitro-screen-recorder",
    "react-native-reanimated",
    "react-native-shake",
    "react-native-view-shot",
  ],
  noExternal: ["@quick-bug-reporter/core"],
  treeshake: true,
  splitting: false,
});
