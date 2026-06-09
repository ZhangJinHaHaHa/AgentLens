import { AlertTriangle, CheckCircle2, Clock3, FileWarning, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditReportSummary as AuditReportSummaryData } from "@/domain/auditReportSummary";
import { pickText } from "@/domain/i18nText";
import { cn } from "@/lib/utils";

interface AuditReportSummaryProps {
  summary: AuditReportSummaryData;
}

const SEVERITY_CLASS: Record<AuditReportSummaryData["severity"], string> = {
  success: "border-success/40 ring-1 ring-success/10",
  warning: "border-warning/45 ring-1 ring-warning/15",
  danger: "border-danger/45 ring-1 ring-danger/15",
  neutral: "border-border/70"
};

const BADGE_VARIANT: Record<AuditReportSummaryData["severity"], "success" | "warning" | "danger" | "secondary"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "secondary"
};

export function AuditReportSummary({ summary }: AuditReportSummaryProps): JSX.Element {
  const { t, i18n } = useTranslation("report");
  const locale = i18n.language.startsWith("en") ? "en" : "zh";

  return (
    <Card className={cn("border-foreground/20", SEVERITY_CLASS[summary.severity])}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={BADGE_VARIANT[summary.severity]}>
            {t(`summary.verdict.${summary.verdict}`)}
          </Badge>
          <Badge variant={summary.hashStatus === "verified" ? "success" : summary.hashStatus === "mismatch" ? "danger" : "secondary"}>
            {t(`summary.hash.${summary.hashStatus}`)}
          </Badge>
        </div>
        <CardTitle className="flex items-center gap-2 text-3xl">
          <SummaryIcon severity={summary.severity} />
          {t("summary.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-4">
        <SummaryMetric label={t("summary.score")} value={summary.score === null ? "-" : String(summary.score)} />
        <SummaryMetric label={t("summary.primaryRisk")} value={pickText(summary.primaryRisk, locale)} />
        <SummaryMetric label={t("summary.safetyBoundary")} value={pickText(summary.safetyBoundary, locale)} />
        <SummaryMetric label={t("summary.nextStep")} value={pickText(summary.nextStep, locale)} />
      </CardContent>
    </Card>
  );
}

function SummaryIcon({ severity }: { severity: AuditReportSummaryData["severity"] }): JSX.Element {
  if (severity === "success") return <CheckCircle2 className="h-5 w-5 text-success-foreground" aria-hidden />;
  if (severity === "danger") return <FileWarning className="h-5 w-5 text-danger-foreground" aria-hidden />;
  if (severity === "warning") return <AlertTriangle className="h-5 w-5 text-warning-foreground" aria-hidden />;
  return <Clock3 className="h-5 w-5 text-muted-foreground" aria-hidden />;
}

function SummaryMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="glass-input flex min-w-0 flex-col gap-2 rounded-md border p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        <span>{label}</span>
      </div>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
