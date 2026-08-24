import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type {
  AppliedCap,
  AuthoritativeDimensionResult,
  AuthoritativeEvaluation,
  CompletedEvaluation,
  EvaluationRecord,
  EvaluationRepository,
  OneThingCalculation,
  StageEnvelope,
  StageResultRecord,
} from "@/lib/evaluation/types";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type {
  CallType,
  DimensionBand,
  EvaluationStatus,
  Grade,
  ReportNarrative,
  StageName,
} from "@/schemas/evaluation";

interface EvaluationRow {
  id: string;
  call_type: CallType;
  original_transcript: string;
  numbered_transcript: string;
  status: EvaluationStatus;
  current_stage: EvaluationStatus;
  rubric_version: string;
  prompt_version: string;
  model_provider: string;
  model_name: string;
  workflow_run_id: string | null;
  raw_score: number | string | null;
  max_possible_score: number | string | null;
  normalized_score: number | string | null;
  final_score: number | string | null;
  grade: Grade | null;
  applied_caps: AppliedCap[];
  one_thing: OneThingCalculation | null;
  brief: string | null;
  red_flags: ReportNarrative["redFlags"];
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
}

interface DimensionRow {
  dimension_id: number;
  name: string;
  score: number | string | null;
  rubric_max_score: number | string;
  effective_max_score: number | string;
  weighted_score: number | string;
  band: DimensionBand;
  disabled: boolean;
  disabled_reason: string | null;
  reasoning: string;
  quick_fix: string;
  missing_behaviours: string[];
  evidence: AuthoritativeDimensionResult["evidence"];
  improvement_potential: number | string;
}

const numeric = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

function mapEvaluation(row: EvaluationRow): EvaluationRecord {
  return {
    id: row.id,
    callType: row.call_type,
    originalTranscript: row.original_transcript,
    numberedTranscript: row.numbered_transcript,
    status: row.status,
    currentStage: row.current_stage,
    rubricVersion: row.rubric_version,
    promptVersion: row.prompt_version,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    workflowRunId: row.workflow_run_id,
    rawScore: numeric(row.raw_score),
    maxPossibleScore: numeric(row.max_possible_score),
    normalizedScore: numeric(row.normalized_score),
    finalScore: numeric(row.final_score),
    grade: row.grade,
    appliedCaps: row.applied_caps ?? [],
    oneThing: row.one_thing,
    brief: row.brief,
    redFlags: row.red_flags ?? [],
    errorCode: row.error_code,
    errorMessage: row.error_message,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
  };
}

function mapDimension(row: DimensionRow): AuthoritativeDimensionResult {
  return {
    dimensionId: row.dimension_id,
    name: row.name,
    score: numeric(row.score),
    rubricMaxScore: Number(row.rubric_max_score),
    effectiveMaxScore: Number(row.effective_max_score),
    weightedScore: Number(row.weighted_score),
    band: row.band,
    disabled: row.disabled,
    disabledReason: row.disabled_reason,
    reasoning: row.reasoning,
    quickFix: row.quick_fix,
    missingBehaviours: row.missing_behaviours ?? [],
    evidence: row.evidence ?? [],
    improvementPotential: Number(row.improvement_potential),
  };
}

export class SupabaseEvaluationRepository implements EvaluationRepository {
  async createEvaluation(input: {
    id: string;
    callType: CallType;
    originalTranscript: string;
    numberedTranscript: string;
    rubricVersion: string;
    promptVersion: string;
    modelProvider: string;
    modelName: string;
  }): Promise<EvaluationRecord> {
    const { data, error } = await getSupabaseAdmin()
      .from("evaluations")
      .insert({
        id: input.id,
        call_type: input.callType,
        original_transcript: input.originalTranscript,
        numbered_transcript: input.numberedTranscript,
        rubric_version: input.rubricVersion,
        prompt_version: input.promptVersion,
        model_provider: input.modelProvider,
        model_name: input.modelName,
      })
      .select("*")
      .single();
    if (error || !data) throw databaseError(error);
    return mapEvaluation(data as EvaluationRow);
  }

  async getEvaluation(id: string): Promise<EvaluationRecord | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("evaluations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw databaseError(error);
    return data ? mapEvaluation(data as EvaluationRow) : null;
  }

  async getCompletedEvaluation(id: string): Promise<CompletedEvaluation | null> {
    const evaluation = await this.getEvaluation(id);
    if (!evaluation || evaluation.status !== "completed") return null;

    const { data, error } = await getSupabaseAdmin()
      .from("dimension_results")
      .select("*")
      .eq("evaluation_id", id)
      .order("dimension_id", { ascending: true });
    if (error) throw databaseError(error);
    if (
      !evaluation.grade ||
      evaluation.finalScore === null ||
      evaluation.rawScore === null ||
      evaluation.maxPossibleScore === null ||
      evaluation.normalizedScore === null ||
      !evaluation.oneThing ||
      !evaluation.brief ||
      !data ||
      data.length !== 12
    ) {
      throw new AppError("DATABASE_FAILURE", {
        details: { message: "Completed evaluation is missing authoritative report fields." },
      });
    }

    return {
      ...evaluation,
      status: "completed",
      dimensions: (data as DimensionRow[]).map(mapDimension),
      grade: evaluation.grade,
      finalScore: evaluation.finalScore,
      rawScore: evaluation.rawScore,
      maxPossibleScore: evaluation.maxPossibleScore,
      normalizedScore: evaluation.normalizedScore,
      oneThing: evaluation.oneThing as CompletedEvaluation["oneThing"],
      brief: evaluation.brief,
    };
  }

