import { describe, expect, it } from "vitest";
import { validateAndCalculate } from "@/lib/evaluation/calculations";
import { scoreVerifiedCriteria } from "@/lib/evaluation/criterion-scoring";
import { verifyEvidenceLedger } from "@/lib/evaluation/evidence";
import {
  getCriterionCatalog,
  getDimensionScoringRules,
  type CriterionView,
} from "@/lib/rubrics/criteria";
import { getRubricConfig } from "@/lib/rubrics/config";
import { parseTranscript } from "@/lib/transcript/parser";
import type { CallFacts, CallType, CriterionState } from "@/schemas/evaluation";
import { fixture, makeFacts, SIMPLE_TRANSCRIPT } from "../helpers";

function emptyFacts(
  callType: CallType,
  coachSpeaker = "Coach",
  clientSpeaker = "Client",
): CallFacts {
  const facts = makeFacts({ callType, coachSpeaker, clientSpeaker });
  for (const result of facts.criteria) {
    result.state = "ABSENT";
    result.evidenceLineNumbers = [];
  }
  return facts;
}

function setState(
  facts: CallFacts,
  criterionId: string,
  state: CriterionState,
  ...lineNumbers: number[]
): void {
  const result = facts.criteria.find((criterion) => criterion.criterionId === criterionId);
  if (!result) throw new Error(`Unknown test criterion ${criterionId}.`);
  result.state = state;
  result.evidenceLineNumbers = state === "PRESENT" ? lineNumbers : [];
}

function present(facts: CallFacts, criterionId: string, ...lineNumbers: number[]): void {
  setState(facts, criterionId, "PRESENT", ...lineNumbers);
}

function viewFor(states: Map<string, CriterionState>): CriterionView {
  return {
    state: (id) => states.get(id) ?? "ABSENT",
    present: (id) => states.get(id) === "PRESENT",
    lines: () => [],
    count: (ids) => ids.filter((id) => states.get(id) === "PRESENT").length,
  };
}

