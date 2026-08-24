import type {
  AuthoritativeDimensionResult,
  CompletedEvaluation,
  EvaluationRecord,
} from "@/lib/evaluation/types";
import type { ReportNarrative } from "@/schemas/evaluation";

export interface PublicEvaluation {
  id: string;
  callType: EvaluationRecord["callType"];
  status: EvaluationRecord["status"];
  currentStage: EvaluationRecord["currentStage"];
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  grade: EvaluationRecord["grade"];
  rawScore: number | null;
  maxPossibleScore: number | null;
  normalizedScore: number | null;
  finalScore: number | null;
  appliedCaps: EvaluationRecord["appliedCaps"];
  oneThing: EvaluationRecord["oneThing"];
  brief: string | null;
  redFlags: ReportNarrative["redFlags"];
  dimensions: AuthoritativeDimensionResult[];
}

export function toPublicEvaluation(
  evaluation: EvaluationRecord | CompletedEvaluation,
): PublicEvaluation {
  return {
    id: evaluation.id,
    callType: evaluation.callType,
    status: evaluation.status,
    currentStage: evaluation.currentStage,
    createdAt: evaluation.createdAt,
    completedAt: evaluation.completedAt,
    errorCode: evaluation.errorCode,
    errorMessage: evaluation.errorMessage,
    grade: evaluation.grade,
    rawScore: evaluation.rawScore,
    maxPossibleScore: evaluation.maxPossibleScore,
    normalizedScore: evaluation.normalizedScore,
    finalScore: evaluation.finalScore,
    appliedCaps: evaluation.appliedCaps,
    oneThing: evaluation.oneThing,
    brief: evaluation.brief,
    redFlags: evaluation.redFlags,
    dimensions: "dimensions" in evaluation ? evaluation.dimensions : [],
  };
}
