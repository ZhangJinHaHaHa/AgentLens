/**
 * 将固定量纲的信誉分映射为风险徽标，并按当前时间把 Unix 秒级审计时间映射为新鲜度文案/CSS 类。
 * 分类输出只服务展示；函数不联网、不写状态或缓存，但 freshness 读取 `Date.now()`，因此跨时刻及服务端/浏览器执行可能得到不同结果。
 * 调用方必须保证信誉分量纲和时间单位正确，模块不检查 NaN、未来时间或上界；异常输入不得用于服务端风控、授权或资金决策。
 * 非正审计时间稳定显示 No audits，7/30/90 天边界与信誉阈值是既有 UI 兼容规则；没有失败重试，刷新需重新调用。
 */
export type RiskLevel = "low" | "moderate" | "elevated" | "high" | "critical";

export interface RiskClassification {
  level: RiskLevel;
  label: string;
  cssClass: string;
}

export function classifyRisk(reputationScore: number): RiskClassification {
  if (reputationScore >= 8000) {
    return { level: "low", label: "Low Risk", cssClass: "risk-badge--low" };
  }
  if (reputationScore >= 5000) {
    return { level: "moderate", label: "Moderate Risk", cssClass: "risk-badge--moderate" };
  }
  if (reputationScore >= 2000) {
    return { level: "elevated", label: "Elevated Risk", cssClass: "risk-badge--elevated" };
  }
  if (reputationScore >= 500) {
    return { level: "high", label: "High Risk", cssClass: "risk-badge--high" };
  }
  return { level: "critical", label: "Critical Risk", cssClass: "risk-badge--critical" };
}

export interface AuditFreshness {
  label: string;
  cssClass: string;
}

const SEVEN_DAYS = 7 * 24 * 60 * 60;
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const NINETY_DAYS = 90 * 24 * 60 * 60;

export function getAuditFreshness(lastAuditAtUnix: number): AuditFreshness {
  if (lastAuditAtUnix <= 0) {
    return { label: "No audits", cssClass: "freshness-badge--stale" };
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const age = nowUnix - lastAuditAtUnix;

  if (age < SEVEN_DAYS) {
    return { label: "Fresh", cssClass: "freshness-badge--fresh" };
  }
  if (age < THIRTY_DAYS) {
    return { label: "Recent", cssClass: "freshness-badge--recent" };
  }
  if (age < NINETY_DAYS) {
    return { label: "Aging", cssClass: "freshness-badge--aging" };
  }
  return { label: "Stale", cssClass: "freshness-badge--stale" };
}
