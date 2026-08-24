import { AppError, safeDiagnostic, toAppError } from "@/lib/errors/app-error";
import { verifyEvidenceLedger } from "@/lib/evaluation/evidence";
import { validateAndCalculate } from "@/lib/evaluation/calculations";
import { scoreVerifiedCriteria } from "@/lib/evaluation/criterion-scoring";
import type {
  AuthoritativeEvaluation,
  EvaluationRepository,
  LLMProvider,
  ProviderMetadata,
  StageEnvelope,
  VerifiedEvidenceLedger,
} from "@/lib/evaluation/types";
import {
  EVIDENCE_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  buildEvidencePrompt,
  buildSynthesisPrompt,
} from "@/lib/llm/prompts";
import { getCriterionCatalog } from "@/lib/rubrics/criteria";
import {
  PROMPT_VERSION,
  STAGE_SCHEMA_VERSION,
  getRubricConfig,
} from "@/lib/rubrics/config";
import { parseTranscript } from "@/lib/transcript/parser";
import {
  CallFactsSchema,
  ReportNarrativeSchema,
  type ReportNarrative,
  type ScoringResult,
} from "@/schemas/evaluation";

export interface StageDependencies {
  repository: EvaluationRepository;
  provider: LLMProvider;
}

export async function runEvidenceStage(
  evaluationId: string,
  dependencies: StageDependencies,
): Promise<StageEnvelope<VerifiedEvidenceLedger>> {
  const existing = await dependencies.repository.getStageResult<VerifiedEvidenceLedger>(
    evaluationId,
    "evidence",
    STAGE_SCHEMA_VERSION,
  );
  if (existing) return existing;

  const evaluation = await requireEvaluation(evaluationId, dependencies.repository);
  await dependencies.repository.markStage(evaluationId, "extracting_evidence");
  const transcript = parseTranscript(evaluation.originalTranscript);
  let validationErrors: unknown;
  let durationMs = 0;
  const usage = emptyUsage();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await dependencies.repository.incrementAttempt(evaluationId);
    try {
      const response = await dependencies.provider.generateStructured({
        schema: CallFactsSchema,
        schemaName: "call_facts",
        system: EVIDENCE_SYSTEM_PROMPT,
        prompt: buildEvidencePrompt({
          callType: evaluation.callType,
          criteria: getCriterionCatalog(evaluation.callType),
          numberedTranscript: transcript.numberedTranscript,
          diagnosticsApplicable: evaluation.diagnosticsApplicable,
          validationErrors,
        }),
        idempotencyKey: `${evaluationId}:evidence:${attempt}`,
      });
      durationMs += response.durationMs;
      mergeUsage(usage, response.usage);
      const verified = verifyEvidenceLedger(evaluation.callType, response.data, transcript, {
        diagnosticsApplicable: evaluation.diagnosticsApplicable,
      });
      const envelope: StageEnvelope<VerifiedEvidenceLedger> = {
        data: verified,
        metadata: providerMetadata(dependencies.provider, attempt, durationMs, usage),
      };
      await dependencies.repository.saveStageResult({
        evaluationId,
        stage: "evidence",
        schemaVersion: STAGE_SCHEMA_VERSION,
        result: envelope,
        validated: true,
      });
      return envelope;
    } catch (error) {
      const appError = toAppError(error);
      validationErrors = appError.details ?? { code: appError.code };
      if (attempt === 2) {
        if (appError.code === "EVIDENCE_VALIDATION_FAILED") throw appError;
        throw new AppError(appError.code, {
          cause: appError,
          details: appError.details,
          retryable: appError.retryable,
        });
      }
    }
  }

  throw new AppError("EVIDENCE_VALIDATION_FAILED");
}