describe("deterministic atomic criterion scoring", () => {
  it("locks the known kickoff regression to transcript facts and 52.5/100", () => {
    const transcript = parseTranscript(fixture("kickoff-rubric-regression.txt"));
    const facts = emptyFacts("kickoff", "Coach Maya", "Client Alex");

    present(facts, "kickoff.global.follow_up_question_present", 7);
    present(facts, "kickoff.global.client_engagement_present", 6);

    present(facts, "kickoff.d02.warm_calm_tone", 27);
    present(facts, "kickoff.d02.personalized_interaction", 15);

    present(facts, "kickoff.d03.agenda_mentioned", 3);
    present(facts, "kickoff.d03.phase_connection", 3);
    present(facts, "kickoff.d03.phase_goals", 3);
    present(facts, "kickoff.d03.phase_program_or_support", 3);
    present(facts, "kickoff.d03.phase_actions_or_booking", 3);
    present(facts, "kickoff.d03.crisp_delivery", 3);

    present(facts, "kickoff.d04.functional_goal", 12);
    present(facts, "kickoff.d04.why_follow_up_one", 13);
    present(facts, "kickoff.d04.why_follow_up_two", 17);
    present(facts, "kickoff.d04.emotional_or_identity_driver", 14);
    present(facts, "kickoff.d04.north_star_constructed", 19);
    present(facts, "kickoff.d04.client_confirms_north_star", 20);

    present(facts, "kickoff.d06.basic_expectations", 65);
    present(facts, "kickoff.d07.support_mentioned", 53);

    present(facts, "kickoff.d08.behavioral_patterns", 7);
    present(facts, "kickoff.d08.consistency_triggers", 33);
    present(facts, "kickoff.d08.uses_answers_to_personalize", 35);

    present(facts, "kickoff.d09.clear_next_steps", 45);
    present(facts, "kickoff.d09.specific_timeline", 45);
    present(facts, "kickoff.d09.client_confirms", 60);

    present(facts, "kickoff.d10.booking_attempted", 55);
    present(facts, "kickoff.d10.specific_date", 55);
    present(facts, "kickoff.d10.specific_time", 55);
    present(facts, "kickoff.d10.client_confirms", 56);
    present(facts, "kickoff.d10.proactive_close", 55);

    present(facts, "kickoff.d11.positive_close", 65);

    present(facts, "kickoff.d12.first_specific_commitment", 45);
    present(facts, "kickoff.d12.second_distinct_commitment", 53);
    present(facts, "kickoff.d12.precise_timing_all", 45, 53);

    const evidence = verifyEvidenceLedger("kickoff", facts, transcript);
    const scoring = scoreVerifiedCriteria("kickoff", evidence);
    const result = validateAndCalculate({ callType: "kickoff", evidence, scoring, transcript });

    expect(result.dimensions.map((dimension) => dimension.score)).toEqual([
      0, 7, 3, 10, 0, 3, 3, 7, 7, 5, 3, 4.5,
    ]);
    expect(result).toMatchObject({ rawScore: 52.5, finalScore: 52.5, grade: "FAIL" });
    expect(result.dimensions[0]?.evidence).toEqual([]);
    expect(result.dimensions[2]?.evidence.map((line) => line.lineNumber)).toEqual([3]);
    expect(result.dimensions[2]?.missingBehaviours).toEqual(
      expect.arrayContaining([
        "State the available time window at the outset.",
        "Ask for and receive explicit client agreement to the agenda.",
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(/expectedQuote|prior extraction|validation error/i);
  });

  it("treats UNCLEAR as no credit and never requires a fabricated evidence line", () => {
    const transcript = parseTranscript(SIMPLE_TRANSCRIPT);
    const facts = emptyFacts("kickoff");
    present(facts, "kickoff.global.follow_up_question_present", 1);
    present(facts, "kickoff.global.client_engagement_present", 2);
    present(facts, "kickoff.d03.agenda_mentioned", 3);
    present(facts, "kickoff.d03.phase_connection", 3);
    present(facts, "kickoff.d03.phase_goals", 3);
    present(facts, "kickoff.d03.phase_program_or_support", 3);
    setState(facts, "kickoff.d03.explicit_time_framing", "UNCLEAR");
    setState(facts, "kickoff.d03.client_verbal_consent", "UNCLEAR");

    const evidence = verifyEvidenceLedger("kickoff", facts, transcript);
    const scoring = scoreVerifiedCriteria("kickoff", evidence);

    expect(scoring.dimensions[2]).toMatchObject({ score: 3, band: "MID" });
    expect(scoring.dimensions[2]?.evidenceLineNumbers).toEqual([3]);
  });

  it("exercises every binary branch of all 24 scoring functions and only emits allowed scores", () => {
    const expectedReachableScores: Record<CallType, number[][]> = {
      kickoff: [
        [0, 4, 6, 7, 8, 9, 10],
        [0, 3, 7, 10],
        [0, 1, 2.5, 3, 3.5, 4.5, 5],
        [0, 5, 10, 15],
        [0, 1, 3, 5, 6, 7, 8, 9, 10],
        [0, 3, 7, 10],
        [0, 3, 5],
        [0, 3, 7, 10],
        [0, 3, 7, 10],
        [0, 1, 2.5, 3.5, 4.5, 5],
        [0, 3, 5],
        [0, 1, 2, 3, 4, 4.5, 5],
      ],
      coaching: [
        [0, 3, 7, 10],
        [0, 3, 7, 10],
        [0, 5, 10, 15],
        [0, 5, 10, 15],
        [0, 3, 7, 10],
        [0, 5, 10, 15],
        [0, 3, 5],
        [0, 3, 5],
        [0, 3, 5],
        [0, 5],
        [0, 3, 5],
        [0, 3, 5],
      ],
    };

    for (const callType of ["kickoff", "coaching"] as const) {
      const rubric = getRubricConfig(callType);
      const catalog = getCriterionCatalog(callType);
      for (const rule of getDimensionScoringRules(callType)) {
        const ids = catalog
          .filter((criterion) => criterion.dimensionId === rule.dimensionId)
          .map((criterion) => criterion.id);
        const actual = new Set<number>();
        for (let mask = 0; mask < 2 ** ids.length; mask += 1) {
          const states = new Map<string, CriterionState>();
          ids.forEach((id, index) => states.set(id, mask & (2 ** index) ? "PRESENT" : "ABSENT"));
          const score = rule.score(viewFor(states));
          expect(rubric.dimensions[rule.dimensionId - 1]?.allowedScores).toContain(score);
          actual.add(score);
        }
        expect([...actual].sort((a, b) => a - b)).toEqual(
          expectedReachableScores[callType][rule.dimensionId - 1],
        );
      }
    }
  });

  it("keeps coaching applicability and documented defaults deterministic", () => {
    const transcript = parseTranscript(SIMPLE_TRANSCRIPT);
    const facts = emptyFacts("coaching");
    present(facts, "coaching.global.client_engagement_present", 2);
    setState(facts, "coaching.d02.diagnostics_applicable", "NOT_APPLICABLE");
    const evidence = verifyEvidenceLedger("coaching", facts, transcript);
    const scoring = scoreVerifiedCriteria("coaching", evidence);
    const result = validateAndCalculate({ callType: "coaching", evidence, scoring, transcript });

    expect(result.dimensions[1]).toMatchObject({ disabled: true, score: null, band: "N/A" });
    expect(result.dimensions[3]).toMatchObject({ disabled: true, score: null, band: "N/A" });
    expect(result.dimensions[4]?.score).toBe(7);
    expect(result.dimensions[7]?.score).toBe(5);
    expect(result.dimensions[9]?.score).toBe(0);
  });

  it("does not convert UNCLEAR coaching facts into N/A or rubric defaults", () => {
    const transcript = parseTranscript(SIMPLE_TRANSCRIPT);
    const facts = emptyFacts("coaching");
    present(facts, "coaching.global.client_engagement_present", 2);
    setState(facts, "coaching.d02.diagnostics_applicable", "UNCLEAR");
    setState(facts, "coaching.d04.client_live_movement", "UNCLEAR");
    setState(facts, "coaching.d05.adjustment_needed", "UNCLEAR");
    setState(facts, "coaching.d08.struggle_present", "UNCLEAR");

    const evidence = verifyEvidenceLedger("coaching", facts, transcript);
    const scoring = scoreVerifiedCriteria("coaching", evidence);

    expect(scoring.dimensions[1]).toMatchObject({ disabled: false, score: 0 });
    expect(scoring.dimensions[3]).toMatchObject({ disabled: false, score: 0 });
    expect(scoring.dimensions[4]).toMatchObject({ disabled: false, score: 0 });
    expect(scoring.dimensions[7]).toMatchObject({ disabled: false, score: 0 });
  });
});
