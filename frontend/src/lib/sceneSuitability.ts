import type { RiskClassification } from "./riskLevel";
import { classifyRisk } from "./riskLevel";

export type Suitability = "recommended" | "acceptable" | "not-recommended";

export interface ScenarioRecommendation {
  scenario: string;
  suitability: Suitability;
  reasoning: string;
  keyDimensions: string[];
}

export interface RiskProfileSummary {
  overallRiskLevel: RiskClassification;
  strengthAreas: string[];
  weaknessAreas: string[];
  scenarios: ScenarioRecommendation[];
}

export interface DimensionalInput {
  security: number;
  taskExecution: number;
  cognitive: number;
  environment: number;
  engineering: number;
  compliance: number;
}

interface ScenarioRule {
  scenario: string;
  requirements: ReadonlyArray<{ dimension: keyof DimensionalInput; threshold: number }>;
  description: string;
}

const SCENARIO_RULES: readonly ScenarioRule[] = [
  {
    scenario: "DeFi / Financial Operations",
    requirements: [
      { dimension: "security", threshold: 70 },
      { dimension: "compliance", threshold: 60 }
    ],
    description: "High-value financial operations requiring strong security and compliance guarantees."
  },
  {
    scenario: "Customer-Facing Chatbot",
    requirements: [
      { dimension: "cognitive", threshold: 60 },
      { dimension: "taskExecution", threshold: 60 }
    ],
    description: "Direct user interaction requiring reliable task handling and cognitive quality."
  },
  {
    scenario: "DevOps / Infrastructure",
    requirements: [
      { dimension: "engineering", threshold: 70 },
      { dimension: "environment", threshold: 60 }
    ],
    description: "System automation requiring engineering rigor and environment resilience."
  },
  {
    scenario: "Data Analysis / Research",
    requirements: [
      { dimension: "taskExecution", threshold: 70 },
      { dimension: "cognitive", threshold: 60 }
    ],
    description: "Analytical tasks requiring high task accuracy and reasoning quality."
  },
  {
    scenario: "General Purpose Automation",
    requirements: [
      { dimension: "taskExecution", threshold: 50 },
      { dimension: "security", threshold: 40 }
    ],
    description: "Low-risk automation tasks with basic security requirements."
  }
];

const DIMENSION_LABELS: Record<keyof DimensionalInput, string> = {
  security: "Security",
  taskExecution: "Task Execution",
  cognitive: "Cognitive",
  environment: "Environment",
  engineering: "Engineering",
  compliance: "Compliance"
};

const ACCEPTABLE_MARGIN = 10;

function evaluateScenario(scores: DimensionalInput, rule: ScenarioRule): ScenarioRecommendation {
  const keyDimensions = rule.requirements.map((r) => DIMENSION_LABELS[r.dimension]);

  const allMet = rule.requirements.every((r) => scores[r.dimension] >= r.threshold);
  if (allMet) {
    return {
      scenario: rule.scenario,
      suitability: "recommended",
      reasoning: `All key dimensions meet or exceed requirements. ${rule.description}`,
      keyDimensions
    };
  }

  const withinMargin = rule.requirements.every(
    (r) => scores[r.dimension] >= r.threshold - ACCEPTABLE_MARGIN
  );
  if (withinMargin) {
    const weak = rule.requirements
      .filter((r) => scores[r.dimension] < r.threshold)
      .map((r) => DIMENSION_LABELS[r.dimension]);
    return {
      scenario: rule.scenario,
      suitability: "acceptable",
      reasoning: `Close to requirements but ${weak.join(", ")} slightly below threshold.`,
      keyDimensions
    };
  }

  const failing = rule.requirements
    .filter((r) => scores[r.dimension] < r.threshold - ACCEPTABLE_MARGIN)
    .map((r) => DIMENSION_LABELS[r.dimension]);
  return {
    scenario: rule.scenario,
    suitability: "not-recommended",
    reasoning: `${failing.join(", ")} significantly below requirements for this use case.`,
    keyDimensions
  };
}

const STRENGTH_THRESHOLD = 70;
const WEAKNESS_THRESHOLD = 40;

export function generateRiskProfile(
  scores: DimensionalInput | null,
  reputationScore: number,
  auditCount: number,
  attestationVerified: boolean
): RiskProfileSummary {
  const overallRiskLevel = classifyRisk(reputationScore);

  if (!scores) {
    return {
      overallRiskLevel,
      strengthAreas: [],
      weaknessAreas: [],
      scenarios: []
    };
  }

  const strengthAreas: string[] = [];
  const weaknessAreas: string[] = [];

  for (const [key, label] of Object.entries(DIMENSION_LABELS)) {
    const value = scores[key as keyof DimensionalInput];
    if (value >= STRENGTH_THRESHOLD) {
      strengthAreas.push(label);
    } else if (value < WEAKNESS_THRESHOLD) {
      weaknessAreas.push(label);
    }
  }

  const scenarios = SCENARIO_RULES.map((rule) => evaluateScenario(scores, rule));

  return {
    overallRiskLevel,
    strengthAreas,
    weaknessAreas,
    scenarios
  };
}
