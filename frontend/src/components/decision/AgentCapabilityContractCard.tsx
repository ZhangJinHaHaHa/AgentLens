import { Blocks, Fingerprint, Map, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentCatalogEntry, AgentSupportLevel } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import { useLocale } from "@/i18n/useLocale";

interface AgentCapabilityContractCardProps {
  entry: AgentCatalogEntry;
}

const SUPPORT_VARIANT: Record<AgentSupportLevel, BadgeProps["variant"]> = {
  full: "success",
  partial: "warning",
  "jump-out": "secondary",
  unsupported: "muted"
};

export function AgentCapabilityContractCard({ entry }: AgentCapabilityContractCardProps): JSX.Element | null {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");
  const contract = entry.capabilityContract;

  if (!contract) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("capabilityContract.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("capabilityContract.description")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatusItem
            icon={<Map className="h-4 w-4" aria-hidden />}
            label={t("capabilityContract.mapFit")}
            value={t(`capabilityContract.maps.${contract.mapFit}`)}
          />
          <StatusItem
            icon={<Fingerprint className="h-4 w-4" aria-hidden />}
            label={t("capabilityContract.runtimeMode")}
            value={t(`capabilityContract.runtimeModes.${contract.runtimeMode}`)}
          />
          <StatusBadgeItem
            label={t("capabilityContract.mobileSupport")}
            value={t(`capabilityContract.support.${contract.mobileSupport}`)}
            variant={SUPPORT_VARIANT[contract.mobileSupport]}
          />
          <StatusBadgeItem
            label={t("capabilityContract.desktopSupport")}
            value={t(`capabilityContract.support.${contract.desktopSupport}`)}
            variant={SUPPORT_VARIANT[contract.desktopSupport]}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChipGroup
            icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
            label={t("capabilityContract.inputs")}
            values={contract.inputTypes.map((item) => t(`capabilityContract.inputTypes.${item}`))}
          />
          <ChipGroup
            icon={<Blocks className="h-4 w-4" aria-hidden />}
            label={t("capabilityContract.outputs")}
            values={contract.outputTypes.map((item) => t(`capabilityContract.outputTypes.${item}`))}
          />
          <ChipGroup
            icon={<Blocks className="h-4 w-4" aria-hidden />}
            label={t("capabilityContract.requiredTools")}
            values={contract.requiredTools.map((item) => t(`capabilityContract.tools.${item}`))}
          />
          <ChipGroup
            icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
            label={t("capabilityContract.permissions")}
            values={
              contract.permissionNeeds.length > 0
                ? contract.permissionNeeds.map((item) => t(`capabilityContract.permissionsList.${item}`))
                : [t("capabilityContract.noSpecialPermission")]
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChipGroup
            label={t("capabilityContract.pricingMode")}
            values={[t(`capabilityContract.pricingModes.${contract.pricingMode}`)]}
          />
          <ChipGroup
            label={t("capabilityContract.trustSignals")}
            values={contract.trustSignals.map((item) => t(`capabilityContract.trustSignalsList.${item}`))}
          />
        </div>

        {contract.knownLimits && contract.knownLimits.length > 0 ? (
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("capabilityContract.knownLimits")}
            </div>
            <ul className="flex flex-col gap-2 text-sm text-foreground">
              {contract.knownLimits.map((limit, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  <span>{pickText(limit, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatusItem({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function StatusBadgeItem({
  label,
  value,
  variant
}: {
  label: string;
  value: string;
  variant: BadgeProps["variant"];
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <Badge variant={variant} className="w-fit max-w-full">
        <span className="truncate">{value}</span>
      </Badge>
    </div>
  );
}

function ChipGroup({
  icon,
  label,
  values
}: {
  icon?: React.ReactNode;
  label: string;
  values: string[];
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-card/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge key={value} variant="muted" className="max-w-full">
            <span className="truncate">{value}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
