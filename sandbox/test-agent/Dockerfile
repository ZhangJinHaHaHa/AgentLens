FROM alpine:3.20

# 该镜像仅封装已编译的基础 test-agent，用于沙箱网络/进程控制验证；源码编译、测试与依赖锁定在镜像外完成。
# iptables 能否生效仍取决于运行时授予的容器能力，本文件不扩大宿主权限；EXPOSE 也只是端口元数据。
# 构建输入必须包含与当前源码匹配的 dist/src，COPY 缺失应使构建失败，不能回退到宿主目录或在线下载应用代码。
RUN apk add --no-cache nodejs iptables curl

WORKDIR /app

COPY dist/src /app/dist/src

# 镜像自身未声明业务持久卷；预期失败恢复是丢弃实例并从同一产物重建，外挂状态则由沙箱编排层独立管理。
EXPOSE 8080

CMD ["node", "/app/dist/src/testAgent/server.js"]
