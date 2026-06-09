import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/layout/PageHeading";
import { useLocale } from "@/i18n/useLocale";

interface PlaceholderPageProps {
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function PlaceholderPage({
  title,
  description,
  ctaLabel,
  ctaHref
}: PlaceholderPageProps): JSX.Element {
  const { t } = useTranslation("common");
  const { buildPath } = useLocale();

  return (
    <section className="container-page py-24">
      <PageHeading title={title} description={description} />
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link to={ctaHref ? buildPath(ctaHref) : buildPath("/agents")}>
            {ctaLabel ?? t("nav.agents")}
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to={buildPath("/")}>{t("actions.back")}</Link>
        </Button>
      </div>
    </section>
  );
}
