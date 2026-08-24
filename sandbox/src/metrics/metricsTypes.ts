/**
 * 本文件规定计数器、仪表、快照与告警规则的最小结构合同；不规定采样周期、持久化、阈值来源或传输协议。
 * collectedAt 是 ISO 时间字符串，Counter/Gauge 数值及名称由采集器负责约束；外部反序列化的数据仍需运行时验证，readonly 不等同于可信。
 * 字段名称与可选性被健康服务器和告警消费者共享，变更必须保持 JSON 兼容；evaluate 可能执行任意调用方实现，但内置规则按纯同步函数使用。
 */
export interface Counter {
  readonly name: string;
  readonly value: number;
}

export interface Gauge {
  readonly name: string;
  readonly value: number;
}

export interface MetricsSnapshot {
  readonly counters: readonly Counter[];
  readonly gauges: readonly Gauge[];
  readonly collectedAt: string;
}

export interface AlertResult {
  readonly firing: boolean;
  readonly message: string;
}

export interface AlertRule {
  readonly name: string;
  readonly evaluate: (metrics: MetricsSnapshot) => AlertResult;
}
