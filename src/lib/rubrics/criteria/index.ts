import type { CallType } from "@/schemas/evaluation";
import { COACHING_CRITERIA, COACHING_SCORING_RULES } from "./coaching";
import { KICKOFF_CRITERIA, KICKOFF_SCORING_RULES } from "./kickoff";
import type { CriterionDefinition, DimensionScoringRule } from "./types";

export type { CriterionDefinition, CriterionView, DimensionScoringRule } from "./types";

export function getCriterionCatalog(callType: CallType): readonly CriterionDefinition[] {
  return callType === "kickoff" ? KICKOFF_CRITERIA : COACHING_CRITERIA;
}

export function getDimensionScoringRules(callType: CallType): readonly DimensionScoringRule[] {
  return callType === "kickoff" ? KICKOFF_SCORING_RULES : COACHING_SCORING_RULES;
}
