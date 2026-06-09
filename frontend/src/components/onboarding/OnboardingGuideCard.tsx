import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/i18n/useLocale";
import { cn } from "@/lib/utils";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import type { OnboardingGuide } from "@/domain/onboarding";
import { getOnboardingGuide } from "@/data/catalog/onboarding";

interface OnboardingGuideCardProps {
  entry: AgentCatalogEntry;
}

export function OnboardingGuideCard({ entry }: OnboardingGuideCardProps): JSX.Element {
  const { t } = useTranslation("detail");
  const guide = getOnboardingGuide(entry.id);
  const officialLinks = [
    entry.officialUrl ? { label: t("official.homepage"), url: entry.officialUrl } : null,
    entry.docsUrl ? { label: t("official.docs"), url: entry.docsUrl } : null,
    entry.pricingUrl ? { label: t("official.pricing"), url: entry.pricingUrl } : null
  ].filter((item): item is { label: string; url: string } => item !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("onboarding.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {guide ? (
          <OnboardingTabs guide={guide} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("onboarding.missing")}</p>
            {officialLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {officialLinks.map((link) => (
                  <Button key={link.url} asChild variant="secondary" size="sm">
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.label}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OnboardingTabs({ guide }: { guide: OnboardingGuide }): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");

  return (
    <Tabs defaultValue="prereq" className="w-full">
      <TabsList className="w-full justify-start gap-1 overflow-x-auto scrollbar-none">
        <TabsTrigger value="prereq">{t("onboarding.tabs.prereq")}</TabsTrigger>
        <TabsTrigger value="firstStep">{t("onboarding.tabs.firstStep")}</TabsTrigger>
        <TabsTrigger value="steps">{t("onboarding.tabs.steps")}</TabsTrigger>
        <TabsTrigger value="pitfalls">{t("onboarding.tabs.pitfalls")}</TabsTrigger>
        <TabsTrigger value="official">{t("onboarding.tabs.official")}</TabsTrigger>
      </TabsList>

      <TabsContent value="prereq">
        <List items={guide.prerequisites.map((item) => pickText(item, locale))} />
      </TabsContent>

      <TabsContent value="firstStep">
        <div className="flex flex-col gap-3">
          <p className="rounded-md border border-foreground/20 bg-foreground/5 px-4 py-3 text-sm text-foreground">
            {pickText(guide.firstStep, locale)}
          </p>
          <PlatformAdvice guide={guide} />
        </div>
      </TabsContent>

      <TabsContent value="steps">
        <ol className="flex flex-col gap-5">
          {guide.steps.map((step, idx) => (
            <li key={idx} className="flex flex-col gap-2 border-l border-border pl-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="font-mono text-foreground">{String(idx + 1).padStart(2, "0")}</span>
                <span>·</span>
                <span>{pickText(step.title, locale)}</span>
              </div>
              <p className="text-sm text-foreground">{pickText(step.body, locale)}</p>
              {step.codeBlock ? (
                <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs leading-relaxed">
                  <code>{step.codeBlock}</code>
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      </TabsContent>

      <TabsContent value="pitfalls">
        <List items={guide.commonPitfalls.map((item) => pickText(item, locale))} variant="warn" />
      </TabsContent>

      <TabsContent value="official">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("onboarding.officialDocsLabel")}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {guide.officialDocs.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "group glass-input flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm",
                    "hover:border-foreground/40"
                  )}
                >
                  <span>{pickText(link.label, locale)}</span>
                  <ArrowUpRight
                    className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function List({
  items,
  variant = "default"
}: {
  items: string[];
  variant?: "default" | "warn";
}): JSX.Element {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2">
          <span
            aria-hidden
            className={cn(
              "mt-2 h-1 w-1 shrink-0 rounded-full",
              variant === "warn" ? "bg-warning" : "bg-foreground/60"
            )}
          />
          <span className="text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PlatformAdvice({ guide }: { guide: OnboardingGuide }): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");
  return (
    <div className="rounded-md border border-border bg-muted/50 px-4 py-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("onboarding.platformAdvice")}
      </p>
      <p className="text-sm text-foreground">{pickText(guide.platformAdvice, locale)}</p>
    </div>
  );
}
