/**
 * 完整信任说明卡展开层级名称、定义、判定原因和原始证据键值；它解释既有计算结果，不重新打分、不查询链上数据，也不隐藏不利原因。
 * 输入为 `TrustTierResult` 与可选样式，输出为标题、原因列表和在有值时出现的证据定义列表。
 * 组件是纯展示，无状态、持久化或导航副作用，翻译与样式仅在渲染时解析。
 * evidence 值可能来自链、目录或远端报告，必须以纯文本显示且不能被当作已验证凭据；层级样式同样不是授权接口。
 * 层级含义以文字而非色点表达，原因使用列表、证据使用 `dl/dt/dd`，长哈希允许断行；空证据不生成分隔区，旧 reason key 需通过翻译回退可诊断。
 */
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  tierDescriptionKey,
  tierLabelKey,
  type TrustTierResult
} from "@/domain/trustTier";

import { tierStyle } from "./tierStyle";

interface TrustTierExplainProps {
  result: TrustTierResult;
  className?: string;
}

export function TrustTierExplain({ result, className }: TrustTierExplainProps): JSX.Element {
  const { t } = useTranslation("tiers");
  const style = tierStyle(result.tier);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span aria-hidden className={cn("inline-block h-2 w-2 rounded-full", style.dotClass)} />
          <CardTitle>{t(tierLabelKey(result.tier))}</CardTitle>
        </div>
        <CardDescription>{t(tierDescriptionKey(result.tier))}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2 text-sm">
          {result.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <span aria-hidden className={cn("mt-2 h-1 w-1 rounded-full", style.dotClass)} />
              <span className="text-foreground">{t(`reasons.${reason}`)}</span>
            </li>
          ))}
        </ul>
        {result.evidence.length > 0 ? (
          <>
            <Separator />
            <dl className="grid grid-cols-1 gap-3 text-sm">
              {result.evidence.map((item) => (
                <div key={item.key} className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.labelKey ? t(item.labelKey, { defaultValue: item.key }) : item.key}
                  </dt>
                  <dd className="break-all font-mono text-xs text-foreground/80">{item.value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
