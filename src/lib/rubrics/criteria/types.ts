import type { CriterionState } from "@/schemas/evaluation";

export interface CriterionDefinition {
  id: string;
  dimensionId: number;
  description: string;
  missingBehaviour: string | null;
  allowNotApplicable?: boolean;
  maxEvidenceLines: number;
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
  maxEvidenceLines = 1,
): CriterionDefinition {
  return { id, dimensionId, description, missingBehaviour, allowNotApplicable, maxEvidenceLines };
}
