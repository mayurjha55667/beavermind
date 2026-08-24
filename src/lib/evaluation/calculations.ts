import { AppError } from "@/lib/errors/app-error";
import { collectEvidenceLines } from "@/lib/evaluation/evidence";
import type {
  AppliedCap,
  AuthoritativeDimensionResult,
  AuthoritativeEvaluation,
  OneThingCalculation,
  ParsedTranscript,
  VerifiedEvidenceLedger,
} from "@/lib/evaluation/types";
import {
  bandForScore,
  getRubricConfig,
  gradeForScore,
  type CapDefinition,
  type DimensionDefinition,
} from "@/lib/rubrics/config";
import type { CallType, ScoringResult } from "@/schemas/evaluation";

const round = (value: number): number => Math.round((value + Number.EPSILON) * 10) / 10;

interface CounterfactualCandidate extends OneThingCalculation {
  retentionRisk: boolean;
  effectiveMaxScore: number;
}

export function validateAndCalculate(input: {
  callType: CallType;
  scoring: ScoringResult;
  evidence: VerifiedEvidenceLedger;
  transcript: ParsedTranscript;
}): AuthoritativeEvaluation {
  const rubric = getRubricConfig(input.callType);
  const scoresById = new Map(input.scoring.dimensions.map((dimension) => [dimension.dimensionId, dimension]));

  if (scoresById.size !== 12 || rubric.dimensions.some((dimension) => !scoresById.has(dimension.id))) {
    throw new AppError("SCORING_VALIDATION_FAILED", {
      details: { message: "Scoring must contain each dimension from 1 through 12 exactly once." },
    });
  }

  const repairedCapProposals = repairProposedCaps(
    input.scoring,
    rubric.caps,
    input.evidence,
    input.transcript,
  );
  const appliedCaps = buildAppliedCaps(repairedCapProposals, rubric.caps, input.evidence);
  const effectiveMaxScores = calculateEffectiveMaxScores(input.callType, input.evidence);

  const dimensions = rubric.dimensions.map((definition) => {
    const proposed = scoresById.get(definition.id);
    const evidenceDimension = input.evidence.dimensions.find(
      (dimension) => dimension.dimensionId === definition.id,
    );
    if (!proposed || !evidenceDimension) {
      throw new AppError("SCORING_VALIDATION_FAILED");
    }

    if (proposed.name !== definition.name || proposed.rubricMaxScore !== definition.maxScore) {
      throw new AppError("SCORING_VALIDATION_FAILED", {
        details: {
          dimensionId: definition.id,
          message: "Dimension identity or rubric maximum does not match configuration.",
        },
      });
    }

    const disabled = isDimensionDisabled(input.callType, definition.id, input.evidence);
    const effectiveMaxScore = effectiveMaxScores.get(definition.id) ?? definition.maxScore;

    if (disabled) {
      return {
        dimensionId: definition.id,
        name: definition.name,
        score: null,
        rubricMaxScore: definition.maxScore,
        effectiveMaxScore,
        weightedScore: 0,
        band: "N/A" as const,
        disabled: true,
        disabledReason: disabledReason(definition.id, input.evidence),
        reasoning: proposed.reasoning,
        quickFix: proposed.quickFix,
        missingBehaviours: proposed.missingBehaviours,
        evidence: [],
        improvementPotential: 0,
      };
    }

    if (proposed.score === null || proposed.disabled || proposed.band === "N/A") {
      throw new AppError("SCORING_VALIDATION_FAILED", {
        details: { dimensionId: definition.id, message: "An active dimension cannot be N/A." },
      });
    }

    if (!definition.allowedScores.includes(proposed.score)) {
      throw new AppError("SCORING_VALIDATION_FAILED", {
        details: {
          dimensionId: definition.id,
          score: proposed.score,
          allowedScores: definition.allowedScores,
        },
      });
    }

    const proposedBand = bandForScore(definition, proposed.score);
    if (proposedBand !== proposed.band) {
      throw new AppError("SCORING_VALIDATION_FAILED", {
        details: {
          dimensionId: definition.id,
          message: `Band ${proposed.band} does not match permitted bucket ${proposedBand}.`,
        },
      });
    }

    const allowedEvidenceLineNumbers = new Set(
      [...evidenceDimension.positiveEvidence, ...evidenceDimension.negativeEvidence].flatMap(
        (reference) => reference.transcriptLines.map((turn) => turn.lineNumber),
      ),
    );
    const selectedEvidenceLineNumbers = [
      ...new Set(
        proposed.evidenceLineNumbers.filter((lineNumber) =>
          allowedEvidenceLineNumbers.has(lineNumber),
        ),
      ),
    ];
    const repairedEvidenceLineNumbers =
      selectedEvidenceLineNumbers.length > 0 || proposed.score === 0
        ? selectedEvidenceLineNumbers
        : [...allowedEvidenceLineNumbers];
    const evidenceLines = collectEvidenceLines(evidenceDimension, repairedEvidenceLineNumbers).map(
      (turn) => ({
        lineNumber: turn.lineNumber,
        speaker: turn.speaker,
        text: turn.text,
      }),
    );
    const evidenceFreeRubricDefault =
      input.callType === "coaching" &&
      ((definition.id === 5 && !input.evidence.adjustmentNeeded) ||
        (definition.id === 8 && !input.evidence.strugglePresent));
    if (proposed.score > 0 && evidenceLines.length === 0 && !evidenceFreeRubricDefault) {
      throw new AppError("SCORING_VALIDATION_FAILED", {
        details: {
          dimensionId: definition.id,
          message: "A positive score requires at least one verified transcript evidence line.",
        },
      });
    }

    let authoritativeScore = applyDefaults(
      input.callType,
      definition.id,
      proposed.score,
      input.evidence,
    );
    authoritativeScore = applyDimensionCaps(definition.id, authoritativeScore, rubric.caps, input.evidence);

    return {
      dimensionId: definition.id,
      name: definition.name,
      score: authoritativeScore,
      rubricMaxScore: definition.maxScore,
      effectiveMaxScore,
      weightedScore: round((authoritativeScore / definition.maxScore) * effectiveMaxScore),
      band: bandForScore(definition, authoritativeScore),
      disabled: false,
      disabledReason: null,
      reasoning: proposed.reasoning,
      quickFix: proposed.quickFix,
      missingBehaviours: proposed.missingBehaviours,
      evidence: evidenceLines,
      improvementPotential: 0,
    };
  });

  const maxPossibleScore = round(
    dimensions.reduce((total, dimensionResult) => total + dimensionResult.effectiveMaxScore, 0),
  );
  const rawScore = round(
    dimensions.reduce((total, dimensionResult) => total + dimensionResult.weightedScore, 0),
  );
  const normalizedScore = round((rawScore / maxPossibleScore) * 100);
  const finalScore = applyOverallCaps(normalizedScore, rubric.caps, input.evidence);

  const candidates = dimensions
    .filter((dimensionResult) => !dimensionResult.disabled)
    .map((dimensionResult) =>
      simulateDimensionAtFull({
        definition: rubric.dimensions[dimensionResult.dimensionId - 1]!,
        dimension: dimensionResult,
        dimensions,
        rawScore,
        maxPossibleScore,
        finalScore,
        caps: rubric.caps,
        evidence: input.evidence,
      }),
    );

  const selected = [...candidates].sort(compareCounterfactuals)[0];
  if (!selected) {
    throw new AppError("SCORING_VALIDATION_FAILED", {
      details: { message: "No active dimension was available for the counterfactual." },
    });
  }

  const improvementById = new Map(
    candidates.map((candidate) => [candidate.dimensionId, candidate.improvement]),
  );
  const dimensionsWithPotential = dimensions.map((dimensionResult) => ({
    ...dimensionResult,
    improvementPotential: improvementById.get(dimensionResult.dimensionId) ?? 0,
  }));

  const oneThing: OneThingCalculation = {
    dimensionId: selected.dimensionId,
    dimensionName: selected.dimensionName,
    currentScore: selected.currentScore,
    fullScore: selected.fullScore,
    currentFinalTotal: selected.currentFinalTotal,
    counterfactualFinalTotal: selected.counterfactualFinalTotal,
    improvement: selected.improvement,
    resolvesCap: selected.resolvesCap,
  };

  return {
    callType: input.callType,
    rawScore,
    maxPossibleScore,
    normalizedScore,
    finalScore,
    grade: gradeForScore(finalScore),
    dimensions: dimensionsWithPotential,
    appliedCaps,
    oneThing,
  };
}

