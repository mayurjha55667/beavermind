import { AppError } from "@/lib/errors/app-error";
import type { VerifiedEvidenceLedger } from "@/lib/evaluation/types";
import {
  bandForScore,
  getRubricConfig,
  type DimensionDefinition,
} from "@/lib/rubrics/config";
import type {
  CallType,
  DimensionBand,
  RubricAuditResult,
  ScoringResult,
} from "@/schemas/evaluation";

type ActiveBand = Exclude<DimensionBand, "N/A">;

export function validateRubricAudit(input: {
  callType: CallType;
  audit: RubricAuditResult;
  scoring: ScoringResult;
  evidence: VerifiedEvidenceLedger;
}): ScoringResult {
  const rubric = getRubricConfig(input.callType);
  const auditsById = new Map(input.audit.dimensions.map((dimension) => [dimension.dimensionId, dimension]));
  if (
    auditsById.size !== 12 ||
    rubric.dimensions.some((dimension) => !auditsById.has(dimension.id))
  ) {
    throw auditError("Rubric audit must contain dimensions 1 through 12 exactly once.");
  }

  const auditedDimensions = rubric.dimensions.map((definition) => {
    const audited = auditsById.get(definition.id);
    const evidenceDimension = input.evidence.dimensions.find(
      (dimension) => dimension.dimensionId === definition.id,
    );
    if (!audited || !evidenceDimension) {
      throw auditError("Rubric audit dimension or evidence is missing.", definition.id);
    }

    const disabled = isDisabled(input.callType, definition.id, input.evidence);
    if (disabled) {
      if (audited.score !== null || audited.band !== "N/A" || audited.bandChecks.length !== 0) {
        throw auditError(
          "A rubric-disabled dimension must use score null, band N/A, and no band checks.",
          definition.id,
        );
      }
      return {
        dimensionId: definition.id,
        name: definition.name,
        score: null,
        rubricMaxScore: definition.maxScore,
        band: "N/A" as const,
        disabled: true,
        disabledReason: disabledReason(definition.id),
        reasoning: audited.reasoning,
        evidenceLineNumbers: [],
        missingBehaviours: evidenceDimension.missingBehaviours,
        quickFix: audited.quickFix,
      };
    }

    if (audited.score === null || audited.band === "N/A") {
      throw auditError("An active dimension cannot be N/A.", definition.id);
    }
    if (!definition.allowedScores.includes(audited.score)) {
      throw auditError(
        `Audited score ${audited.score} is not permitted by the rubric.`,
        definition.id,
      );
    }
    const expectedBand = bandForScore(definition, audited.score);
    if (audited.band !== expectedBand) {
      throw auditError(
        `Audited band ${audited.band} does not match score ${audited.score} (${expectedBand}).`,
        definition.id,
      );
    }

    validateBandChecks(definition, audited.bandChecks, audited.band, definition.id);
    const allowedLines = verifiedLinesForDimension(evidenceDimension);
    validateEvidenceLines(audited.evidenceLineNumbers, allowedLines, definition.id, audited.score);
    for (const check of audited.bandChecks) {
      validateEvidenceLines(
        check.evidenceLineNumbers,
        allowedLines,
        definition.id,
        check.requirementsSatisfied && check.band !== "FAIL" ? 1 : 0,
      );
    }

    return {
      dimensionId: definition.id,
      name: definition.name,
      score: audited.score,
      rubricMaxScore: definition.maxScore,
      band: audited.band,
      disabled: false,
      disabledReason: null,
      reasoning: audited.reasoning,
      evidenceLineNumbers: [...new Set(audited.evidenceLineNumbers)],
      missingBehaviours: evidenceDimension.missingBehaviours,
      quickFix: audited.quickFix,
    };
  });

  return {
    dimensions: auditedDimensions,
    proposedCaps: input.scoring.proposedCaps,
  };
}

function validateBandChecks(
  definition: DimensionDefinition,
  checks: RubricAuditResult["dimensions"][number]["bandChecks"],
  selectedBand: DimensionBand,
  dimensionId: number,
): void {
  const expectedBands = definition.buckets.map((bucket) => bucket.band);
  const actualBands = checks.map((check) => check.band);
  if (
    new Set(actualBands).size !== actualBands.length ||
    actualBands.length !== expectedBands.length ||
    expectedBands.some((band) => !actualBands.includes(band))
  ) {
    throw auditError(
      `Band checks must contain exactly: ${expectedBands.join(", ")}.`,
      dimensionId,
    );
  }

  const selectedCheck = checks.find((check) => check.band === selectedBand);
  if (!selectedCheck?.requirementsSatisfied) {
    throw auditError("The selected score band did not pass its mandatory rubric requirements.", dimensionId);
  }

  const selectedMaximum = maximumScoreForBand(definition, selectedBand as ActiveBand);
  const invalidHigherBand = checks.find(
    (check) =>
      check.requirementsSatisfied &&
      maximumScoreForBand(definition, check.band) > selectedMaximum,
  );
  if (invalidHigherBand) {
    throw auditError(
      `Audit selected ${selectedBand} although higher band ${invalidHigherBand.band} passed.`,
      dimensionId,
    );
  }
}

function maximumScoreForBand(definition: DimensionDefinition, band: ActiveBand): number {
  const bucket = definition.buckets.find((candidate) => candidate.band === band);
  return bucket ? Math.max(...bucket.scores) : Number.NEGATIVE_INFINITY;
}

function verifiedLinesForDimension(
  dimension: VerifiedEvidenceLedger["dimensions"][number],
): Set<number> {
  return new Set(
    [...dimension.positiveEvidence, ...dimension.negativeEvidence].flatMap((reference) =>
      reference.transcriptLines.map((turn) => turn.lineNumber),
    ),
  );
}

function validateEvidenceLines(
  lines: number[],
  allowedLines: Set<number>,
  dimensionId: number,
  positiveScore: number,
): void {
  const unique = new Set(lines);
  if (unique.size !== lines.length || lines.some((line) => !allowedLines.has(line))) {
    throw auditError("Rubric audit cited lines outside this dimension's verified ledger.", dimensionId);
  }
  if (positiveScore > 0 && lines.length === 0) {
    throw auditError("A positive rubric decision requires verified supporting evidence.", dimensionId);
  }
}

function isDisabled(
  callType: CallType,
  dimensionId: number,
  evidence: VerifiedEvidenceLedger,
): boolean {
  if (callType !== "coaching") return false;
  if (dimensionId === 2) return !evidence.diagnosticsApplicable;
  if (dimensionId === 4) return !evidence.movementCoachingPresent;
  return false;
}

function disabledReason(dimensionId: number): string {
  if (dimensionId === 2) return "Diagnostics were not applicable on this non-milestone call.";
  return "No live movement, responsive cues, live video review, or real-time form correction occurred.";
}

function auditError(message: string, dimensionId?: number): AppError {
  return new AppError("SCORING_VALIDATION_FAILED", {
    details: { message, ...(dimensionId === undefined ? {} : { dimensionId }) },
  });
}
