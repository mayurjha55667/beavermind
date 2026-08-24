import type { CallFacts, CallType, DimensionBand, Grade } from "@/schemas/evaluation";

export const PROMPT_VERSION = "evaluation-v1.0.3";
export const STAGE_SCHEMA_VERSION = "v2";

interface BandBucket {
  band: Exclude<DimensionBand, "N/A">;
  scores: readonly number[];
}

export interface DimensionDefinition {
  id: number;
  name: string;
  maxScore: number;
  allowedScores: readonly number[];
  buckets: readonly BandBucket[];
  retentionRisk: boolean;
}

export interface CapDefinition {
  id: string;
  label: string;
  type: "overall" | "dimension";
  limit: number;
  dimensionId: number | null;
  resolvedByDimensionIds: readonly number[];
  applies: (facts: CallFacts) => boolean;
}

export interface RubricConfig {
  callType: CallType;
  version: string;
  dimensions: readonly DimensionDefinition[];
  caps: readonly CapDefinition[];
}

const range = (start: number, end: number, step = 1): number[] => {
  const values: number[] = [];
  for (let value = start; value <= end + Number.EPSILON; value += step) {
    values.push(Math.round(value * 10) / 10);
  }
  return values;
};

const dimension = (
  id: number,
  name: string,
  maxScore: number,
  buckets: readonly BandBucket[],
  retentionRisk = false,
): DimensionDefinition => ({
  id,
  name,
  maxScore,
  buckets,
  allowedScores: buckets.flatMap((bucket) => bucket.scores),
  retentionRisk,
});

const KICKOFF_DIMENSIONS = [
  dimension(1, "Pre-Call Preparation", 10, [
    { band: "FAIL", scores: [0] },
    { band: "WEAK", scores: range(1, 3) },
    { band: "MID", scores: range(4, 5) },
    { band: "STRONG", scores: range(6, 8) },
    { band: "ELITE", scores: range(9, 10) },
  ]),
  dimension(2, "Rapport & Tone", 10, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "STRONG", scores: [7] },
    { band: "ELITE", scores: [10] },
  ]),
  dimension(3, "Agenda Framing", 5, [
    { band: "FAIL", scores: [0] },
    { band: "WEAK", scores: [1, 1.5, 2] },
    { band: "MID", scores: [2.5, 3, 3.5] },
    { band: "ELITE", scores: [4.5, 5] },
  ]),
  dimension(
    4,
    "Goal Alignment & Deep Why",
    15,
    [
      { band: "FAIL", scores: [0] },
      { band: "MID", scores: [5] },
      { band: "STRONG", scores: [10] },
      { band: "ELITE", scores: [15] },
    ],
    true,
  ),
  dimension(5, "Program Explanation (3 Phases)", 10, [
    { band: "FAIL", scores: [0] },
    { band: "WEAK", scores: range(1, 2) },
    { band: "MID", scores: range(3, 5) },
    { band: "STRONG", scores: range(6, 8) },
    { band: "ELITE", scores: range(9, 10) },
  ]),
  dimension(6, "Journey & Expectation Setting", 10, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "STRONG", scores: [7] },
    { band: "ELITE", scores: [10] },
  ], true),
  dimension(7, "Support System Clarity", 5, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "ELITE", scores: [5] },
  ]),
  dimension(8, "Coaching Intelligence Questions", 10, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "STRONG", scores: [7] },
    { band: "ELITE", scores: [10] },
  ], true),
  dimension(9, "Next Steps & Diagnostics", 10, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "STRONG", scores: [7] },
    { band: "ELITE", scores: [10] },
  ], true),
  dimension(10, "Booking Next Call", 5, [
    { band: "FAIL", scores: [0] },
    { band: "WEAK", scores: [1, 1.5, 2] },
    { band: "MID", scores: [2.5, 3, 3.5] },
    { band: "ELITE", scores: [4.5, 5] },
  ], true),
  dimension(11, "Close, Recap & Confidence", 5, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "ELITE", scores: [5] },
  ]),
  dimension(12, "Post-Call Execution", 5, [
    { band: "FAIL", scores: [0] },
    { band: "WEAK", scores: [1] },
    { band: "MID", scores: [2, 2.5, 3] },
    { band: "STRONG", scores: [3.5, 4] },
    { band: "ELITE", scores: [4.5, 5] },
  ], true),
] as const;

const COACHING_DIMENSIONS = [
  dimension(1, "Check-In & Connection", 10, [
    { band: "FAIL", scores: [0] },
    { band: "SURFACE", scores: [3] },
    { band: "STRONG", scores: [7] },
    { band: "ELITE", scores: [10] },
  ]),
  dimension(2, "Diagnostics Review", 10, [
    { band: "FAIL", scores: [0] },
    { band: "SURFACE", scores: [3] },
    { band: "STRONG", scores: [7] },
    { band: "ELITE", scores: [10] },
  ]),
  dimension(3, "Program Focus + Vision", 15, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [5] },
    { band: "STRONG", scores: [10] },
    { band: "ELITE", scores: [15] },
  ], true),
  dimension(4, "Movement Coaching Quality", 15, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [5] },
    { band: "STRONG", scores: [10] },
    { band: "ELITE", scores: [15] },
  ], true),
  dimension(5, "Adjustments & Strategy", 10, [
    { band: "FAIL", scores: [0] },
    { band: "SURFACE", scores: [3] },
    { band: "STRONG", scores: [7] },
    { band: "ELITE", scores: [10] },
  ]),
  dimension(6, "Action Steps & Accountability", 15, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [5] },
    { band: "STRONG", scores: [10] },
    { band: "ELITE", scores: [15] },
  ], true),
  dimension(7, "Accountability Anchor", 5, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "ELITE", scores: [5] },
  ], true),
  dimension(8, "Struggle Handling", 5, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "ELITE", scores: [5] },
  ], true),
  dimension(9, "Close Quality", 5, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "ELITE", scores: [5] },
  ]),
  dimension(10, "Next Call Booking", 5, [
    { band: "FAIL", scores: [0] },
    { band: "ELITE", scores: [5] },
  ], true),
  dimension(11, "Continuity & Follow-Up Clarity", 5, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "ELITE", scores: [5] },
  ], true),
  dimension(12, "Structure & Time Management", 5, [
    { band: "FAIL", scores: [0] },
    { band: "MID", scores: [3] },
    { band: "ELITE", scores: [5] },
  ]),
] as const;

