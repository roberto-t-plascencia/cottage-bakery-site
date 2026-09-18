import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Native tsconfig-paths resolution (Vite 7+) — resolves the "@/*"
    // alias from tsconfig.json without the vite-tsconfig-paths plugin.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
