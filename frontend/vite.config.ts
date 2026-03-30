import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { searchForWorkspaceRoot } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), path.resolve(__dirname, "../contracts")]
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    server: {
      deps: {
        inline: []
      }
    }
  }
});
