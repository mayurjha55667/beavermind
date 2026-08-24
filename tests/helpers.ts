import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AppError } from "@/lib/errors/app-error";
import type {
  AuthoritativeEvaluation,
  CompletedEvaluation,
  EvaluationRecord,
  EvaluationRepository,
  LLMProvider,
  StageEnvelope,
  StageResultRecord,
} from "@/lib/evaluation/types";
import { bandForScore, getRubricConfig } from "@/lib/rubrics/config";
import { parseTranscript } from "@/lib/transcript/parser";
import type {
  CallFacts,
  CallType,
  CriterionState,
  RequirementSupportStatus,
  ReportNarrative,
  ScoringResult,
  StageName,
} from "@/schemas/evaluation";
import { getCriterionCatalog } from "@/lib/rubrics/criteria";

export const SIMPLE_TRANSCRIPT = Array.from({ length: 12 }, (_, index) => {
  const speaker = index % 2 === 0 ? "Coach" : "Client";
  return `[${speaker}]: Evidence for dimension ${index + 1}.`;
}).join("\n");

export function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8");
}

interface FactsOverrides {
  callType?: CallType;
  coachSpeaker?: string;
  clientSpeaker?: string;
  states?: Record<string, CriterionState>;
  noFollowUpQuestions?: boolean;
  movementCoachingPresent?: boolean;
  diagnosticsApplicable?: boolean;
  adjustmentNeeded?: boolean;
  strugglePresent?: boolean;
  nextCallBookedLive?: boolean;
  noNorthStarOrLongTermVision?: boolean;
  structuredRecapPresent?: boolean;
  concreteAccountabilityOwned?: boolean;
  noActionStepsForEitherParty?: boolean;
}

const NEGATIVE_CRITERION_PARTS = [
  "global.unresolved_confusion",
  "redundant_discovery_reset",
  "friendly_but_transactional",
  "fragmented_mention_only",
  "generic_phase_reference",
  "generic_questions_only",
  "partial_instructions",
  "booking_reference_only",
  "vague_follow_up_only",
  "mostly_precise_timing",
  "generic_check_in",
  "generic_intention",
  "generic_feedback",
  "generic_long_term_connection",
  "block_logistics_only",
  "telling_only",
  "unexplained_adjustment",
  "clear_but_incomplete_commitments",
  "vague_actions",
  "accountability_gesture",
  "struggle_ignored",
  "positive_generic_close",
  "vague_follow_up",
  "uneven_pacing",
  "core_sections_missing",
] as const;

export function makeFacts(overrides: FactsOverrides = {}): CallFacts {
  const callType = overrides.callType ?? "kickoff";
  const states: Record<string, CriterionState> = {};
  for (const definition of getCriterionCatalog(callType)) {
    states[definition.id] = NEGATIVE_CRITERION_PARTS.some((part) => definition.id.includes(part))
      ? "ABSENT"
      : "PRESENT";
  }
  Object.assign(states, overrides.states);

  if (overrides.noFollowUpQuestions) states["kickoff.global.follow_up_question_present"] = "ABSENT";
  if (overrides.movementCoachingPresent === false) {
    for (const id of ["client_live_movement", "responsive_setup_breathing_control_cues", "recorded_movement_reviewed_live", "real_time_form_correction"]) {
      states[`coaching.d04.${id}`] = "ABSENT";
    }
  }
  if (overrides.diagnosticsApplicable === false) states["coaching.d02.diagnostics_applicable"] = "NOT_APPLICABLE";
  if (overrides.adjustmentNeeded === false) states["coaching.d05.adjustment_needed"] = "ABSENT";
  if (overrides.strugglePresent === false) states["coaching.d08.struggle_present"] = "ABSENT";
  if (overrides.nextCallBookedLive === false) {
    for (const id of callType === "kickoff"
      ? ["kickoff.d10.specific_date", "kickoff.d10.specific_time", "kickoff.d10.client_confirms"]
      : ["coaching.d10.client_books_live", "coaching.d10.specific_date_confirmed", "coaching.d10.specific_time_confirmed"]) {
      states[id] = "ABSENT";
    }
  }
  if (overrides.noNorthStarOrLongTermVision) {
    states[callType === "kickoff" ? "kickoff.d04.north_star_constructed" : "coaching.d03.explicit_twelve_month_vision"] = "ABSENT";
  }
  if (overrides.structuredRecapPresent === false) states["kickoff.d11.structured_recap"] = "ABSENT";
  if (overrides.concreteAccountabilityOwned === false) {
    for (const id of ["specific_deliverable", "client_confirms", "gated_to_coach_action", "time_bound"]) states[`coaching.d07.${id}`] = "ABSENT";
  }
  if (overrides.noActionStepsForEitherParty) {
    states["coaching.d06.coach_specific_commitment"] = "ABSENT";
    states["coaching.d06.client_specific_commitment"] = "ABSENT";
  }

  return {
    coachSpeaker: overrides.coachSpeaker ?? "Coach",
    clientSpeaker: overrides.clientSpeaker ?? "Client",
    criteria: getCriterionCatalog(callType).map((definition) => {
      const state = states[definition.id] ?? "ABSENT";
      const lineNumber = definition.id === "kickoff.d12.first_specific_commitment"
        ? 10
        : definition.id === "kickoff.d12.second_distinct_commitment"
          ? 11
          : Math.max(1, definition.dimensionId);
      return {
        criterionId: definition.id,
        requirementResults: definition.requirements.map((requirement) => ({
          requirementId: requirement.id,
          status: requirementStatusForState(state),
          evidenceLineNumbers: state === "PRESENT" ? [lineNumber] : [],
        })),
        materialAssumptions: [],
      };
    }),
  };
}

