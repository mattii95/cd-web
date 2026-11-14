import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "server",
          environment: "node",
          include: ["__tests__/server/**/*.test.ts"],
        },
      },
    ],
  },
});
