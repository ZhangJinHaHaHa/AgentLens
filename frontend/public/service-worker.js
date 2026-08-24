// 这是旧离线 shell 的兼容性退役 worker：接管后清除 AgentLens 前缀缓存，并把同源 GET 始终交给网络。
// 它不预缓存、不提供离线回退，也不拦截跨源或有副作用的请求；网络失败应原样传播给页面。
// index.html 还会主动注销 registration，因此该文件只服务于仍被旧客户端唤醒的迁移窗口。
const CACHE_PREFIX = "agentlens-shell-";

self.addEventListener("install", (event) => {
  // 立即进入 waiting 之后的激活阶段，避免旧 worker 长期持有缓存；安装本身不写入任何新缓存。
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // 只删除本应用命名空间内的历史 shell，保留同源其他 Cache Storage；清理完成后再接管已有页面。
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // 过滤条件是信任与兼容边界：非 GET 继续浏览器默认路径，跨源资源也不经此 worker 代理。
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(fetch(request));
});
