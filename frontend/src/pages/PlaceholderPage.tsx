/**
 * 占位页为未实现路线和通用未找到状态提供统一标题、说明及返回导航；它不尝试加载缺失功能，也不掩盖配置或运行期异常。
 * 输入为标题、可选说明、CTA 文案和站内路径，输出包含一级标题、主入口及首页返回按钮的简单页面。
 * 组件无状态、I/O 或持久化，唯一副作用是用户激活 React Router 链接后改变客户端地址。
 * 文案和 ctaHref 可能来自路由调用边界，文本由 React 转义，路径必须经语言感知构建且只能被当作站内导航，不应传入脚本或外部可信跳转。
 * CTA 缺省时稳定回到代理目录，第二返回入口始终可用；`PageHeading` 保留 h1 和可选描述语义，两个链接均需有可见名称并支持键盘操作。
 */
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
