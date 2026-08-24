/**
 * 代理详情页是目录条目的阅读编排器：按 overview/demo/trust/resources 组织决策组件，并仅为原生条目挂载链上与定价视图；各子域的评分、网络客户端和写操作仍由其所有者负责。
 * 输入为已校验 `AppConfig` 以及路由 id/query/hash，输出覆盖加载、未找到和完整详情三类页面状态。
 * 本地状态拥有活动标签；两个 effect 分别同步白名单 tab 查询参数与片段滚动，安装按钮只切换 resources 并定位资源区，不执行真实安装。
 * 路径 id、`tab`、hash 和目录条目均处于浏览器/内容信任边界：tab 必须经枚举收窄，DOM 定位只按 id，原生链上数据和外链继续由专门组件校验或隔离。
 * URL 与标签状态需双向保持且使用 replace 避免污染历史；加载与缺失必须可区分，Tabs 保留键盘语义，深链片段在面板渲染后再滚动且不得改变信息访问权限。
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, Compass, ExternalLink, ShieldCheck, Video } from "lucide-react";

import { AgentDemoGallery } from "@/components/agent/AgentDemoGallery";
import { AgentDetailHeader } from "@/components/agent/AgentDetailHeader";
import { AgentCapabilityContractCard } from "@/components/decision/AgentCapabilityContractCard";
import { DecisionSummaryCard } from "@/components/decision/DecisionSummaryCard";
import { OfficialResourcesCard } from "@/components/decision/OfficialResourcesCard";
import { RiskExplainCard } from "@/components/decision/RiskExplainCard";
import { RuntimeBoundaryCard } from "@/components/decision/RuntimeBoundaryCard";
import { ScenarioFitCard } from "@/components/decision/ScenarioFitCard";
import { OnboardingGuideCard } from "@/components/onboarding/OnboardingGuideCard";
import { NativeChainPanel } from "@/components/native/NativeChainPanel";
import { PricingCard } from "@/components/native/PricingCard";
import { TrustEvidenceCard } from "@/components/trust/TrustEvidenceCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/i18n/useLocale";
import type { AppConfig } from "@/config/appConfig";
import { useCatalog } from "@/hooks/useCatalog";
import { isNativeEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";

type DetailTabId = "overview" | "demo" | "trust" | "resources";

interface AgentDetailPageProps {
  config: AppConfig;
}

export function AgentDetailPage({ config }: AgentDetailPageProps): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { locale, buildPath } = useLocale();
  const { t } = useTranslation("detail");
  const { byId, nativeStatus } = useCatalog({ config });
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<DetailTabId>(() => readDetailTab(searchParams.get("tab")) ?? "overview");

  const entry = id ? byId.get(id) : undefined;
  useEffect(() => {
    const nextTab = readDetailTab(searchParams.get("tab"));
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, searchParams]);

  useEffect(() => {
    if (!location.hash) return;
    window.setTimeout(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
  }, [activeTab, location.hash]);

  const setDetailTab = (nextTab: DetailTabId): void => {
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === "overview") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }
    setSearchParams(nextParams, { replace: true });
  };
  const openInstall = (): void => {
    setDetailTab("resources");
    window.setTimeout(() => {
      document.getElementById("agent-resources")?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
  };

  if (!entry) {
    if (nativeStatus === "loading") {
      return (
        <section className="container-page py-24">
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              …
            </CardContent>
          </Card>
        </section>
      );
    }
    return (
      <section className="container-page py-24">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-base font-medium text-foreground">{t("errors.notFound")}</p>
            <Button asChild>
              <Link to={buildPath("/agents")}>{t("errors.tryHome")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <AgentDetailHeader entry={entry} onInstallClick={openInstall} primaryAction="install" />
      <div className="container-page flex flex-col gap-6 py-8 sm:py-10">
        <p className="max-w-3xl text-base text-muted-foreground">{pickText(entry.intro, locale)}</p>

        <Tabs value={activeTab} onValueChange={(value) => setDetailTab(value as DetailTabId)} className="flex flex-col gap-6">
          <div className="sticky top-14 z-30 -mx-4 border-y border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-8 sm:px-8">
            <TabsList className="h-auto border-0">
              <DetailTabTrigger id="overview" icon={<Compass className="h-4 w-4" aria-hidden />} />
              <DetailTabTrigger id="demo" icon={<Video className="h-4 w-4" aria-hidden />} />
              <DetailTabTrigger id="trust" icon={<ShieldCheck className="h-4 w-4" aria-hidden />} />
              <DetailTabTrigger id="resources" icon={<ExternalLink className="h-4 w-4" aria-hidden />} />
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0">
            <div className="flex flex-col gap-6">
              <SectionIntro
                icon={<Compass className="h-4 w-4" aria-hidden />}
                title={t("detailTabs.overview.title")}
                description={t("detailTabs.overview.description")}
              />
              <DecisionSummaryCard entry={entry} />
              <RuntimeBoundaryCard entry={entry} />
              <AgentCapabilityContractCard entry={entry} />
              <ScenarioFitCard entry={entry} />
              <RiskExplainCard entry={entry} />
              <OnboardingGuideCard entry={entry} />
            </div>
          </TabsContent>

          <TabsContent value="demo" className="mt-0">
            <div className="flex flex-col gap-6">
              <SectionIntro
                icon={<Video className="h-4 w-4" aria-hidden />}
                title={t("detailTabs.demo.title")}
                description={t("detailTabs.demo.description")}
              />
              <AgentDemoGallery entry={entry} />
            </div>
          </TabsContent>

          <TabsContent value="trust" className="mt-0">
            <div className="flex flex-col gap-6">
              <SectionIntro
                icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
                title={t("detailTabs.trust.title")}
                description={t("detailTabs.trust.description")}
              />
              <TrustEvidenceCard entry={entry} />
              {isNativeEntry(entry) ? <NativeChainPanel config={config} tokenId={entry.tokenId ?? entry.id} /> : null}
              {isNativeEntry(entry) ? <PricingCard entry={entry} /> : null}
            </div>
          </TabsContent>

          <TabsContent id="agent-resources" value="resources" className="mt-0">
            <div className="flex flex-col gap-6">
              <SectionIntro
                icon={<BookOpen className="h-4 w-4" aria-hidden />}
                title={t("detailTabs.resources.title")}
                description={t("detailTabs.resources.description")}
              />
              <OfficialResourcesCard entry={entry} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

function readDetailTab(value: string | null): DetailTabId | null {
  if (
    value === "overview" ||
    value === "demo" ||
    value === "trust" ||
    value === "resources"
  ) {
    return value;
  }
  return null;
}

function DetailTabTrigger({ id, icon, label }: { id: DetailTabId; icon: React.ReactNode; label?: string }): JSX.Element {
  const { t } = useTranslation("detail");

  return (
    <TabsTrigger
      value={id}
      className="h-9 rounded-md border border-transparent px-3 data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:after:hidden"
    >
      <span className="flex items-center gap-2">
        {icon}
        <span>{label ?? t(`detailTabs.${id}.label`)}</span>
      </span>
    </TabsTrigger>
  );
}

function SectionIntro({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