function calculateEffectiveMaxScores(
  callType: CallType,
  evidence: VerifiedEvidenceLedger,
): Map<number, number> {
  const rubric = getRubricConfig(callType);
  const result = new Map(rubric.dimensions.map((dimension) => [dimension.id, dimension.maxScore]));
  if (callType !== "coaching") {
    return result;
  }

  // The published coaching rows add to 105 although the rubric declares 100 (85 without D4).
  // Until the client resolves that source inconsistency, D5 retains its 0/3/7/10 rubric bucket
  // but carries five effective points. This preserves every explicit total and the full ten-point
  // D2 redistribution without silently changing any rubric bucket.
  result.set(5, 5);

  const diagnosticsDisabled = !evidence.diagnosticsApplicable;
  const movementDisabled = !evidence.movementCoachingPresent;
  if (movementDisabled) {
    result.set(4, 0);
  }
  if (diagnosticsDisabled) {
    result.set(2, 0);
    if (movementDisabled) {
      result.set(3, 25);
    } else {
      result.set(3, 20);
      result.set(4, 20);
    }
  }
  return result;
}

function isDimensionDisabled(
  callType: CallType,
  dimensionId: number,
  evidence: VerifiedEvidenceLedger,
): boolean {
  if (callType !== "coaching") return false;
  if (dimensionId === 2) return !evidence.diagnosticsApplicable;
  if (dimensionId === 4) return !evidence.movementCoachingPresent;
  return false;
}

