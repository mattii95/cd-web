import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["lib/**", "components/**"],
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
    projects: [
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "client",
          environment: "jsdom",
          include: ["__tests__/client/**/*.test.{ts,tsx}"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        plugins: [tsconfigPaths(), react()],
        resolve: {
          alias: {
            "server-only": fileURLToPath(
              new URL("./__tests__/stubs/server-only.ts", import.meta.url),
            ),
          },
        },
        test: {
          name: "server",
          environment: "node",
          include: ["__tests__/server/**/*.test.ts"],
        },
      },
    ],
  },
});
