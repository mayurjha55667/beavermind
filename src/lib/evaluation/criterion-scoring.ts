import type { VerifiedEvidenceLedger } from "@/lib/evaluation/types";
import {
  getCriterionCatalog,
  getDimensionScoringRules,
  type CriterionView,
} from "@/lib/rubrics/criteria";
import { bandForScore, getRubricConfig } from "@/lib/rubrics/config";
import type { CallType, CriterionState, ScoringResult } from "@/schemas/evaluation";

export function scoreVerifiedCriteria(
  callType: CallType,
  evidence: VerifiedEvidenceLedger,
): ScoringResult {
  const rubric = getRubricConfig(callType);
  const catalog = getCriterionCatalog(callType);
  const results = new Map(evidence.criteria.map((criterion) => [criterion.criterionId, criterion]));
  const view: CriterionView = {
    state: (id): CriterionState => results.get(id)?.state ?? "ABSENT",
    present: (id): boolean => results.get(id)?.state === "PRESENT",
    lines: (id): number[] => results.get(id)?.evidenceLineNumbers ?? [],
    count: (ids): number => ids.filter((id) => results.get(id)?.state === "PRESENT").length,
  };
  const rules = new Map(getDimensionScoringRules(callType).map((rule) => [rule.dimensionId, rule]));

  return {
    dimensions: rubric.dimensions.map((definition) => {
      const disabled =
        callType === "coaching" &&
        ((definition.id === 2 && !evidence.diagnosticsApplicable) ||
          (definition.id === 4 && !evidence.movementCoachingPresent));
      const dimensionCriteria = catalog.filter((criterion) => criterion.dimensionId === definition.id);
      const presentCriteria = dimensionCriteria.filter((criterion) => view.present(criterion.id));
      const reportablePresentCriteria = presentCriteria.filter(
        (criterion) => criterion.missingBehaviour !== null,
      );
      const selectedPresentCriteria = [] as typeof reportablePresentCriteria;
      const selectedEvidenceLineNumbers = new Set<number>();
      for (const criterion of reportablePresentCriteria) {
        if (selectedPresentCriteria.length >= 4) break;
        const completeBundle = [...new Set(view.lines(criterion.id))].sort((a, b) => a - b);
        const additionalLines = completeBundle.filter(
          (lineNumber) => !selectedEvidenceLineNumbers.has(lineNumber),
        );
        if (
          selectedPresentCriteria.length > 0 &&
          selectedEvidenceLineNumbers.size + additionalLines.length > 8
        ) {
          continue;
        }
        selectedPresentCriteria.push(criterion);
        for (const lineNumber of completeBundle) selectedEvidenceLineNumbers.add(lineNumber);
      }
      const evidenceLineNumbers = [...selectedEvidenceLineNumbers].sort((a, b) => a - b);

      if (disabled) {
        return {
          dimensionId: definition.id,
          name: definition.name,
          score: null,
          rubricMaxScore: definition.maxScore,
          band: "N/A" as const,
          disabled: true,
          disabledReason:
            definition.id === 2
              ? "Diagnostics were not applicable on this non-milestone call."
              : "No live movement, responsive cues, live video review, or real-time form correction occurred.",
          reasoning:
            definition.id === 2
              ? "The atomic criteria show that diagnostics were not applicable on this call."
              : "All four movement-coaching detection signals were absent, so this optional dimension is disabled.",
          evidenceLineNumbers: [],
          missingBehaviours: [],
          quickFix: "No change is required for an inapplicable dimension.",
        };
      }

      const rule = rules.get(definition.id);
      if (!rule) throw new Error(`Missing deterministic scoring rule for ${callType} dimension ${definition.id}.`);
      const score = rule.score(view);
      const band = bandForScore(definition, score);
      const contextNeedsImprovement = !(
        callType === "coaching" &&
        definition.id === 5 &&
        !evidence.adjustmentNeeded
      );
      const missingBehaviours =
        score === definition.maxScore || !contextNeedsImprovement
          ? []
          : dimensionCriteria.flatMap((criterion) =>
              !view.present(criterion.id) && criterion.missingBehaviour
                ? [criterion.missingBehaviour]
                : [],
            );
      const verifiedDescriptions = selectedPresentCriteria
        .map((criterion) => criterion.description);
      const reasoning = verifiedDescriptions.length > 0
        ? `Verified criteria: ${verifiedDescriptions.join(" ")} The deterministic ${callType} rubric maps these facts to ${band} (${formatScore(score)}/${definition.maxScore}).`
        : `No positive transcript-backed criterion for this dimension was verified. The deterministic ${callType} rubric maps the result to ${band} (${formatScore(score)}/${definition.maxScore}).`;
      const quickFix = missingBehaviours[0]
        ? `Next improvement: ${missingBehaviours[0]}`
        : "Maintain the verified behaviours consistently.";

      return {
        dimensionId: definition.id,
        name: definition.name,
        score,
        rubricMaxScore: definition.maxScore,
        band,
        disabled: false,
        disabledReason: null,
        reasoning,
        evidenceLineNumbers,
        missingBehaviours: missingBehaviours.slice(0, 5),
        quickFix,
      };
    }),
    proposedCaps: [],
  };
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