export async function runScoringStage(
  evaluationId: string,
  dependencies: Pick<StageDependencies, "repository">,
): Promise<StageEnvelope<ScoringResult>> {
  const existing = await dependencies.repository.getStageResult<ScoringResult>(
    evaluationId,
    "scoring",
    STAGE_SCHEMA_VERSION,
  );
  if (existing) return existing;

  const evaluation = await requireEvaluation(evaluationId, dependencies.repository);
  const evidence = await requireStage<VerifiedEvidenceLedger>(
    dependencies.repository,
    evaluationId,
    "evidence",
  );
  await dependencies.repository.markStage(evaluationId, "scoring");
  const deterministicScoring = scoreVerifiedCriteria(evaluation.callType, evidence.data);
  const envelope: StageEnvelope<ScoringResult> = {
    data: deterministicScoring,
  };
  await dependencies.repository.saveStageResult({
    evaluationId,
    stage: "scoring",
    schemaVersion: STAGE_SCHEMA_VERSION,
    result: envelope,
    validated: true,
  });
  return envelope;
}

export async function runValidationStage(
  evaluationId: string,
  repository: EvaluationRepository,
): Promise<StageEnvelope<AuthoritativeEvaluation>> {
  const existing = await repository.getStageResult<AuthoritativeEvaluation>(
    evaluationId,
    "validation",
    STAGE_SCHEMA_VERSION,
  );
  if (existing) {
    await repository.saveAuthoritativeEvaluation(evaluationId, existing.data);
    return existing;
  }

  const evaluation = await requireEvaluation(evaluationId, repository);
  const evidence = await requireStage<VerifiedEvidenceLedger>(repository, evaluationId, "evidence");
  const scoring = await requireStage<ScoringResult>(repository, evaluationId, "scoring");
  await repository.markStage(evaluationId, "validating");
  const result = validateAndCalculate({
    callType: evaluation.callType,
    scoring: scoring.data,
    evidence: evidence.data,
    transcript: parseTranscript(evaluation.originalTranscript),
  });
  const envelope: StageEnvelope<AuthoritativeEvaluation> = { data: result };
  await repository.saveAuthoritativeEvaluation(evaluationId, result);
  await repository.saveStageResult({
    evaluationId,
    stage: "validation",
    schemaVersion: STAGE_SCHEMA_VERSION,
    result: envelope,
    validated: true,
  });
  return envelope;
}

export async function runSynthesisStage(
  evaluationId: string,
  dependencies: StageDependencies,
): Promise<StageEnvelope<ReportNarrative>> {
  const existing = await dependencies.repository.getStageResult<ReportNarrative>(
    evaluationId,
    "synthesis",
    STAGE_SCHEMA_VERSION,
  );
  if (existing) {
    await dependencies.repository.markCompleted(evaluationId, existing.data);
    return existing;
  }

  const evaluation = await requireEvaluation(evaluationId, dependencies.repository);
  const evidence = await requireStage<VerifiedEvidenceLedger>(
    dependencies.repository,
    evaluationId,
    "evidence",
  );
  const result = await requireStage<AuthoritativeEvaluation>(
    dependencies.repository,
    evaluationId,
    "validation",
  );
  await dependencies.repository.markStage(evaluationId, "synthesizing");
  await dependencies.repository.incrementAttempt(evaluationId);
  const response = await dependencies.provider.generateStructured({
    schema: ReportNarrativeSchema,
    schemaName: "report_narrative",
    system: SYNTHESIS_SYSTEM_PROMPT,
    prompt: buildSynthesisPrompt({
      callType: evaluation.callType,
      result: result.data,
      evidence: evidence.data,
    }),
    idempotencyKey: `${evaluationId}:synthesis`,
  });
  const narrative = normalizeNarrative(response.data, result.data);
  validateNarrativeEvidence(narrative, evidence.data);
  validateNarrativeSafety(narrative);
  const envelope: StageEnvelope<ReportNarrative> = {
    data: narrative,
    metadata: providerMetadata(dependencies.provider, 1, response.durationMs, response.usage),
  };
  await dependencies.repository.saveStageResult({
    evaluationId,
    stage: "synthesis",
    schemaVersion: STAGE_SCHEMA_VERSION,
    result: envelope,
    validated: true,
  });
  await dependencies.repository.markCompleted(evaluationId, narrative);
  return envelope;
}

