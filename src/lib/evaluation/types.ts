import type {
  CallType,
  CriterionState,
  DimensionBand,
  EvaluationStatus,
  Grade,
  ReportNarrative,
  ScoringResult,
  StageName,
} from "@/schemas/evaluation";
import type { ZodType } from "zod";

export interface TranscriptTurn {
  lineNumber: number;
  speaker: string;
  text: string;
  canonicalLine: string;
}

export interface ParsedTranscript {
  originalTranscript: string;
  normalizedTranscript: string;
  numberedTranscript: string;
  turns: TranscriptTurn[];
}

export interface VerifiedEvidenceReference {
  lineNumbers: number[];
  interpretation: string;
  transcriptLines: TranscriptTurn[];
}

export interface VerifiedDimensionEvidence {
  dimensionId: number;
  positiveEvidence: VerifiedEvidenceReference[];
  negativeEvidence: VerifiedEvidenceReference[];
  missingBehaviours: string[];
  evidenceSufficient: boolean;
}

export interface VerifiedCriterionEvidence {
  criterionId: string;
  dimensionId: number;
  state: CriterionState;
  evidenceLineNumbers: number[];
  transcriptLines: TranscriptTurn[];
}

export interface VerifiedEvidenceLedger {
  coachSpeaker: string;
  clientSpeaker: string;
  coachSpeakingPercentage: number;
  coachDominatedWithoutEngagement: boolean;
  nextCallBookedLive: boolean;
  unresolvedConfusion: boolean;
  strugglePresent: boolean;
  struggleHandled: boolean | null;
  movementCoachingPresent: boolean;
  movementSignals: {
    clientPerformedLiveMovement: boolean;
    coachGaveResponsiveCues: boolean;
    recordedMovementReviewedLive: boolean;
    realTimeFormCorrection: boolean;
  };
  diagnosticsApplicable: boolean;
  adjustmentNeeded: boolean;
  noFollowUpQuestions: boolean;
  noActionStepsForEitherParty: boolean;
  noNorthStarOrLongTermVision: boolean;
  concreteAccountabilityOwned: boolean;
  structuredRecapPresent: boolean;
  coachCommitments: string[];
  clientCommitments: string[];
  accountabilityDeadlines: string[];
  criteria: VerifiedCriterionEvidence[];
  dimensions: VerifiedDimensionEvidence[];
}

export interface ProviderMetadata {
  provider: string;
  model: string;
  promptVersion: string;
  attempts: number;
  durationMs: number;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
}

export interface StageEnvelope<T> {
  data: T;
  metadata?: ProviderMetadata;
}

export interface AppliedCap {
  id: string;
  label: string;
  type: "overall" | "dimension";
  limit: number;
  dimensionId: number | null;
  supportingLineNumbers: number[];
  resolvedByDimensionIds: number[];
}

export interface EvidenceLine {
  lineNumber: number;
  speaker: string;
  text: string;
}

export interface AuthoritativeDimensionResult {
  dimensionId: number;
  name: string;
  score: number | null;
  rubricMaxScore: number;
  effectiveMaxScore: number;
  weightedScore: number;
  band: DimensionBand;
  disabled: boolean;
  disabledReason: string | null;
  reasoning: string;
  quickFix: string;
  missingBehaviours: string[];
  evidence: EvidenceLine[];
  improvementPotential: number;
}

export interface OneThingCalculation {
  dimensionId: number;
  dimensionName: string;
  currentScore: number;
  fullScore: number;
  currentFinalTotal: number;
  counterfactualFinalTotal: number;
  improvement: number;
  resolvesCap: boolean;
}

export interface AuthoritativeEvaluation {
  callType: CallType;
  rawScore: number;
  maxPossibleScore: number;
  normalizedScore: number;
  finalScore: number;
  grade: Grade;
  dimensions: AuthoritativeDimensionResult[];
  appliedCaps: AppliedCap[];
  oneThing: OneThingCalculation;
}

export interface EvaluationRecord {
  id: string;
  callType: CallType;
  originalTranscript: string;
  numberedTranscript: string;
  status: EvaluationStatus;
  currentStage: EvaluationStatus;
  rubricVersion: string;
  promptVersion: string;
  modelProvider: string;
  modelName: string;
  workflowRunId: string | null;
  rawScore: number | null;
  maxPossibleScore: number | null;
  normalizedScore: number | null;
  finalScore: number | null;
  grade: Grade | null;
  appliedCaps: AppliedCap[];
  oneThing: (OneThingCalculation & Partial<ReportNarrative["oneThing"]>) | null;
  brief: string | null;
  redFlags: ReportNarrative["redFlags"];
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
}

export interface StageResultRecord<T = unknown> {
  evaluationId: string;
  stage: StageName;
  schemaVersion: string;
  result: StageEnvelope<T>;
  validated: boolean;
}

export interface CompletedEvaluation extends EvaluationRecord {
  status: "completed";
  dimensions: AuthoritativeDimensionResult[];
  grade: Grade;
  finalScore: number;
  rawScore: number;
  maxPossibleScore: number;
  normalizedScore: number;
  oneThing: OneThingCalculation & ReportNarrative["oneThing"];
  brief: string;
}

export interface EvaluationRepository {
  createEvaluation(input: {
    id: string;
    callType: CallType;
    originalTranscript: string;
    numberedTranscript: string;
    rubricVersion: string;
    promptVersion: string;
    modelProvider: string;
    modelName: string;
  }): Promise<EvaluationRecord>;
  getEvaluation(id: string): Promise<EvaluationRecord | null>;
  getCompletedEvaluation(id: string): Promise<CompletedEvaluation | null>;
  setWorkflowRunId(id: string, workflowRunId: string): Promise<void>;
  markStage(id: string, status: Exclude<EvaluationStatus, "queued" | "completed" | "failed">): Promise<void>;
  markFailed(id: string, input: { code: string; message: string; diagnostic: unknown }): Promise<void>;
  markCompleted(id: string, narrative: ReportNarrative): Promise<void>;
  getStageResult<T>(id: string, stage: StageName, schemaVersion: string): Promise<StageEnvelope<T> | null>;
  saveStageResult<T>(input: StageResultRecord<T>): Promise<void>;
  saveAuthoritativeEvaluation(id: string, result: AuthoritativeEvaluation): Promise<void>;
  incrementAttempt(id: string): Promise<void>;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generateStructured<T>(input: {
    schema: ZodType<T>;
    schemaName: string;
    system: string;
    prompt: string;
    idempotencyKey: string;
  }): Promise<{ data: T; durationMs: number; usage: ProviderMetadata["usage"] }>;
}

export type RawScoringStage = StageEnvelope<ScoringResult>;