  async setWorkflowRunId(id: string, workflowRunId: string): Promise<void> {
    await this.updateEvaluation(id, { workflow_run_id: workflowRunId });
  }

  async markStage(
    id: string,
    status: Exclude<EvaluationStatus, "queued" | "completed" | "failed">,
  ): Promise<void> {
    const values: Record<string, unknown> = { status, current_stage: status };
    if (status === "extracting_evidence") {
      const current = await this.getEvaluation(id);
      if (!current?.startedAt) values.started_at = new Date().toISOString();
    }
    await this.updateEvaluation(id, values);
  }

  async markFailed(
    id: string,
    input: { code: string; message: string; diagnostic: unknown },
  ): Promise<void> {
    await this.updateEvaluation(id, {
      status: "failed",
      current_stage: "failed",
      failed_at: new Date().toISOString(),
      error_code: input.code,
      error_message: input.message,
      internal_error: input.diagnostic,
    });
  }

  async markCompleted(id: string, narrative: ReportNarrative): Promise<void> {
    const current = await this.getEvaluation(id);
    if (!current?.oneThing) throw new AppError("DATABASE_FAILURE");
    await this.updateEvaluation(id, {
      status: "completed",
      current_stage: "completed",
      completed_at: new Date().toISOString(),
      one_thing: { ...current.oneThing, ...narrative.oneThing },
      brief: narrative.brief,
      red_flags: narrative.redFlags,
      error_code: null,
      error_message: null,
      internal_error: null,
    });
  }

  async getStageResult<T>(
    id: string,
    stage: StageName,
    schemaVersion: string,
  ): Promise<StageEnvelope<T> | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("evaluation_stage_results")
      .select("result, validated")
      .eq("evaluation_id", id)
      .eq("stage", stage)
      .eq("schema_version", schemaVersion)
      .maybeSingle();
    if (error) throw databaseError(error);
    if (!data || !data.validated) return null;
    return data.result as StageEnvelope<T>;
  }

  async saveStageResult<T>(input: StageResultRecord<T>): Promise<void> {
    const { error } = await getSupabaseAdmin().from("evaluation_stage_results").upsert(
      {
        evaluation_id: input.evaluationId,
        stage: input.stage,
        schema_version: input.schemaVersion,
        result: input.result,
        validated: input.validated,
      },
      { onConflict: "evaluation_id,stage,schema_version" },
    );
    if (error) throw databaseError(error);
  }

  async saveAuthoritativeEvaluation(id: string, result: AuthoritativeEvaluation): Promise<void> {
    const dimensionRows = result.dimensions.map((dimension) => ({
      evaluation_id: id,
      dimension_id: dimension.dimensionId,
      name: dimension.name,
      score: dimension.score,
      rubric_max_score: dimension.rubricMaxScore,
      effective_max_score: dimension.effectiveMaxScore,
      weighted_score: dimension.weightedScore,
      band: dimension.band,
      disabled: dimension.disabled,
      disabled_reason: dimension.disabledReason,
      reasoning: dimension.reasoning,
      quick_fix: dimension.quickFix,
      missing_behaviours: dimension.missingBehaviours,
      evidence: dimension.evidence,
      improvement_potential: dimension.improvementPotential,
    }));
    const { error: dimensionsError } = await getSupabaseAdmin()
      .from("dimension_results")
      .upsert(dimensionRows, { onConflict: "evaluation_id,dimension_id" });
    if (dimensionsError) throw databaseError(dimensionsError);

    await this.updateEvaluation(id, {
      raw_score: result.rawScore,
      max_possible_score: result.maxPossibleScore,
      normalized_score: result.normalizedScore,
      final_score: result.finalScore,
      grade: result.grade,
      applied_caps: result.appliedCaps,
      one_thing: result.oneThing,
    });
  }

  async incrementAttempt(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin().rpc("increment_evaluation_attempt", {
      evaluation_uuid: id,
    });
    if (error) throw databaseError(error);
  }

  private async updateEvaluation(id: string, values: Record<string, unknown>): Promise<void> {
    const { error } = await getSupabaseAdmin().from("evaluations").update(values).eq("id", id);
    if (error) throw databaseError(error);
  }
}

function databaseError(error: unknown): AppError {
  const details =
    error && typeof error === "object"
      ? {
          code: "code" in error ? String(error.code) : null,
          hint: "hint" in error ? String(error.hint) : null,
        }
      : null;
  return new AppError("DATABASE_FAILURE", { cause: error, details, retryable: true });
}
