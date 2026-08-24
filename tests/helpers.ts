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
  ReportNarrative,
  ScoringResult,
  StageName,
} from "@/schemas/evaluation";

export const SIMPLE_TRANSCRIPT = Array.from({ length: 12 }, (_, index) => {
  const speaker = index % 2 === 0 ? "Coach" : "Client";
  return `[${speaker}]: Evidence for dimension ${index + 1}.`;
}).join("\n");

export function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8");
}

export function makeFacts(overrides: Partial<CallFacts> = {}): CallFacts {
  return {
    coachSpeaker: "Coach",
    clientSpeaker: "Client",
    coachSpeakingPercentage: 50,
    coachDominatedWithoutEngagement: false,
    nextCallBookedLive: true,
    unresolvedConfusion: false,
    strugglePresent: true,
    struggleHandled: true,
    movementCoachingPresent: true,
    movementSignals: {
      clientPerformedLiveMovement: true,
      coachGaveResponsiveCues: true,
      recordedMovementReviewedLive: false,
      realTimeFormCorrection: true,
    },
    diagnosticsApplicable: true,
    adjustmentNeeded: true,
    noFollowUpQuestions: false,
    noActionStepsForEitherParty: false,
    noNorthStarOrLongTermVision: false,
    concreteAccountabilityOwned: true,
    structuredRecapPresent: true,
    coachCommitments: ["Coach will send feedback by Friday."],
    clientCommitments: ["Client will upload a video by Thursday."],
    accountabilityDeadlines: ["Thursday", "Friday"],
    dimensions: Array.from({ length: 12 }, (_, index) => ({
      dimensionId: index + 1,
      positiveEvidence: [
        {
          lineNumbers: [index + 1],
          quote: `Evidence for dimension ${index + 1}.`,
          interpretation: "Direct fixture evidence.",
        },
      ],
      negativeEvidence: [],
      missingBehaviours: [],
      evidenceSufficient: true,
    })),
    ...overrides,
  };
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
