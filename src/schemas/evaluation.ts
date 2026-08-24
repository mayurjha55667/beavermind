import { z } from "zod";

export const CallTypeSchema = z.enum(["kickoff", "coaching"]);
export type CallType = z.infer<typeof CallTypeSchema>;

export const EvaluationStatusSchema = z.enum([
  "queued",
  "extracting_evidence",
  "scoring",
  "validating",
  "synthesizing",
  "completed",
  "failed",
]);
export type EvaluationStatus = z.infer<typeof EvaluationStatusSchema>;

export const StageNameSchema = z.enum(["evidence", "scoring", "validation", "synthesis"]);
export type StageName = z.infer<typeof StageNameSchema>;

export const DimensionBandSchema = z.enum([
  "ELITE",
  "STRONG",
  "MID",
  "SURFACE",
  "WEAK",
  "FAIL",
  "N/A",
]);
export type DimensionBand = z.infer<typeof DimensionBandSchema>;

export const GradeSchema = z.enum(["ELITE", "STRONG", "INCONSISTENT", "AT RISK", "FAIL"]);
export type Grade = z.infer<typeof GradeSchema>;

export const EvidenceReferenceSchema = z
  .object({
    lineNumbers: z.array(z.number().int().positive()).length(1),
    quote: z.string().min(1),
    interpretation: z.string().min(1),
  })
  .strict();

export const DimensionEvidenceSchema = z
  .object({
    dimensionId: z.number().int().min(1).max(12),
    positiveEvidence: z.array(EvidenceReferenceSchema),
    negativeEvidence: z.array(EvidenceReferenceSchema),
    missingBehaviours: z.array(z.string().min(1)),
    evidenceSufficient: z.boolean(),
  })
  .strict();

export const MovementSignalsSchema = z
  .object({
    clientPerformedLiveMovement: z.boolean(),
    coachGaveResponsiveCues: z.boolean(),
    recordedMovementReviewedLive: z.boolean(),
    realTimeFormCorrection: z.boolean(),
  })
  .strict();

export const CallFactsSchema = z
  .object({
    coachSpeaker: z.string().min(1),
    clientSpeaker: z.string().min(1),
    coachSpeakingPercentage: z.number().min(0).max(100),
    coachDominatedWithoutEngagement: z.boolean(),
    nextCallBookedLive: z.boolean(),
    unresolvedConfusion: z.boolean(),
    strugglePresent: z.boolean(),
    struggleHandled: z.boolean().nullable(),
    movementCoachingPresent: z.boolean(),
    movementSignals: MovementSignalsSchema,
    diagnosticsApplicable: z.boolean(),
    adjustmentNeeded: z.boolean(),
    noFollowUpQuestions: z.boolean(),
    noActionStepsForEitherParty: z.boolean(),
    noNorthStarOrLongTermVision: z.boolean(),
    concreteAccountabilityOwned: z.boolean(),
    structuredRecapPresent: z.boolean(),
    coachCommitments: z.array(z.string().min(1)),
    clientCommitments: z.array(z.string().min(1)),
    accountabilityDeadlines: z.array(z.string().min(1)),
    dimensions: z.array(DimensionEvidenceSchema).length(12),
  })
  .strict();
export type CallFacts = z.infer<typeof CallFactsSchema>;

export const DimensionScoreSchema = z
  .object({
    dimensionId: z.number().int().min(1).max(12),
    name: z.string().min(1),
    score: z.number().nullable(),
    rubricMaxScore: z.number().positive(),
    band: DimensionBandSchema,
    disabled: z.boolean(),
    disabledReason: z.string().nullable(),
    reasoning: z.string().min(1),
    evidenceLineNumbers: z.array(z.number().int().positive()),
    missingBehaviours: z.array(z.string().min(1)),
    quickFix: z.string().min(1),
  })
  .strict();

export const ProposedCapSchema = z
  .object({
    capId: z.string().min(1),
    reason: z.string().min(1),
    supportingLineNumbers: z.array(z.number().int().positive()),
  })
  .strict();

export const ScoringResultSchema = z
  .object({
    dimensions: z.array(DimensionScoreSchema).length(12),
    proposedCaps: z.array(ProposedCapSchema),
  })
  .strict();
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

export const RubricBandCheckSchema = z
  .object({
    band: z.enum(["ELITE", "STRONG", "MID", "SURFACE", "WEAK", "FAIL"]),
    requirementsSatisfied: z.boolean(),
    evidenceLineNumbers: z.array(z.number().int().positive()),
    explanation: z.string().min(1),
  })
  .strict();

export const RubricAuditDimensionSchema = z
  .object({
    dimensionId: z.number().int().min(1).max(12),
    score: z.number().nullable(),
    band: DimensionBandSchema,
    reasoning: z.string().min(1),
    evidenceLineNumbers: z.array(z.number().int().positive()),
    quickFix: z.string().min(1),
    bandChecks: z.array(RubricBandCheckSchema),
  })
  .strict();

export const RubricAuditResultSchema = z
  .object({
    dimensions: z.array(RubricAuditDimensionSchema).length(12),
  })
  .strict();
export type RubricAuditResult = z.infer<typeof RubricAuditResultSchema>;

export const ReportNarrativeSchema = z
  .object({
    oneThing: z
      .object({
        headline: z.string().min(1),
        explanation: z.string().min(1),
      })
      .strict(),
    brief: z.string().min(1),
    redFlags: z.array(
      z
        .object({
          title: z.string().min(1),
          explanation: z.string().min(1),
          evidenceLineNumbers: z.array(z.number().int().positive()),
          severity: z.enum(["low", "medium", "high"]),
        })
        .strict(),
    ),
  })
  .strict();
export type ReportNarrative = z.infer<typeof ReportNarrativeSchema>;

export const CreateEvaluationSchema = z
  .object({
    callType: CallTypeSchema,
    transcript: z.string(),
  })
  .strict();
