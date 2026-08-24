/**
 * 场景适配卡对照展示代理声明的适用与不适用场景；它不运行匹配算法、不推导采购结论，也不隐藏负面场景。
 * 输入是目录条目，输出为两组本地化场景标签，任一集合为空时保留可理解的空态而非猜测内容。
 * 组件为纯展示，无本地状态、持久化、网络请求或导航副作用，且不会调整上游数组顺序。
 * 场景标签来自目录内容边界，只能作为说明信息，不能当作运行权限、服务可用性或安全承诺；React 文本渲染负责隔离标记注入。
 * “适用/不适用”必须通过可见标题与样式共同表达，不可仅靠实线/虚线区分；响应式两栏改为单栏时仍保持适用在前、不适用在后的阅读顺序。
 */
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";

interface ScenarioFitCardProps {
  entry: AgentCatalogEntry;
}

export function ScenarioFitCard({ entry }: ScenarioFitCardProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("scenarios.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("scenarios.fit")}
          </p>
          {entry.scenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entry.scenarios.map((scenario) => (
                <span
                  key={scenario.id}
                  className="rounded-md border border-border bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {pickText(scenario.label, locale)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("scenarios.unfit")}
          </p>
          {entry.unsuitableScenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("scenarios.noUnfit")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entry.unsuitableScenarios.map((scenario) => (
                <span
                  key={scenario.id}
                  className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {pickText(scenario.label, locale)}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <Separator className="opacity-0" />
    </Card>
  );
}
