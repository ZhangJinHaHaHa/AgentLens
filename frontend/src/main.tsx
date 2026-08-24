/**
 * 浏览器启动文件只建立一个 React 根、启用 History 路由并加载全局样式；配置解释、页面取数和错误呈现由 `App` 及其边界负责。
 * 输入是宿主页提供的 `#root` 节点，输出是挂载在该节点上的应用树；除此之外不导出公共 API，也不保存应用状态。
 * `document` 与浏览器历史是宿主信任边界，HTML 模板缺少挂载点时立即抛错，避免把空白页误判为成功启动。
 * StrictMode 可能在开发环境重放生命周期，因此下游副作用必须可清理或幂等；本入口本身不得增加一次性外部写入。
 * `BrowserRouter`、全局 CSS 和单根挂载是部署兼容不变量；语义结构与键盘可达性由渲染出的组件维护，而不是在启动层伪造。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import "./styles/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("AgentLens root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
