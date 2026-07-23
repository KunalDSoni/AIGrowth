import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup/isolate-data-dir.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/eval/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