export function setCriterionState(
  facts: CallFacts,
  criterionId: string,
  state: CriterionState,
  ...lineNumbers: number[]
): void {
  const result = facts.criteria.find((criterion) => criterion.criterionId === criterionId);
  if (!result) throw new Error(`Unknown test criterion ${criterionId}.`);
  result.requirementResults = result.requirementResults.map((requirement) => ({
    ...requirement,
    status: requirementStatusForState(state),
    evidenceLineNumbers: state === "PRESENT" ? lineNumbers : [],
  }));
  result.materialAssumptions = [];
}

function requirementStatusForState(state: CriterionState): RequirementSupportStatus {
  switch (state) {
    case "PRESENT":
      return "SUPPORTED";
    case "ABSENT":
      return "NOT_SUPPORTED";
    case "UNCLEAR":
      return "UNVERIFIABLE";
    case "NOT_APPLICABLE":
      return "NOT_APPLICABLE";
  }
}

export function makeScoring(
  callType: CallType,
  scoreOverrides: Record<number, number | null> = {},
): ScoringResult {
  const rubric = getRubricConfig(callType);
  return {
    dimensions: rubric.dimensions.map((definition) => {
      const override = scoreOverrides[definition.id];
      const score = override === undefined ? definition.maxScore : override;
      return {
        dimensionId: definition.id,
        name: definition.name,
        score,
        rubricMaxScore: definition.maxScore,
        band: score === null ? ("N/A" as const) : bandForScore(definition, score),
        disabled: score === null,
        disabledReason: score === null ? "Not applicable." : null,
        reasoning: `Evidence supports dimension ${definition.id}.`,
        evidenceLineNumbers: score === null ? [] : [definition.id],
        missingBehaviours: [],
        quickFix: `Reach the full criteria for dimension ${definition.id}.`,
      };
    }),
    proposedCaps: [],
  };
}

export function makeNarrative(): ReportNarrative {
  return {
    oneThing: { headline: "Sharpen the highest-leverage behaviour", explanation: "Use the verified counterfactual as the next-call focus." },
    brief: "You delivered a structured call. Keep the strongest behaviours and close the documented gaps.",
    redFlags: [],
  };
}

export class QueueProvider implements LLMProvider {
  readonly name = "mock";
  readonly model = "mock-model";
  readonly calls: string[] = [];
  private readonly queues: Record<string, unknown[]>;

  constructor(queues: Record<string, unknown[]>) {
    this.queues = queues;
  }

  async generateStructured<T>(input: Parameters<LLMProvider["generateStructured"]>[0]) {
    this.calls.push(input.schemaName);
    const queue = this.queues[input.schemaName] ?? [];
    const next = queue.shift();
    if (next instanceof Error) throw next;
    const data = input.schema.parse(next) as T;
    return {
      data,
      durationMs: 5,
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    };
  }
}

