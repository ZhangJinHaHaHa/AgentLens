import type { AuditQuestionMeta, AnswerEvaluationMeta } from "../lib/auditReportClient";

interface AuditQuestionsSectionProps {
  questions: AuditQuestionMeta[];
  evaluations?: AnswerEvaluationMeta[];
}

const CATEGORY_CLASS: Record<string, string> = {
  functionality: "category-badge--functionality",
  security: "category-badge--security",
  robustness: "category-badge--robustness",
  performance: "category-badge--performance",
  authorization_boundary: "category-badge--auth-boundary",
  privilege_escalation: "category-badge--priv-escalation"
};

const CATEGORY_LABEL: Record<string, string> = {
  functionality: "Functionality",
  security: "Security",
  robustness: "Robustness",
  performance: "Performance",
  authorization_boundary: "Auth Boundary",
  privilege_escalation: "Priv Escalation"
};

function getCategoryClass(category: string): string {
  return CATEGORY_CLASS[category] ?? "category-badge--functionality";
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

export function AuditQuestionsSection({ questions, evaluations }: AuditQuestionsSectionProps): JSX.Element {
  const evalMap = new Map(
    (evaluations ?? []).map((e) => [e.questionId, e])
  );

  return (
    <section className="hero-card">
      <h2>Audit questions</h2>
      <p className="intro" style={{ marginBottom: 16 }}>
        LLM-generated questions used to evaluate this agent.
      </p>
      <div className="question-list">
        {questions.map((q) => {
          const evaluation = evalMap.get(q.id);
          return (
            <div key={q.id} className="question-card">
              <div className="question-card-header">
                <span className="question-id">{q.id}</span>
                <span className={`category-badge ${getCategoryClass(q.category)}`}>
                  {getCategoryLabel(q.category)}
                </span>
                {evaluation ? (
                  <span className={`eval-badge ${evaluation.passed ? "eval-badge--passed" : "eval-badge--failed"}`}>
                    {evaluation.passed ? "Passed" : "Failed"} ({evaluation.score}/100)
                  </span>
                ) : null}
              </div>
              <p className="question-text">{q.question}</p>
              <div className="question-expected">
                <span className="question-expected-label">Expected behavior</span>
                <p className="question-expected-text">{q.expectedBehavior}</p>
              </div>
              {evaluation ? (
                <div className="question-evaluation">
                  <span className="question-expected-label">LLM evaluation</span>
                  <p className="question-expected-text">{evaluation.reasoning}</p>
                  {evaluation.securityFlags.length > 0 ? (
                    <div className="security-flags">
                      {evaluation.securityFlags.map((flag) => (
                        <span key={flag} className="security-flag">{flag}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
