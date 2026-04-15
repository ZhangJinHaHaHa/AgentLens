import type { AuditQuestionMeta } from "../lib/auditReportClient";

interface AuditQuestionsSectionProps {
  questions: AuditQuestionMeta[];
}

const CATEGORY_CLASS: Record<string, string> = {
  functionality: "category-badge--functionality",
  security: "category-badge--security",
  robustness: "category-badge--robustness",
  performance: "category-badge--performance"
};

function getCategoryClass(category: string): string {
  return CATEGORY_CLASS[category] ?? "category-badge--functionality";
}

export function AuditQuestionsSection({ questions }: AuditQuestionsSectionProps): JSX.Element {
  return (
    <section className="hero-card">
      <h2>Audit questions</h2>
      <p className="intro" style={{ marginBottom: 16 }}>
        LLM-generated questions used to evaluate this agent.
      </p>
      <div className="question-list">
        {questions.map((q) => (
          <div key={q.id} className="question-card">
            <div className="question-card-header">
              <span className="question-id">{q.id}</span>
              <span className={`category-badge ${getCategoryClass(q.category)}`}>
                {q.category}
              </span>
            </div>
            <p className="question-text">{q.question}</p>
            <div className="question-expected">
              <span className="question-expected-label">Expected behavior</span>
              <p className="question-expected-text">{q.expectedBehavior}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
