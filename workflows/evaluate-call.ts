import { FatalError, RetryableError, getStepMetadata } from "workflow";
import { SupabaseEvaluationRepository } from "@/lib/db/repository";
import { publicMessageForCode, toAppError, type ErrorCode } from "@/lib/errors/app-error";
import {
  runEvidenceStage,
  runScoringStage,
  runSynthesisStage,
  runValidationStage,
} from "@/lib/evaluation/stages";
import { getLLMProvider } from "@/lib/llm/provider";

export async function evaluateCallWorkflow(evaluationId: string): Promise<{ evaluationId: string }> {
  "use workflow";

  try {
    await extractEvidenceStep(evaluationId);
    await scoreRubricStep(evaluationId);
    await validateCalculationStep(evaluationId);
    await synthesizeReportStep(evaluationId);
  } catch (error) {
    await ensureFailureRecordedStep(evaluationId, String(error));
    throw error;
  }

  return { evaluationId };
}

async function extractEvidenceStep(evaluationId: string): Promise<void> {
  "use step";
  await executeStage(() =>
    runEvidenceStage(evaluationId, {
      repository: new SupabaseEvaluationRepository(),
      provider: getLLMProvider(),
    }),
  );
}

async function scoreRubricStep(evaluationId: string): Promise<void> {
  "use step";
  await executeStage(() =>
    runScoringStage(evaluationId, {
      repository: new SupabaseEvaluationRepository(),
      provider: getLLMProvider(),
    }),
  );
}

async function validateCalculationStep(evaluationId: string): Promise<void> {
  "use step";
  await executeStage(() => runValidationStage(evaluationId, new SupabaseEvaluationRepository()));
}

async function synthesizeReportStep(evaluationId: string): Promise<void> {
  "use step";
  await executeStage(() =>
    runSynthesisStage(evaluationId, {
      repository: new SupabaseEvaluationRepository(),
      provider: getLLMProvider(),
    }),
  );
}

async function ensureFailureRecordedStep(evaluationId: string, diagnostic: string): Promise<void> {
  "use step";
  const repository = new SupabaseEvaluationRepository();
  const evaluation = await repository.getEvaluation(evaluationId);
  if (!evaluation || evaluation.status === "failed" || evaluation.status === "completed") return;
  const orderedCodes: ErrorCode[] = [
    "EVIDENCE_VALIDATION_FAILED",
    "SCORING_VALIDATION_FAILED",
    "NARRATIVE_VALIDATION_FAILED",
    "PROVIDER_TIMEOUT",
    "DATABASE_FAILURE",
    "PROVIDER_FAILURE",
  ];
  const code = orderedCodes.find((candidate) => diagnostic.includes(candidate)) ?? "INTERNAL_ERROR";
  await repository.markFailed(evaluationId, {
    code,
    message: publicMessageForCode(code),
    diagnostic: { code, workflowError: diagnostic.slice(0, 240) },
  });
}

async function executeStage(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const appError = toAppError(error);
    if (!appError.retryable) {
      throw new FatalError(appError.code);
    }
    const { attempt } = getStepMetadata();
    throw new RetryableError(appError.code, {
      retryAfter: Math.min(30_000, Math.max(1_000, 2 ** attempt * 1_000)),
    });
  }
}

(extractEvidenceStep as typeof extractEvidenceStep & { maxRetries: number }).maxRetries = 2;
(scoreRubricStep as typeof scoreRubricStep & { maxRetries: number }).maxRetries = 2;
(validateCalculationStep as typeof validateCalculationStep & { maxRetries: number }).maxRetries = 2;
(synthesizeReportStep as typeof synthesizeReportStep & { maxRetries: number }).maxRetries = 2;
