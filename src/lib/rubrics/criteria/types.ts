import type { CriterionState } from "@/schemas/evaluation";

export interface CriterionRequirementDefinition {
  id: string;
  description: string;
}

export interface CriterionSemanticContract {
  requirements?: readonly CriterionRequirementDefinition[];
  excludedInterpretations?: readonly string[];
}

export interface CriterionDefinition {
  id: string;
  dimensionId: number;
  description: string;
  missingBehaviour: string | null;
  allowNotApplicable?: boolean;
  maxEvidenceLines: number;
  requirements: readonly CriterionRequirementDefinition[];
  excludedInterpretations: readonly string[];
}

export interface CriterionView {
  state(id: string): CriterionState;
  present(id: string): boolean;
  lines(id: string): number[];
  count(ids: readonly string[]): number;
}

export interface DimensionScoringRule {
  dimensionId: number;
  score(criteria: CriterionView): number;
}

export function criterion(
  id: string,
  dimensionId: number,
  description: string,
  missingBehaviour: string | null,
  allowNotApplicable = false,
  maxEvidenceLines = 3,
  semanticContract: CriterionSemanticContract = {},
): CriterionDefinition {
  const requirements = semanticContract.requirements ?? [
    { id: "complete_requirement", description },
  ];
  return {
    id,
    dimensionId,
    description,
    missingBehaviour,
    allowNotApplicable,
    maxEvidenceLines,
    requirements,
    excludedInterpretations: semanticContract.excludedInterpretations ?? [],
  };
}