function disabledReason(dimensionId: number, evidence: VerifiedEvidenceLedger): string {
  if (dimensionId === 2) {
    return evidence.diagnosticsApplicabilityDeclared
      ? "Diagnostics were declared not applicable for this coaching call."
      : "Diagnostics applicability was not supplied for this legacy evaluation, so the dimension was excluded conservatively.";
  }
  return "No live movement, responsive cues, live video review, or real-time form correction occurred.";
}

function applyDefaults(
  callType: CallType,
  dimensionId: number,
  score: number,
  evidence: VerifiedEvidenceLedger,
): number {
  if (callType !== "coaching") return score;
  if (dimensionId === 5 && !evidence.adjustmentNeeded) return 7;
  if (dimensionId === 8 && !evidence.strugglePresent) return 5;
  return score;
}

function applyDimensionCaps(
  dimensionId: number,
  score: number,
  caps: readonly CapDefinition[],
  evidence: VerifiedEvidenceLedger,
): number {
  const limits = caps
    .filter(
      (cap) => cap.type === "dimension" && cap.dimensionId === dimensionId && cap.applies(evidence),
    )
    .map((cap) => cap.limit);
  return limits.length === 0 ? score : Math.min(score, ...limits);
}

function applyOverallCaps(
  score: number,
  caps: readonly CapDefinition[],
  evidence: VerifiedEvidenceLedger,
  resolvedByDimensionId?: number,
): number {
  const limits = caps
    .filter(
      (cap) =>
        cap.type === "overall" &&
        cap.applies(evidence) &&
        (resolvedByDimensionId === undefined ||
          !cap.resolvedByDimensionIds.includes(resolvedByDimensionId)),
    )
    .map((cap) => cap.limit);
  return round(limits.length === 0 ? score : Math.min(score, ...limits));
}