export async function runCompleteEvaluation(
  evaluationId: string,
  dependencies: StageDependencies,
): Promise<void> {
  try {
    await runEvidenceStage(evaluationId, dependencies);
    await runScoringStage(evaluationId, { repository: dependencies.repository });
    await runValidationStage(evaluationId, dependencies.repository);
    await runSynthesisStage(evaluationId, dependencies);
  } catch (error) {
    const appError = toAppError(error);
    await dependencies.repository.markFailed(evaluationId, {
      code: appError.code,
      message: appError.publicMessage,
      diagnostic: safeDiagnostic(appError),
    });
    throw appError;
  }
}

async function requireEvaluation(id: string, repository: EvaluationRepository) {
  const evaluation = await repository.getEvaluation(id);
  if (!evaluation) throw new AppError("EVALUATION_NOT_FOUND");
  return evaluation;
}

async function requireStage<T>(
  repository: EvaluationRepository,
  evaluationId: string,
  stage: "evidence" | "scoring" | "validation",
): Promise<StageEnvelope<T>> {
  const result = await repository.getStageResult<T>(evaluationId, stage, STAGE_SCHEMA_VERSION);
  if (!result) {
    throw new AppError("DATABASE_FAILURE", {
      details: { message: `Validated ${stage} stage result is missing.` },
      retryable: true,
    });
  }
  return result;
}

function validateNarrativeEvidence(
  narrative: ReportNarrative,
  evidence: VerifiedEvidenceLedger,
): void {
  const verifiedLines = new Set(
    evidence.dimensions.flatMap((dimension) =>
      [...dimension.positiveEvidence, ...dimension.negativeEvidence].flatMap(
        (reference) => reference.lineNumbers,
      ),
    ),
  );
  const invalid = narrative.redFlags.flatMap((flag) =>
    flag.evidenceLineNumbers.filter((lineNumber) => !verifiedLines.has(lineNumber)),
  );
  if (invalid.length > 0) {
    throw new AppError("NARRATIVE_VALIDATION_FAILED", {
      details: { invalidLineNumbers: [...new Set(invalid)] },
    });
  }
}

function validateNarrativeSafety(narrative: ReportNarrative): void {
  const clientFacingText = [
    narrative.oneThing.headline,
    narrative.oneThing.explanation,
    narrative.brief,
    ...narrative.redFlags.flatMap((flag) => [flag.title, flag.explanation]),
  ].join("\n");
  const forbidden = [
    /expectedquote/iu,
    /prior extraction/iu,
    /validation error/iu,
    /schema/iu,
    /retry/iu,
    /system prompt/iu,
    /internal error/iu,
  ];
  const matched = forbidden.find((pattern) => pattern.test(clientFacingText));
  if (matched) {
    throw new AppError("NARRATIVE_VALIDATION_FAILED", {
      details: { message: "Client-facing narrative contains internal pipeline language." },
    });
  }
}

function normalizeNarrative(
  narrative: ReportNarrative,
  result: AuthoritativeEvaluation,
): ReportNarrative {
  if (result.oneThing.improvement > 0) return narrative;

  const oneThing = result.oneThing;
  return {
    ...narrative,
    oneThing: {
      headline: `Maintain ${oneThing.dimensionName}`,
      explanation: `${oneThing.dimensionName} is already at its full ${formatScore(oneThing.currentScore)}/${formatScore(oneThing.fullScore)}. Raising this dimension cannot increase the current final score of ${formatScore(oneThing.currentFinalTotal)}/100. Maintain the verified behaviours consistently in future calls.`,
    },
  };
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function providerMetadata(
  provider: LLMProvider,
  attempts: number,
  durationMs: number,
  usage: ProviderMetadata["usage"],
): ProviderMetadata {
  return {
    provider: provider.name,
    model: provider.model,
    promptVersion: PROMPT_VERSION,
    attempts,
    durationMs,
    usage,
  };
}

function emptyUsage(): ProviderMetadata["usage"] {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function mergeUsage(
  total: ProviderMetadata["usage"],
  next: ProviderMetadata["usage"],
): void {
  total.inputTokens = sumNullable(total.inputTokens, next.inputTokens);
  total.outputTokens = sumNullable(total.outputTokens, next.outputTokens);
  total.totalTokens = sumNullable(total.totalTokens, next.totalTokens);
}

function sumNullable(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}

export { getRubricConfig, PROMPT_VERSION, STAGE_SCHEMA_VERSION };
