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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-i18n": ["i18next", "react-i18next"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-tooltip"],
          "vendor-web3": ["ethers"],
        }
      }
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
