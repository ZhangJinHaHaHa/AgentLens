import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend
} from "recharts";

export interface DimensionalScoreData {
  security: number;
  task_execution: number;
  cognitive: number;
  environment: number;
  engineering: number;
  compliance: number;
}

export interface ToolAgentScoreData {
  api_reliability: number;
  data_accuracy: number;
  latency: number;
  error_recovery: number;
}

interface RadarScoreChartProps {
  scores: DimensionalScoreData;
  toolScores?: ToolAgentScoreData;
}

const DIMENSION_LABELS: Record<string, string> = {
  security: "Security",
  task_execution: "Task Exec",
  cognitive: "Cognitive",
  environment: "Environment",
  engineering: "Engineering",
  compliance: "Compliance"
};

const TOOL_DIMENSION_LABELS: Record<string, string> = {
  api_reliability: "API Reliability",
  data_accuracy: "Data Accuracy",
  latency: "Latency",
  error_recovery: "Error Recovery"
};

interface RadarDataPoint {
  dimension: string;
  score: number;
  toolScore?: number;
}

export function RadarScoreChart({ scores, toolScores }: RadarScoreChartProps): JSX.Element {
  const data: RadarDataPoint[] = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
    dimension: label,
    score: scores[key as keyof DimensionalScoreData] ?? 0,
    ...(toolScores ? { toolScore: 0 } : {})
  }));

  if (toolScores) {
    for (const [key, label] of Object.entries(TOOL_DIMENSION_LABELS)) {
      data.push({
        dimension: label,
        score: 0,
        toolScore: toolScores[key as keyof ToolAgentScoreData] ?? 0
      });
    }
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke="rgba(20, 33, 61, 0.12)" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 11, fill: "#6b7280" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
        />
        <Radar
          name="Core Dimensions"
          dataKey="score"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.2}
        />
        {toolScores ? (
          <Radar
            name="Tool Agent"
            dataKey="toolScore"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.15}
          />
        ) : null}
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
