/**
 * 对比页把共享选择集解析为目录条目，运行领域对比与叙述规则，并以同列矩阵展示差异；它提供辅助决策，不执行购买、租用、安装或安全授权。
 * 输入为应用配置和最多四个选择 id，输出不足两项的引导空态或包含结论、风险提示、属性矩阵及叙述的页面。
 * 本页无私有表单状态，目录读取由 Hook 管理；移除/清空会写共享对比选择，站内/官方链接点击分别产生路由或离站导航副作用。
 * 选择 id、目录声明、运行安全描述和官方 URL 均跨越客户端/发布者边界，比较胜出与信任徽标不能被解释为担保；离站链接必须保持 noreferrer 隔离。
 * 表格列顺序跟随用户选择且横向滚动不改变语义，移除按钮含代理名称，结论/风险/有无证据均有文字而非只用图标或颜色；缺失目录项与溢出选择需可预测降级。
 */
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, CreditCard, X, ShieldAlert, ShieldCheck, CheckCircle2, Server, Trash2 } from "lucide-react";

import { PageHeading } from "@/components/layout/PageHeading";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/useLocale";
import { useCompareSelection } from "@/hooks/useCompareSelection";
import { useCatalog } from "@/hooks/useCatalog";
import type { AppConfig } from "@/config/appConfig";
import { compareAgents, getCompareAttributeDiffs, type CompareAttributeKey } from "@/domain/compare";
import { buildCompareNarrative } from "@/domain/compareNarrative";
import { getRuntimeSecurity, hasAuditEvidence, type AgentCatalogEntry, type AgentRuntimeSecurityKind } from "@/domain/catalog";
import { computeTrustTier } from "@/domain/trustTier";
import { pickText } from "@/domain/i18nText";
import { TrustTierBadge } from "@/components/trust/TrustTierBadge";
import { cn } from "@/lib/utils";

