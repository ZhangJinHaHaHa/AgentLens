import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { searchForWorkspaceRoot } from "vite";

import { createLlmNeedProxyPlugin } from "./scripts/llmNeedProxy.mjs";

// 这是前端开发、生产打包与 Vitest 的共同入口；配置只编排工具边界，不承载应用业务状态。
// LLM 插件仅挂载 Vite 开发服务器中间件，密钥留在本地 Node 进程，生产环境仍需由受控后端提供接口。
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
        // 稳定的领域分块降低无关依赖升级造成的缓存失效；名称是发布产物契约，不影响模块运行顺序。
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
      // 开发服务器仅额外开放相邻 contracts 工作区供本地联调；这不是浏览器侧授权或线上文件服务策略。
      allow: [searchForWorkspaceRoot(process.cwd()), path.resolve(__dirname, "../contracts")]
    }
  },
  test: {
    // 单测使用浏览器 DOM 语义并统一加载测试初始化；生产构建不会打包该入口。
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    server: {
      deps: {
        inline: []
      }
    }
  }
});
