/**
 * 演示区将目录中的视频元数据呈现为媒体与文字步骤；没有已发布视频时生成明确标记为 planned 的说明稿，而不是伪造可播放资产。
 * 输入是单个代理条目，输出为一个或多个演示面板，标题、摘要、时长和 transcript 均按当前语言选择。
 * 本组件不保存播放进度或上传状态；浏览器 `<video>` 的媒体加载是唯一 I/O，采用 metadata 预加载并由用户显式控制播放。
 * `videoUrl`、海报和文字均来自目录信任边界：浏览器负责媒体获取，React 负责文本转义，本层不宣称远端内容安全、可达或经过审计。
 * 无媒体、无时长和无 transcript 都必须可阅读地退化；视频具备内容化 `aria-label`，纯装饰图标隐藏，并保持原生 controls 的键盘与辅助技术兼容性。
 */
import { Clock3, FileText, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentCatalogEntry, AgentDemoVideo } from "@/domain/catalog";
import { buildAgentBuyerCardSummary } from "@/domain/agentBuyerCard";
import { pickText } from "@/domain/i18nText";
import { useLocale } from "@/i18n/useLocale";

interface AgentDemoGalleryProps {
  entry: AgentCatalogEntry;
}

export function AgentDemoGallery({ entry }: AgentDemoGalleryProps): JSX.Element {
  const demos = entry.demoVideos && entry.demoVideos.length > 0 ? entry.demoVideos : [buildFallbackDemo(entry)];
  const { t } = useTranslation("detail");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("agentDemos.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("agentDemos.description")}</p>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {demos.map((demo, index) => (
          <DemoPanel key={`${entry.id}-demo-${index}`} demo={demo} />
        ))}
      </CardContent>
    </Card>
  );
}

function buildFallbackDemo(entry: AgentCatalogEntry): AgentDemoVideo {
  const buyerSummary = buildAgentBuyerCardSummary(entry);
  const firstTask = buyerSummary.tasks[0] ?? buyerSummary.outcome;

  return {
    title: {
      zh: `典型用法：${entry.name} 的任务闭环`,
      en: `How to use: ${entry.name} task walkthrough`
    },
    summary: {
      zh: `${buyerSummary.outcome.zh} 真实视频上传前，先用这份典型用法说明它在平台工作区里应该如何完成一个任务。`,
      en: `${buyerSummary.outcome.en} Before a real video is uploaded, this walkthrough shows how it should complete a typical task in the platform workspace.`
    },
    status: "planned",
    durationLabel: { zh: "约 2-3 分钟", en: "About 2-3 minutes" },
    transcript: [
      {
        zh: `输入任务：${firstTask.zh}`,
        en: `Start with the task: ${firstTask.en}`
      },
      {
        zh: `确认运行方式：${buyerSummary.runMode.zh}`,
        en: `Confirm the run path: ${buyerSummary.runMode.en}`
      },
      {
        zh: `查看交付物：${buyerSummary.deliverable.zh}`,
        en: `Review the deliverable: ${buyerSummary.deliverable.en}`
      },
      {
        zh: `检查边界：${buyerSummary.dataBoundary.zh}`,
        en: `Check the boundary: ${buyerSummary.dataBoundary.en}`
      }
    ]
  };
}

function DemoPanel({ demo }: { demo: AgentDemoVideo }): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");
  const title = pickText(demo.title, locale);
  const summary = pickText(demo.summary, locale);
  const duration = demo.durationLabel ? pickText(demo.durationLabel, locale) : null;
  const statusLabel = t(`agentDemos.status.${demo.status}`);

  return (
    <article className="min-w-0 rounded-md border border-border/70 bg-card/50 p-4">
      <div className="overflow-hidden rounded-md border border-border bg-background">
        {demo.videoUrl ? (
          <video
            className="aspect-video w-full bg-muted object-cover"
            controls
            poster={demo.posterUrl}
            preload="metadata"
            aria-label={title}
          >
            <source src={demo.videoUrl} />
          </video>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-muted/30 px-4 text-center">
            <PlayCircle className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium text-foreground">{t("agentDemos.pendingVideo")}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={demo.status === "available" ? "success" : "secondary"}>{statusLabel}</Badge>
          {duration ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {duration}
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <h3 className="text-base font-medium leading-snug text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary}</p>
        </div>

        {demo.transcript && demo.transcript.length > 0 ? (
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              <span>{t("agentDemos.transcript")}</span>
            </div>
            <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-sm leading-6 text-foreground">
              {demo.transcript.map((step, index) => (
                <li key={index}>{pickText(step, locale)}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </article>
  );
}
