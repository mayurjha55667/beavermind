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

export const CriterionStateSchema = z.enum(["PRESENT", "ABSENT", "UNCLEAR", "NOT_APPLICABLE"]);
export type CriterionState = z.infer<typeof CriterionStateSchema>;

export const RequirementSupportStatusSchema = z.enum([
  "SUPPORTED",
  "NOT_SUPPORTED",
  "CONTRADICTED",
  "UNVERIFIABLE",
  "NOT_APPLICABLE",
]);
export type RequirementSupportStatus = z.infer<typeof RequirementSupportStatusSchema>;

export const CriterionSupportVerdictSchema = z.enum([
  "FULLY_SUPPORTED",
  "PARTIAL",
  "NOT_SUPPORTED",
  "NOT_APPLICABLE",
]);
export type CriterionSupportVerdict = z.infer<typeof CriterionSupportVerdictSchema>;

export const RequirementResultSchema = z
  .object({
    requirementId: z.string().min(1),
    status: RequirementSupportStatusSchema,
    evidenceLineNumbers: z.array(z.number().int().positive()).max(6),
  })
  .strict();

export const MaterialAssumptionSchema = z
  .object({
    requirementId: z.string().min(1),
    assumption: z.string().min(1).max(300),
  })
  .strict();

export const CriterionAssessmentSchema = z
  .object({
    criterionId: z.string().min(1),
    requirementResults: z.array(RequirementResultSchema).min(1).max(12),
    materialAssumptions: z.array(MaterialAssumptionSchema).max(8),
  })
  .strict();

// Backward-compatible export name for code that treats one model item as a
// criterion result. The model no longer chooses the final criterion state.
export const CriterionResultSchema = CriterionAssessmentSchema;

export const CallFactsSchema = z
  .object({
    coachSpeaker: z.string().min(1),
    clientSpeaker: z.string().min(1),
    criteria: z.array(CriterionAssessmentSchema).min(1).max(200),
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

export const ReportNarrativeSchema = z
  .object({
    oneThing: z
      .object({
        headline: z.string().min(1).max(180),
        explanation: z.string().min(1).max(900),
      })
      .strict(),
    brief: z.string().min(1).max(1_200),
    redFlags: z.array(
      z
        .object({
          title: z.string().min(1).max(180),
          explanation: z.string().min(1).max(700),
          evidenceLineNumbers: z.array(z.number().int().positive()).max(6),
          severity: z.enum(["low", "medium", "high"]),
        })
        .strict(),
    ).max(3),
  })
  .strict();
export type ReportNarrative = z.infer<typeof ReportNarrativeSchema>;

export const CreateEvaluationSchema = z
  .object({
    callType: CallTypeSchema,
    transcript: z.string(),
  })
  .strict();
