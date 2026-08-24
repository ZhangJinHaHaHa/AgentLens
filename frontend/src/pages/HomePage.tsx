/**
 * 首页负责产品导览、场景快捷入口、精选代理和自然语言需求起点；它不在首页完成筛选结果、代理执行、钱包连接或交易。
 * 输入为应用配置，输出基于当前目录/语言的 hero 表单、有效场景格、精选卡片与信任说明，提交后导航到规范化的目录筛选 URL。
 * 本地状态拥有 query、解析忙碌和错误；提交会调用 LLM 需求解析，成功将类型化结果编码成查询参数，失败保留页面并显示统一降级提示。
 * 用户需求、目录 taxonomy 和远端解析结果都是不可信边界，只有领域转换后的允许筛选值可进入 URL；LLM 输出仅用于发现路径，不能触发代理或任何高权限操作。
 * 空查询直接进入目录，提交期间禁用按钮以防明显重复，错误以 role=alert 呈现且编辑后清除；表单有搜索名称，场景/精选顺序和缺失 facet 的过滤行为须保持深链兼容。
 */
import { ArrowRight, Compass, Eye, Lightbulb, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { AgentList } from "@/components/agent/AgentList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/useLocale";
import { cn } from "@/lib/utils";
import type { AppConfig } from "@/config/appConfig";
import { useCatalog } from "@/hooks/useCatalog";
import { buildCatalogFacets, filtersToSearchParams } from "@/domain/filters";
import { buildNeedParserTaxonomy, toFiltersFromNeedParse } from "@/domain/needParser";
import { parseNeedWithLlm } from "@/lib/needParserClient";

interface HomePageProps {
  config: AppConfig;
}

const SCENARIO_TILES: Array<{ key: string; scenarioId: string }> = [
  { key: "defi", scenarioId: "defi-trading" },
  { key: "support", scenarioId: "customer-support" },
  { key: "devops", scenarioId: "devops-sre" },
  { key: "data", scenarioId: "data-analysis" },
  { key: "dev", scenarioId: "developer-assistant" },
  { key: "automation", scenarioId: "workflow-automation" },
  { key: "content", scenarioId: "content-generation" },
  { key: "research", scenarioId: "market-research" }
];

const WHY_ICONS: Record<string, JSX.Element> = {
  facts: <Eye className="h-5 w-5" aria-hidden />,
  evidence: <ShieldCheck className="h-5 w-5" aria-hidden />,
  next: <Compass className="h-5 w-5" aria-hidden />
};

export function HomePage({ config }: HomePageProps): JSX.Element {
  const navigate = useNavigate();
  const { buildPath, locale } = useLocale();
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("common");

  const { entries, bySource } = useCatalog({ config });
  const facets = useMemo(() => buildCatalogFacets(entries), [entries]);
  const scenarioTiles = useMemo(
    () => SCENARIO_TILES.filter((tile) => facets.scenarioIds.includes(tile.scenarioId)),
    [facets.scenarioIds]
  );
  const curatedShowcase = bySource.curated.slice(0, 6);

  const [query, setQuery] = useState("");
  const [isParsingNeed, setIsParsingNeed] = useState(false);
  const [needParseError, setNeedParseError] = useState("");

  async function submitSearch(): Promise<void> {
    const trimmed = query.trim();
    setNeedParseError("");
    if (!trimmed) {
      navigate({ pathname: buildPath("/agents") });
      return;
    }

    setIsParsingNeed(true);
    const parsed = await parseNeedWithLlm({
      query: trimmed,
      locale,
      taxonomy: buildNeedParserTaxonomy(entries),
    });
    setIsParsingNeed(false);

    if (parsed.ok) {
      const filters = toFiltersFromNeedParse(parsed.result, trimmed);
      const params = filtersToSearchParams(filters);
      const search = params.toString();
      navigate({
        pathname: buildPath("/agents"),
        search: search ? `?${search}` : undefined
      });
      return;
    }

    setNeedParseError(parsed.error || t("hero.llmUnavailable"));
  }

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="container-page pt-24 pb-20">
        <div className="flex flex-col items-start gap-6 max-w-3xl">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("hero.eyebrow")}
          </span>
          <h1 className="text-display text-4xl sm:text-5xl md:text-6xl">{t("hero.title")}</h1>
          <p className="text-base text-muted-foreground sm:text-lg">{t("hero.subtitle")}</p>

          <form
            className="mt-2 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void submitSearch();
            }}
          >
            <Input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (needParseError) setNeedParseError("");
              }}
              placeholder={t("hero.searchPlaceholder")}
              className="h-12 flex-1 text-base"
              aria-label={tc("actions.search")}
            />
            <Button type="submit" size="lg" disabled={isParsingNeed}>
              {isParsingNeed ? t("hero.parsingCta") : t("hero.primaryCta")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </form>
          {needParseError ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {t("hero.llmUnavailable")}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("hero.llmDemoNotice")}</p>

        </div>
      </section>

      <Divider />

      {/* Scenario tiles */}
      <section className="container-page py-20">
        <SectionHeading title={t("scenarios.title")} description={t("scenarios.subtitle")} />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {scenarioTiles.map((tile, index) => (
            <Link
              key={tile.key}
              to={`${buildPath("/agents")}?scenario=${tile.scenarioId}`}
              className={cn(
                "group surface-card-interactive flex h-28 flex-col justify-between p-4",
                "hover:border-foreground/40"
              )}
            >
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex items-end justify-between">
                <span className="text-base font-medium text-foreground">
                  {t(`scenarios.items.${tile.key}`)}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Divider />

      {/* Curated showcase */}
      <section className="container-page py-20">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <SectionHeading title={t("curated.title")} description={t("curated.subtitle")} />
          <Button asChild variant="ghost" size="sm" className="md:self-end">
            <Link to={buildPath("/agents")}>
              {t("curated.viewAll")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="mt-10">
          <AgentList entries={curatedShowcase} />
        </div>
      </section>

      {/* Why */}
      <section className="container-page py-20">
        <SectionHeading title={t("why.title")} description={t("why.subtitle")} />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["facts", "evidence", "next"] as const).map((key) => (
            <Card key={key}>
              <CardContent className="flex flex-col gap-3 px-6 py-8">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  {WHY_ICONS[key]}
                </span>
                <h3 className="text-lg font-medium tracking-tight">{t(`why.items.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`why.items.${key}.body`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Divider />

      {/* Trust footer block */}
      <section className="container-page py-20">
        <Card>
          <CardContent className="flex flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-foreground/5 text-foreground">
                <Lightbulb className="h-5 w-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-medium tracking-tight">{t("trust.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("trust.subtitle")}</p>
              </div>
            </div>
            <Button variant="secondary" asChild>
              <Link to={`${buildPath("/agents")}?source=native`}>
                {tc("agentSource.native")}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Divider(): JSX.Element {
  return <div className="container-page" aria-hidden><div className="h-px w-full bg-border" /></div>;
}

interface SectionHeadingProps {
  title: string;
  description?: string;
}

function SectionHeading({ title, description }: SectionHeadingProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-display text-2xl sm:text-4xl">{title}</h2>
      {description ? <p className="max-w-2xl text-base text-muted-foreground">{description}</p> : null}
    </div>
  );
}
