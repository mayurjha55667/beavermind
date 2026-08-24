import { FatalError, RetryableError, getStepMetadata } from "workflow";
import { SupabaseEvaluationRepository } from "@/lib/db/repository";
import {
  publicMessageForCode,
  toAppError,
  type AppError,
  type ErrorCode,
} from "@/lib/errors/app-error";
import {
  runEvidenceStage,
  runScoringStage,
  runSynthesisStage,
  runValidationStage,
} from "@/lib/evaluation/stages";
import { getLLMProvider } from "@/lib/llm/provider";
import type { StageName } from "@/schemas/evaluation";

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
  await executeStage(evaluationId, "evidence", () =>
    runEvidenceStage(evaluationId, {
      repository: new SupabaseEvaluationRepository(),
      provider: getLLMProvider(),
    }),
  );
}

async function scoreRubricStep(evaluationId: string): Promise<void> {
  "use step";
  await executeStage(evaluationId, "scoring", () =>
    runScoringStage(evaluationId, {
      repository: new SupabaseEvaluationRepository(),
      provider: getLLMProvider(),
    }),
  );
}

async function validateCalculationStep(evaluationId: string): Promise<void> {
  "use step";
  await executeStage(evaluationId, "validation", () =>
    runValidationStage(evaluationId, new SupabaseEvaluationRepository()),
  );
}

async function synthesizeReportStep(evaluationId: string): Promise<void> {
  "use step";
  await executeStage(evaluationId, "synthesis", () =>
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

async function executeStage(
  evaluationId: string,
  stage: StageName,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const appError = toAppError(error);
    const diagnostic = safeWorkflowDiagnostic(appError);
    const workflowMessage = `${appError.code}:${JSON.stringify(diagnostic)}`;
    console.error(
      JSON.stringify({
        evaluationId,
        stage,
        code: appError.code,
        diagnostic,
      }),
    );
    if (!appError.retryable) {
      throw new FatalError(workflowMessage);
    }
    const { attempt } = getStepMetadata();
    throw new RetryableError(workflowMessage, {
      retryAfter: Math.min(30_000, Math.max(1_000, 2 ** attempt * 1_000)),
    });
  }
}

function safeWorkflowDiagnostic(error: AppError): Record<string, unknown> {
  const details = error.details;
  if (Array.isArray(details)) {
    return {
      errorCount: details.length,
      errors: details.slice(0, 24).flatMap((detail) => {
        if (!detail || typeof detail !== "object") return [];
        const issue = detail as Record<string, unknown>;
        return [
          {
            dimensionId:
              typeof issue.dimensionId === "number" ? issue.dimensionId : undefined,
            evidenceType:
              issue.evidenceType === "positive" || issue.evidenceType === "negative"
                ? issue.evidenceType
                : undefined,
            evidenceIndex:
              typeof issue.evidenceIndex === "number" ? issue.evidenceIndex : undefined,
            message: typeof issue.message === "string" ? issue.message : "Validation failed.",
            lineNumbers: Array.isArray(issue.lineNumbers)
              ? issue.lineNumbers.filter((line): line is number => typeof line === "number")
              : undefined,
            hasExpectedQuote: typeof issue.expectedQuote === "string",
          },
        ];
      }),
    };
  }

  if (details && typeof details === "object") {
    const source = details as Record<string, unknown>;
    const safeDetails: Record<string, unknown> = {};
    for (const key of [
      "message",
      "provider",
      "status",
      "code",
      "type",
      "hint",
      "capId",
      "dimensionId",
      "score",
    ]) {
      const value = source[key];
      if (typeof value === "string" || typeof value === "number" || value === null) {
        safeDetails[key] = value;
      }
    }
    for (const key of ["allowedScores", "invalid"]) {
      const value = source[key];
      if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
        safeDetails[key] = value;
      }
    }
    return safeDetails;
  }

  return {};
}

(extractEvidenceStep as typeof extractEvidenceStep & { maxRetries: number }).maxRetries = 2;
(scoreRubricStep as typeof scoreRubricStep & { maxRetries: number }).maxRetries = 2;
(validateCalculationStep as typeof validateCalculationStep & { maxRetries: number }).maxRetries = 2;
(synthesizeReportStep as typeof synthesizeReportStep & { maxRetries: number }).maxRetries = 2;
