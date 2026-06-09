import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { searchForWorkspaceRoot } from "vite";

import { createLlmNeedProxyPlugin } from "./scripts/llmNeedProxy.mjs";

export default defineConfig({
  plugins: [react(), createLlmNeedProxyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
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