function repairProposedCaps(
  scoring: ScoringResult,
  caps: readonly CapDefinition[],
  evidence: VerifiedEvidenceLedger,
  transcript: ParsedTranscript,
): ScoringResult["proposedCaps"] {
  const capMap = new Map(caps.map((cap) => [cap.id, cap]));
  const repaired: ScoringResult["proposedCaps"] = [];
  const seen = new Set<string>();
  for (const proposed of scoring.proposedCaps) {
    const cap = capMap.get(proposed.capId);
    if (!cap || !cap.applies(evidence) || seen.has(proposed.capId)) continue;
    if (
      proposed.supportingLineNumbers.length === 0 ||
      proposed.supportingLineNumbers.some((line) => !transcript.turns[line - 1])
    ) {
      continue;
    }
    seen.add(proposed.capId);
    repaired.push(proposed);
  }
  return repaired;
}

function buildAppliedCaps(
  proposalsInput: ScoringResult["proposedCaps"],
  caps: readonly CapDefinition[],
  evidence: VerifiedEvidenceLedger,
): AppliedCap[] {
  const proposals = new Map(proposalsInput.map((cap) => [cap.capId, cap]));
  return caps.filter((cap) => cap.applies(evidence)).map((cap) => ({
    id: cap.id,
    label: cap.label,
    type: cap.type,
    limit: cap.limit,
    dimensionId: cap.dimensionId,
    supportingLineNumbers: proposals.get(cap.id)?.supportingLineNumbers ?? [],
    resolvedByDimensionIds: [...cap.resolvedByDimensionIds],
  }));
}

function simulateDimensionAtFull(input: {
  definition: DimensionDefinition;
  dimension: AuthoritativeDimensionResult;
  dimensions: AuthoritativeDimensionResult[];
  rawScore: number;
  maxPossibleScore: number;
  finalScore: number;
  caps: readonly CapDefinition[];
  evidence: VerifiedEvidenceLedger;
}): CounterfactualCandidate {
  const resolvedCaps = input.caps.filter(
    (cap) => cap.applies(input.evidence) && cap.resolvedByDimensionIds.includes(input.dimension.dimensionId),
  );
  const unresolvedDimensionLimits = input.caps
    .filter(
      (cap) =>
        cap.type === "dimension" &&
        cap.dimensionId === input.dimension.dimensionId &&
        cap.applies(input.evidence) &&
        !cap.resolvedByDimensionIds.includes(input.dimension.dimensionId),
    )
    .map((cap) => cap.limit);
  const simulatedRubricScore =
    unresolvedDimensionLimits.length === 0
      ? input.definition.maxScore
      : Math.min(input.definition.maxScore, ...unresolvedDimensionLimits);
  const simulatedWeightedScore = round(
    (simulatedRubricScore / input.definition.maxScore) * input.dimension.effectiveMaxScore,
  );
  const counterfactualRaw = round(
    input.rawScore - input.dimension.weightedScore + simulatedWeightedScore,
  );
  const counterfactualNormalized = round((counterfactualRaw / input.maxPossibleScore) * 100);
  const counterfactualFinal = applyOverallCaps(
    counterfactualNormalized,
    input.caps,
    input.evidence,
    input.dimension.dimensionId,
  );

  return {
    dimensionId: input.dimension.dimensionId,
    dimensionName: input.dimension.name,
    currentScore: input.dimension.score ?? 0,
    fullScore: input.definition.maxScore,
    currentFinalTotal: input.finalScore,
    counterfactualFinalTotal: counterfactualFinal,
    improvement: round(Math.max(0, counterfactualFinal - input.finalScore)),
    resolvesCap: resolvedCaps.length > 0,
    retentionRisk: input.definition.retentionRisk,
    effectiveMaxScore: input.dimension.effectiveMaxScore,
  };
}

function compareCounterfactuals(a: CounterfactualCandidate, b: CounterfactualCandidate): number {
  if (a.improvement !== b.improvement) return b.improvement - a.improvement;
  if (a.resolvesCap !== b.resolvesCap) return a.resolvesCap ? -1 : 1;
  if (a.retentionRisk !== b.retentionRisk) return a.retentionRisk ? -1 : 1;
  if (a.effectiveMaxScore !== b.effectiveMaxScore) return b.effectiveMaxScore - a.effectiveMaxScore;
  return a.dimensionId - b.dimensionId;
}
