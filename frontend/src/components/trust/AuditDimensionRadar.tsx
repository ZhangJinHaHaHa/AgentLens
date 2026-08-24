/**
 * 六维雷达视图把审计维度转换为 0–100 的图形和逐项数值条；它不计算审计结论、不比较不同报告，也不验证评分来源。
 * 输入为带稳定 key、可见 label 和数值的数组及可选样式，输出为响应式 Recharts 图和同序的文本化分数列表。
 * 组件无业务状态；图表库可能在浏览器中测量容器，但本层不发起 I/O 或持久化，所有 score 都在渲染前取整并钳制。
 * 分数及标签可能来自远端报告边界，NaN/Infinity 必须归零、越界值必须限制，视觉宽度不能接收未经归一化的 CSS 数据。
 * 文字列表是图形不可读或辅助技术无法解释 SVG 时的等价信息，数值与标签不能只靠颜色；空数组、窄容器及阈值边界都应稳定渲染。
 */
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

import { cn } from "@/lib/utils";

export interface AuditDimensionRadarItem {
  key: string;
  label: string;
  value: number;
}

interface AuditDimensionRadarProps {
  items: AuditDimensionRadarItem[];
  className?: string;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function AuditDimensionRadar({
  items,
  className
}: AuditDimensionRadarProps): JSX.Element {
  const data = items.map((item) => ({
    key: item.key,
    label: item.label,
    score: clampScore(item.value)
  }));

  return (
    <div className={cn("grid gap-5 lg:grid-cols-[minmax(18rem,1fr)_minmax(16rem,0.8fr)]", className)}>
      <div className="h-72 min-h-72 rounded-md border border-border bg-background/60 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickCount={6}
            />
            <Tooltip
              formatter={(value) => [`${String(value)}/100`, "Score"]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                color: "hsl(var(--foreground))"
              }}
            />
            <Radar
              dataKey="score"
              name="Audit score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.22}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {data.map((item) => (
          <div key={item.key} className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium uppercase text-muted-foreground">{item.label}</span>
              <span className="font-mono text-foreground">{item.score}/100</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  item.score >= 70 ? "bg-success" : item.score >= 40 ? "bg-warning" : "bg-danger"
                )}
                style={{ width: `${item.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
