import { RadarScoreChart, type DimensionalScoreData, type ToolAgentScoreData } from "./RadarScoreChart";

interface DimensionalScoreCardProps {
  scores: DimensionalScoreData;
  overallScore: number;
  toolScores?: ToolAgentScoreData;
}

const DIMENSION_DETAILS: Array<{ key: keyof DimensionalScoreData; zhLabel: string; enLabel: string }> = [
  { key: "security", zhLabel: "安全性", enLabel: "Security" },
  { key: "task_execution", zhLabel: "任务执行", enLabel: "Task Execution" },
  { key: "cognitive", zhLabel: "认知交互", enLabel: "Cognitive" },
  { key: "environment", zhLabel: "环境适配", enLabel: "Environment" },
  { key: "engineering", zhLabel: "工程落地", enLabel: "Engineering" },
  { key: "compliance", zhLabel: "合规性", enLabel: "Compliance" }
];

function getScoreClass(score: number): string {
  if (score >= 70) return "dim-score--safe";
  if (score >= 40) return "dim-score--warn";
  return "dim-score--danger";
}

export function DimensionalScoreCard({ scores, overallScore, toolScores }: DimensionalScoreCardProps): JSX.Element {
  return (
    <section className="hero-card">
      <div className="dim-card-header">
        <div>
          <h2>Capability assessment</h2>
          <p className="intro">6-dimensional evaluation across core audit metrics.</p>
        </div>
        <div className={`dim-overall ${getScoreClass(overallScore)}`}>
          <span className="dim-overall-value">{overallScore}</span>
          <span className="dim-overall-label">Overall</span>
        </div>
      </div>

      <RadarScoreChart scores={scores} toolScores={toolScores} />

      <div className="dim-details-grid">
        {DIMENSION_DETAILS.map(({ key, zhLabel, enLabel }) => (
          <div key={key} className="dim-detail-row">
            <span className="dim-detail-label">{zhLabel} ({enLabel})</span>
            <span className={`dim-detail-score ${getScoreClass(scores[key])}`}>
              {scores[key]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
