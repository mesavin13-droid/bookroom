import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["**/*.test.ts"], exclude: ["node_modules", ".next"] },
  // `server-only` throws outside a React Server Component graph; tests run in
  // plain Node, so point it at an empty stub.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
