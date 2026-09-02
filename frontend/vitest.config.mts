import { defineConfig } from "vitest/config";

// Environment defaults to "node" and is overridden per-file via the
// `// @vitest-environment jsdom` pragma (see __tests__/results-table.test.tsx),
// so lib-only tests like __tests__/api.test.ts keep running in plain node.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
  },
});
