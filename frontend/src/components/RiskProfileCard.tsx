import type { DimensionalScoresOnChain } from "../lib/agentAuditRegistryClient";
import type { RiskProfileSummary, Suitability } from "../lib/sceneSuitability";
import { RadarScoreChart, type DimensionalScoreData } from "./RadarScoreChart";

interface RiskProfileCardProps {
  riskProfile: RiskProfileSummary;
  averageScores: DimensionalScoresOnChain | null;
}

function getSuitabilityClass(suitability: Suitability): string {
  switch (suitability) {
    case "recommended":
      return "suitability-badge--recommended";
    case "acceptable":
      return "suitability-badge--acceptable";
    case "not-recommended":
      return "suitability-badge--not-recommended";
  }
}

function getSuitabilityLabel(suitability: Suitability): string {
  switch (suitability) {
    case "recommended":
      return "Recommended";
    case "acceptable":
      return "Acceptable";
    case "not-recommended":
      return "Not Recommended";
  }
}

function toRadarData(scores: DimensionalScoresOnChain): DimensionalScoreData {
  return {
    security: scores.security,
    task_execution: scores.taskExecution,
    cognitive: scores.cognitive,
    environment: scores.environment,
    engineering: scores.engineering,
    compliance: scores.compliance
  };
}

export function RiskProfileCard({
  riskProfile,
  averageScores
}: RiskProfileCardProps): JSX.Element {
  return (
    <section className="hero-card risk-profile-card">
      <div className="risk-profile__level-header">
        <div>
          <p className="eyebrow">Risk Assessment</p>
          <h2>Agent Risk Profile</h2>
        </div>
        <span className={`risk-badge risk-badge--large ${riskProfile.overallRiskLevel.cssClass}`}>
          {riskProfile.overallRiskLevel.label}
        </span>
      </div>

      {(riskProfile.strengthAreas.length > 0 || riskProfile.weaknessAreas.length > 0) ? (
        <div className="risk-profile__strengths-weaknesses">
          {riskProfile.strengthAreas.length > 0 ? (
            <div className="risk-profile__column">
              <h3 className="risk-profile__column-title risk-profile__column-title--strength">
                Strengths
              </h3>
              <ul className="risk-profile__list">
                {riskProfile.strengthAreas.map((area) => (
                  <li key={area} className="risk-profile__item risk-profile__item--strength">
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {riskProfile.weaknessAreas.length > 0 ? (
            <div className="risk-profile__column">
              <h3 className="risk-profile__column-title risk-profile__column-title--weakness">
                Weaknesses
              </h3>
              <ul className="risk-profile__list">
                {riskProfile.weaknessAreas.map((area) => (
                  <li key={area} className="risk-profile__item risk-profile__item--weakness">
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {averageScores ? (
        <div className="risk-profile__radar">
          <RadarScoreChart scores={toRadarData(averageScores)} />
        </div>
      ) : null}

      {riskProfile.scenarios.length > 0 ? (
        <div className="risk-profile__scenarios">
          <h3>Scene Suitability</h3>
          <div className="scenario-table">
            {riskProfile.scenarios.map((scenario) => (
              <div key={scenario.scenario} className="scenario-row">
                <div className="scenario-row__header">
                  <span className="scenario-row__name">{scenario.scenario}</span>
                  <span className={`suitability-badge ${getSuitabilityClass(scenario.suitability)}`}>
                    {getSuitabilityLabel(scenario.suitability)}
                  </span>
                </div>
                <p className="scenario-row__reasoning">{scenario.reasoning}</p>
                <div className="scenario-row__dimensions">
                  {scenario.keyDimensions.map((dim) => (
                    <span key={dim} className="scenario-row__dim-tag">{dim}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