const KICKOFF_CAPS: readonly CapDefinition[] = [
  {
    id: "kickoff_no_follow_up_questions",
    label: "No follow-up questions anywhere in the call",
    type: "overall",
    limit: 70,
    dimensionId: null,
    resolvedByDimensionIds: [4, 8],
    applies: (facts) => facts.noFollowUpQuestions,
  },
  {
    id: "kickoff_speaking_dominance",
    label: "Coach spoke over 70% without client engagement",
    type: "overall",
    limit: 80,
    dimensionId: null,
    resolvedByDimensionIds: [2, 8],
    applies: (facts) =>
      facts.coachSpeakingPercentage > 70 && facts.coachDominatedWithoutEngagement,
  },
  {
    id: "kickoff_unresolved_confusion",
    label: "Client left with unresolved confusion",
    type: "overall",
    limit: 75,
    dimensionId: null,
    resolvedByDimensionIds: [9],
    applies: (facts) => facts.unresolvedConfusion,
  },
  {
    id: "kickoff_missing_north_star",
    label: "No North Star statement constructed",
    type: "dimension",
    limit: 10,
    dimensionId: 4,
    resolvedByDimensionIds: [4],
    applies: (facts) => facts.noNorthStarOrLongTermVision,
  },
  {
    id: "kickoff_missing_structured_recap",
    label: "No structured recap",
    type: "dimension",
    limit: 3,
    dimensionId: 11,
    resolvedByDimensionIds: [11],
    applies: (facts) => !facts.structuredRecapPresent,
  },
];

const COACHING_CAPS: readonly CapDefinition[] = [
  {
    id: "coaching_next_call_not_booked",
    label: "Next call was not booked live",
    type: "dimension",
    limit: 0,
    dimensionId: 10,
    resolvedByDimensionIds: [10],
    applies: (facts) => !facts.nextCallBookedLive,
  },
  {
    id: "coaching_no_long_term_vision",
    label: "No connection to long-term vision",
    type: "dimension",
    limit: 10,
    dimensionId: 3,
    resolvedByDimensionIds: [3],
    applies: (facts) => facts.noNorthStarOrLongTermVision,
  },
  {
    id: "coaching_speaking_dominance",
    label: "Coach spoke over 75% while the client was passive",
    type: "overall",
    limit: 75,
    dimensionId: null,
    resolvedByDimensionIds: [1, 4],
    applies: (facts) =>
      facts.coachSpeakingPercentage > 75 && facts.coachDominatedWithoutEngagement,
  },
  {
    id: "coaching_no_accountability_commitment",
    label: "No concrete accountability commitment owned by the client",
    type: "dimension",
    limit: 10,
    dimensionId: 6,
    resolvedByDimensionIds: [6, 7],
    applies: (facts) => !facts.concreteAccountabilityOwned,
  },
  {
    id: "coaching_struggle_ignored",
    label: "Client struggle was present but ignored",
    type: "dimension",
    limit: 0,
    dimensionId: 8,
    resolvedByDimensionIds: [8],
    applies: (facts) => facts.strugglePresent && facts.struggleHandled === false,
  },
  {
    id: "coaching_no_action_steps",
    label: "No action steps stated for either party",
    type: "overall",
    limit: 70,
    dimensionId: null,
    resolvedByDimensionIds: [6],
    applies: (facts) => facts.noActionStepsForEitherParty,
  },
];

const RUBRICS: Record<CallType, RubricConfig> = {
  kickoff: {
    callType: "kickoff",
    version: "kickoff-source-main-2026-08-24",
    dimensions: KICKOFF_DIMENSIONS,
    caps: KICKOFF_CAPS,
  },
  coaching: {
    callType: "coaching",
    version: "coaching-source-main-2026-08-24",
    dimensions: COACHING_DIMENSIONS,
    caps: COACHING_CAPS,
  },
};

export function getRubricConfig(callType: CallType): RubricConfig {
  return RUBRICS[callType];
}

export function bandForScore(definition: DimensionDefinition, score: number): DimensionBand {
  const bucket = definition.buckets.find((candidate) => candidate.scores.includes(score));
  if (!bucket) {
    throw new Error(`Score ${score} has no band for dimension ${definition.id}.`);
  }
  return bucket.band;
}

export function gradeForScore(score: number): Grade {
  if (score >= 90) return "ELITE";
  if (score >= 80) return "STRONG";
  if (score >= 70) return "INCONSISTENT";
  if (score >= 60) return "AT RISK";
  return "FAIL";
}
