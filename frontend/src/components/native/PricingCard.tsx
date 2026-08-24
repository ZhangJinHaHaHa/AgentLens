/**
 * 定价卡仅展示目录为原生代理提供的定价标签，并在缺失时回退到通用 pricingHint 或明确无价格状态；它不查询链上报价、不计算租金，也不发起支付。
 * 输入为代理目录条目，输出为按当前语言选择的一段价格说明，原生标签优先于兼容旧条目的提示字段。
 * 组件无状态、无 I/O 和浏览器副作用，且不会修改或缓存目录值。
 * 展示文本来自发布者/目录边界，只能视作提示，不能代替交易前从合约读取的实时金额、币种或费用确认。
 * 有值和无值两条路径都提供可见文字，长价格说明应正常换行；既有字段优先级是数据兼容不变量，不能因新增链上功能让旧条目变成空白。
 */
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";

interface PricingCardProps {
  entry: AgentCatalogEntry;
}

export function PricingCard({ entry }: PricingCardProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");
  const label = entry.nativePricing?.label
    ? pickText(entry.nativePricing.label, locale)
    : entry.pricingHint
      ? pickText(entry.pricingHint, locale)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("native.pricing")}</CardTitle>
      </CardHeader>
      <CardContent>
        {label ? (
          <p className="text-sm text-foreground">{label}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("native.noPricing")}</p>
        )}
      </CardContent>
    </Card>
  );
}
