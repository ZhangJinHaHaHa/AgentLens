/**
 * 页面标题原语统一 eyebrow、一级标题和可选描述的排版及对齐；它不生成面包屑、不修改 document title，也不决定页面信息架构。
 * 输入为必需标题、可选说明/眉题/样式及左右对齐策略，输出为保持原字符串内容的标题区块。
 * 组件完全无状态、无副作用，不访问路由、翻译、DOM 或网络；调用方负责传入已经本地化的文字。
 * 标题内容可能来自路由或目录边界，React 文本转义必须保持，本组件不能接收或插入未经处理的 HTML。
 * `h1` 是稳定的可访问页面锚点，调用页应避免再创建竞争的一级标题；可选字段缺失时不产生空语义节点，长文本必须允许换行。
 */
import { cn } from "@/lib/utils";

interface PageHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  align?: "left" | "center";
}

export function PageHeading({
  eyebrow,
  title,
  description,
  className,
  align = "left"
}: PageHeadingProps): JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className
      )}
    >
      {eyebrow ? (
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </span>
      ) : null}
      <h1 className="break-words text-display text-3xl sm:text-4xl">{title}</h1>
      {description ? (
        <p className="max-w-2xl break-words text-base text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
