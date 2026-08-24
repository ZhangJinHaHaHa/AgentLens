/**
 * 这里集中发布本地沙箱协议端口、HTTP 路径、请求时限和默认资源配额，供容器启动、探活、请求与审计判定共享；不读取部署配置，也不实施限额。
 * 模块没有运行时输入、I/O 或可变状态，输出是编译期常量；真正的端口绑定、超时取消和 Docker 配额由各边界适配器执行。
 * 这些数值和路径同时约束测试代理与审计器，属于跨进程兼容合同；修改时必须同步验证双方，不能把默认值误当作已由宿主强制的安全保证。
 */
export const PORT = 8080;
export const HEALTHCHECK_PATH = "/audit/health";
export const SOLVE_PATH = "/audit/solve";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MEMORY_MB = 512;
export const DEFAULT_CPU = 1;
