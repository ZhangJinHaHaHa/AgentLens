/**
 * 列表组件只把已确定顺序的代理条目铺成响应式卡片网格；筛选、排序、分页、目录加载和空结果文案均由调用页所有。
 * 输入为条目数组、可选容器样式及可选空态节点，输出要么是逐项 `AgentCard`，要么原样返回空态而不额外包裹视觉容器。
 * 该层无状态、无 I/O、无浏览器副作用；条目的对比交互仍由子卡片及共享上下文负责。
 * 上游目录内容可能不可信，本层不对其真实性背书；稳定键组合来源与 id，既避免跨来源碰撞，也不把列表位置当作身份。
 * 空数组必须不会生成空网格，响应式列数不得改变阅读顺序；语义、键盘目标和字段缺失退化由卡片契约保持，调用方不能依赖此层隐式修复数据。
 */
import type { AgentCatalogEntry } from "@/domain/catalog";
import { cn } from "@/lib/utils";

import { AgentCard } from "./AgentCard";

interface AgentListProps {
  entries: AgentCatalogEntry[];
  className?: string;
  emptyState?: React.ReactNode;
}

export function AgentList({
  entries,
  className,
  emptyState
}: AgentListProps): JSX.Element {
  if (entries.length === 0) {
    return <>{emptyState ?? null}</>;
  }
  return (
    <div className={cn("grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {entries.map((entry) => (
        <AgentCard
          key={`${entry.source}:${entry.id}`}
          entry={entry}
        />
      ))}
    </div>
  );
}
