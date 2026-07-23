import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/eval/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