export class InMemoryRepository implements EvaluationRepository {
  evaluation: EvaluationRecord;
  readonly stages = new Map<string, StageEnvelope<unknown>>();
  dimensions: AuthoritativeEvaluation["dimensions"] = [];
  diagnostics: unknown[] = [];

  constructor(callType: CallType = "kickoff", transcript = SIMPLE_TRANSCRIPT) {
    this.evaluation = {
      id: randomUUID(),
      callType,
      originalTranscript: transcript,
      numberedTranscript: parseTranscript(transcript).numberedTranscript,
      status: "queued",
      currentStage: "queued",
      rubricVersion: getRubricConfig(callType).version,
      promptVersion: "test",
      modelProvider: "mock",
      modelName: "mock-model",
      workflowRunId: null,
      rawScore: null,
      maxPossibleScore: null,
      normalizedScore: null,
      finalScore: null,
      grade: null,
      appliedCaps: [],
      oneThing: null,
      brief: null,
      redFlags: [],
      errorCode: null,
      errorMessage: null,
      attemptCount: 0,
      createdAt: new Date("2026-08-24T00:00:00Z").toISOString(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
    };
  }

  async createEvaluation(): Promise<EvaluationRecord> { return this.evaluation; }
  async getEvaluation(id: string): Promise<EvaluationRecord | null> {
    return id === this.evaluation.id ? this.evaluation : null;
  }
  async getCompletedEvaluation(id: string): Promise<CompletedEvaluation | null> {
    if (id !== this.evaluation.id || this.evaluation.status !== "completed") return null;
    return { ...this.evaluation, status: "completed", dimensions: this.dimensions } as CompletedEvaluation;
  }
  async setWorkflowRunId(_id: string, workflowRunId: string): Promise<void> { this.evaluation.workflowRunId = workflowRunId; }
  async markStage(_id: string, status: Exclude<EvaluationRecord["status"], "queued" | "completed" | "failed">): Promise<void> {
    this.evaluation.status = status;
    this.evaluation.currentStage = status;
    this.evaluation.startedAt ??= new Date().toISOString();
  }
  async markFailed(_id: string, input: { code: string; message: string; diagnostic: unknown }): Promise<void> {
    this.evaluation.status = "failed";
    this.evaluation.currentStage = "failed";
    this.evaluation.errorCode = input.code;
    this.evaluation.errorMessage = input.message;
    this.evaluation.failedAt = new Date().toISOString();
    this.diagnostics.push(input.diagnostic);
  }
  async markCompleted(_id: string, narrative: ReportNarrative): Promise<void> {
    this.evaluation.status = "completed";
    this.evaluation.currentStage = "completed";
    this.evaluation.completedAt = new Date().toISOString();
    this.evaluation.brief = narrative.brief;
    this.evaluation.redFlags = narrative.redFlags;
    this.evaluation.oneThing = { ...this.evaluation.oneThing!, ...narrative.oneThing };
  }
  async getStageResult<T>(_id: string, stage: StageName, schemaVersion: string): Promise<StageEnvelope<T> | null> {
    return (this.stages.get(`${stage}:${schemaVersion}`) as StageEnvelope<T> | undefined) ?? null;
  }
  async saveStageResult<T>(input: StageResultRecord<T>): Promise<void> {
    this.stages.set(`${input.stage}:${input.schemaVersion}`, input.result);
  }
  async saveAuthoritativeEvaluation(_id: string, result: AuthoritativeEvaluation): Promise<void> {
    this.dimensions = result.dimensions;
    Object.assign(this.evaluation, {
      rawScore: result.rawScore,
      maxPossibleScore: result.maxPossibleScore,
      normalizedScore: result.normalizedScore,
      finalScore: result.finalScore,
      grade: result.grade,
      appliedCaps: result.appliedCaps,
      oneThing: result.oneThing,
    });
  }
  async incrementAttempt(): Promise<void> { this.evaluation.attemptCount += 1; }
}

export const providerFailure = () => new AppError("PROVIDER_FAILURE", { retryable: true });
