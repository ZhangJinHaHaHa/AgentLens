/**
 * 这是审计评分到 ZK 生成器之间的可选编排层：将评价按六个电路槽分组、限制每槽十题并构造证明 bundle。
 * 分数和资源数据来自已完成的审计阶段；取整、2500/2000/1500/1500/1500/1000 权重及向下取整总分必须与电路保持一致，属于跨组件兼容约束。
 * `ZK_PROOF_ENABLED` 只有精确为 true 才启用，关闭时返回 null；启用后的任何异常会变成 `proofGenerated: false` 的显式失败 bundle，使主审计按既有可用性策略继续。
 * 非致命降级绝不等于已有证明，空 proof 与 `verified: false` 必须被报告、持久化和链上消费者拒绝当作密码学成功。
 * 本层不验证 trusted setup、不发布或保存证明，也不把 bundle 自动加入 attestation；调用方拥有后续处置，捕获失败后无外部状态需要回滚。
 */
import { generateAuditScoreProof, type AuditScoreProofInput, type ZkProofResult } from "./generateAuditScoreProof";

/**
 * Integration layer between the audit pipeline and ZK proof generation.
 *
 * Called after dimensional scoring (Phase 3 of the audit pipeline),
 * before attestation (Phase 4). Generates a ZK proof that the claimed
 * scores were correctly computed from raw evaluation data.
 *
 * The proof is included in the attestation bundle and stored alongside
 * the audit report.
 *
 * Controlled by environment variable: ZK_PROOF_ENABLED=true
 */

export interface DimensionalScoreResult {
  security: number;
  task_execution: number;
  cognitive: number;
  environment: number;
  engineering: number;
  compliance: number;
}

export interface AuditEvaluationData {
  answerEvaluations: ReadonlyArray<{
    category: string;
    score: number;
  }>;
  cpuAvgMilli: number;
  memoryPeakMb: number;
  complianceScore: number;
  securityBoundaryScore: number;
}

export interface ZkAuditProofBundle {
  auditScoreProof: ZkProofResult;
  proofGenerated: boolean;
  generatedAt: string;
  circuitId: string;
  error: string | null;
}

const CATEGORY_TO_DIMENSION: Record<string, number> = {
  security: 0,
  authorization_boundary: 0,
  privilege_escalation: 0,
  functionality: 1,
  cognitive: 2,
  robustness: 3,
  performance: 4,
  compliance: 5
};

const MAX_QUESTIONS = 10;

function isZkProofEnabled(): boolean {
  return process.env.ZK_PROOF_ENABLED === "true";
}

/**
 * Map raw evaluation data to circuit input format.
 */
function buildCircuitInput(
  scores: DimensionalScoreResult,
  evaluationData: AuditEvaluationData
): AuditScoreProofInput {
  // Group answer evaluations by dimension
  const categoryScores: number[][] = [[], [], [], [], [], []];

  for (const evaluation of evaluationData.answerEvaluations) {
    const dimIndex = CATEGORY_TO_DIMENSION[evaluation.category];
    if (dimIndex !== undefined && categoryScores[dimIndex].length < MAX_QUESTIONS) {
      categoryScores[dimIndex].push(Math.round(evaluation.score));
    }
  }

  const categoryCounts = categoryScores.map((scores) => scores.length);

  // Compute overall score
  const dimArray: [number, number, number, number, number, number] = [
    scores.security,
    scores.task_execution,
    scores.cognitive,
    scores.environment,
    scores.engineering,
    scores.compliance
  ];

  const weights = [2500, 2000, 1500, 1500, 1500, 1000];
  const weightedSum = dimArray.reduce((sum, s, i) => sum + s * weights[i], 0);
  const overallScore = Math.floor(weightedSum / 10000);

  return {
    dimensionalScores: dimArray,
    overallScore,
    categoryScores,
    categoryCounts,
    cpuAvgMilli: Math.round(evaluationData.cpuAvgMilli),
    memoryPeakMb: Math.round(evaluationData.memoryPeakMb),
    complianceScore: Math.round(evaluationData.complianceScore),
    securityBoundaryScore: Math.round(evaluationData.securityBoundaryScore)
  };
}

/**
 * Generate a ZK proof for audit score verification.
 * Returns null if ZK_PROOF_ENABLED is not set.
 * Non-fatal: errors are caught and logged, audit continues without proof.
 */
export async function generateAuditZkProof(
  scores: DimensionalScoreResult,
  evaluationData: AuditEvaluationData
): Promise<ZkAuditProofBundle | null> {
  if (!isZkProofEnabled()) {
    return null;
  }

  try {
    const input = buildCircuitInput(scores, evaluationData);
    const proof = await generateAuditScoreProof(input);

    return {
      auditScoreProof: proof,
      proofGenerated: true,
      generatedAt: new Date().toISOString(),
      circuitId: "AuditScoreVerifier-groth16-bn128",
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      auditScoreProof: {
        proof: { pi_a: [], pi_b: [], pi_c: [], protocol: "groth16", curve: "bn128" },
        publicSignals: [],
        inputCommitment: "",
        verified: false
      },
      proofGenerated: false,
      generatedAt: new Date().toISOString(),
      circuitId: "AuditScoreVerifier-groth16-bn128",
      error: message
    };
  }
}
