import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup/isolate-data-dir.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/eval/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
  },
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