export function ComparePage({ config }: { config: AppConfig }): JSX.Element {
  const { t } = useTranslation("compare");
  const { t: tc } = useTranslation("common");
  const { buildPath, locale } = useLocale();
  const { ids, hasOverflow, removeId, clearIds } = useCompareSelection();
  const catalog = useCatalog({ config });

  const agents = ids
    .map((id) => catalog.byId.get(id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  if (agents.length < 2) {
    return (
      <section className="container-page py-24 text-center">
        <PageHeading title={t("page.title")} description={t("page.emptyDesc")} />
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link to={buildPath("/agents")}>{t("page.back")}</Link>
          </Button>
        </div>
      </section>
    );
  }

  const result = compareAgents(agents);
  const diffs = getCompareAttributeDiffs(agents);
  const narrative = buildCompareNarrative(agents, result, locale);

  function tdClass(key: CompareAttributeKey): string {
    return cn(
      "p-4 align-top transition-colors",
      diffs[key] ? "text-foreground" : "text-muted-foreground/90"
    );
  }

  return (
    <section className="container-page py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeading title={t("page.title")} description={t("page.subtitle")} />
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={clearIds}
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("page.clear")}
          </Button>
          <Button variant="outline" asChild>
            <Link to={buildPath("/agents")}>{t("page.back")}</Link>
          </Button>
        </div>
      </div>

      {hasOverflow ? (
        <div className="surface-card mb-6 border-warning/40 bg-warning/10 px-5 py-4 text-sm text-foreground">
          {t("page.limit")}
        </div>
      ) : null}

      <div className="surface-card mb-6 border-warning/30 bg-warning/5 px-5 py-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <ShieldAlert className="h-4 w-4 text-warning" aria-hidden />
          {t("runtimeSecurity.notice.title")}
        </h2>
        <ul className="grid gap-1.5 text-xs leading-relaxed text-muted-foreground md:grid-cols-3">
          <li>{t("runtimeSecurity.notice.platformImage")}</li>
          <li>{t("runtimeSecurity.notice.sellerHosted")}</li>
          <li>{t("runtimeSecurity.notice.buyerChoice")}</li>
        </ul>
      </div>

      {/* Conclusion Banner */}
      <div className={cn(
        "surface-card mb-8 p-5",
        result.conclusion === "try-first" ? "border-success/40 ring-1 ring-success/10" :
        result.conclusion === "formal-integration" ? "border-primary/40 ring-1 ring-primary/10" :
        result.conclusion === "avoid-for-now" ? "border-danger/40 ring-1 ring-danger/10" :
        "border-border/70"
      )}>
        <h3 className="mb-2 font-medium flex items-center gap-2 text-lg">
          {result.conclusion === "avoid-for-now" ? (
            <ShieldAlert className="w-5 h-5 text-red-500" aria-hidden />
          ) : (
            <ShieldCheck className={cn("w-5 h-5", result.conclusion === "try-first" ? "text-green-500" : "text-blue-500")} aria-hidden />
          )}
          {t("page.conclusion")}: {t(`page.rules.${result.conclusion}`)}
        </h3>
        {result.winnerId && (
          <p className="text-sm text-muted-foreground opacity-90">
            {t("page.winner")}: <strong className="text-foreground">{catalog.byId.get(result.winnerId)?.name}</strong>
          </p>
        )}
      </div>

      {/* Compare Matrix */}
      <div className="surface-card overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-44" />
            {agents.map((agent) => (
              <col key={agent.id} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="border-b bg-secondary/30 p-4 text-left text-xs font-medium text-muted-foreground">
                {t("page.attrs.dimension")}
              </th>
              {agents.map((agent) => (
                <th key={agent.id} className="group relative border-b bg-card/45 p-4 text-left align-top font-medium">
                  <div className="flex min-h-12 items-start gap-2 pr-7">
                    <Link to={buildPath(`/agent/${agent.id}`)} className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground hover:underline">
                      <span>{agent.name}</span>
                      {agent.id === result.winnerId && (
                        <CheckCircle2 className="ml-2 inline h-4 w-4 shrink-0 align-[-2px] text-green-500" aria-hidden />
                      )}
                    </Link>
                    <button
                      type="button"
                      aria-label={t("page.removeAgent", { name: agent.name })}
                      onClick={() => removeId(agent.id)}
                      className="absolute right-3 top-3 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70 border-b border-border/70">
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.scenario")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("scenario")}>
                  <div className="flex flex-wrap gap-1">
                    {agent.scenarios.map(s => (
                      <span key={s.id} className="rounded-md border bg-secondary/50 px-2 py-0.5 text-[11px] backdrop-blur">
                        {pickText(s.label, locale)}
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.unsuitableScenario")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("unsuitableScenario")}>
                  <div className="flex flex-wrap gap-1">
                    {agent.unsuitableScenarios.length ? agent.unsuitableScenarios.map(s => (
                      <span key={s.id} className="rounded-md border border-red-200 px-2 py-0.5 text-[11px] text-red-600 backdrop-blur dark:border-red-900 dark:text-red-400">
                        {pickText(s.label, locale)}
                      </span>
                    )) : <span className="text-muted-foreground">-</span>}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.trustTier")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("trustTier")}>
                  <TrustTierBadge result={computeTrustTier({ entry: agent })} />
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.runtimeSecurity")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("runtimeSecurity")}>
                  <RuntimeSecurityCell agent={agent} locale={locale} />
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.seller")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("seller")}>
                  {agent.seller ? (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{pickText(agent.seller.label, locale)}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {pickText(agent.seller.contextScale, locale)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.riskLevel")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("riskLevel")}>
                  <span className={cn(
                    "font-medium",
                    agent.riskLevel === "high" ? "text-red-500" :
                    agent.riskLevel === "medium" ? "text-yellow-500" : "text-green-500"
                  )}>
                    {tc(`risk.${agent.riskLevel}`)}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.complexity")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("complexity")}>
                  {tc(`complexity.${agent.complexity}`)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.auditEvidence")}</td>
              {agents.map((agent) => {
                const hasEvidence = hasAuditEvidence(agent);
                return (
                  <td key={agent.id} className={tdClass("auditEvidence")}>
                    {hasEvidence ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <Check className="w-4 h-4" /> {t("page.has")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <X className="w-4 h-4" /> {t("page.none")}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.onboarding")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("onboarding")}>
                  {agent.hasOnboardingGuide ? (
                    <span className="flex items-center gap-1 text-foreground">
                      <Check className="w-4 h-4" /> {t("page.has")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <X className="w-4 h-4" /> {t("page.none")}
                    </span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.pricing")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("pricing")}>
                  {agent.pricingHint ? pickText(agent.pricingHint, locale) : <span className="text-muted-foreground">-</span>}
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.rentalLifecycle")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className="p-4 align-top text-foreground">
                  <Button asChild size="sm" variant="outline">
                    <Link to={buildPath(`/agent/${agent.id}#rental-lifecycle`)}>
                      <CreditCard className="h-3.5 w-3.5" aria-hidden />
                      {t("page.rentalLifecycleAction")}
                    </Link>
                  </Button>
                </td>
              ))}
            </tr>
            <tr>
              <td className="bg-card/35 p-4 font-medium text-muted-foreground backdrop-blur">{t("page.attrs.officialRoute")}</td>
              {agents.map((agent) => (
                <td key={agent.id} className={tdClass("officialRoute")}>
                  {agent.officialUrl ? (
                    <a href={agent.officialUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Link
                    </a>
                  ) : <span className="text-muted-foreground">-</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {narrative ? (
        <div className="surface-card mt-8 p-5">
          <h3 className="mb-2 text-lg font-medium">{t("narrative.title")}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{narrative}</p>
        </div>
      ) : null}
    </section>
  );
}

function RuntimeSecurityCell({
  agent,
  locale
}: {
  agent: AgentCatalogEntry;
  locale: "zh" | "en";
}): JSX.Element {
  const status = getRuntimeSecurity(agent);
  const tone = runtimeSecurityTone(status.kind);
  const Icon = tone.Icon;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium", tone.badgeClass)}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {pickText(status.label, locale)}
        </span>
        {status.evidenceLabel ? (
          <span className="rounded-md border border-border/70 bg-card/55 px-2 py-0.5 text-[11px] text-muted-foreground">
            {pickText(status.evidenceLabel, locale)}
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{pickText(status.description, locale)}</p>
    </div>
  );
}

function runtimeSecurityTone(kind: AgentRuntimeSecurityKind): {
  Icon: typeof ShieldCheck;
  badgeClass: string;
} {
  switch (kind) {
    case "platform_image":
      return {
        Icon: ShieldCheck,
        badgeClass: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
      };
    case "seller_runtime":
      return {
        Icon: ShieldAlert,
        badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      };
    case "external_tool":
      return {
        Icon: Server,
        badgeClass: "border-border bg-secondary/50 text-muted-foreground"
      };
  }
}
