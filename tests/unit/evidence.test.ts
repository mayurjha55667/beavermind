import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { deriveCriterionSupport, verifyEvidenceLedger } from "@/lib/evaluation/evidence";
import { parseTranscript } from "@/lib/transcript/parser";
import { CriterionResultSchema } from "@/schemas/evaluation";
import { makeFacts, setCriterionState, SIMPLE_TRANSCRIPT } from "../helpers";

describe("atomic criterion evidence verification", () => {
  it("rejects model-generated quote text from the atomic schema", () => {
    const result = CriterionResultSchema.safeParse({
      criterionId: "kickoff.d03.agenda_mentioned",
      requirementResults: [{
        requirementId: "complete_requirement",
        status: "SUPPORTED",
        evidenceLineNumbers: [3],
      }],
      materialAssumptions: [],
      quote: "The model must not reproduce transcript text.",
    });
    expect(result.success).toBe(false);
  });

  it("reconstructs exact evidence from canonical transcript turns", () => {
    const transcript = parseTranscript(SIMPLE_TRANSCRIPT);
    const verified = verifyEvidenceLedger("kickoff", makeFacts(), transcript);
    expect(verified.dimensions[0]?.positiveEvidence[0]?.transcriptLines[0]).toMatchObject({
      lineNumber: 1,
      speaker: "Coach",
      text: "Evidence for dimension 1.",
    });
    expect(verified.coachSpeakingPercentage).toBeGreaterThan(0);
  });

  it("rejects PRESENT criteria without supporting lines", () => {
    const facts = makeFacts();
    facts.criteria[0]!.requirementResults[0]!.evidenceLineNumbers = [];
    expect(() => verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);
  });

  it("rejects NOT_SUPPORTED requirements that claim evidence lines", () => {
    const facts = makeFacts();
    facts.criteria[0]!.requirementResults[0]!.status = "NOT_SUPPORTED";
    expect(() => verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);
  });

  it("rejects redundant evidence lines when a criterion permits only the strongest moment", () => {
    const facts = makeFacts();
    const commitment = facts.criteria.find(
      (criterion) => criterion.criterionId === "kickoff.d12.first_specific_commitment",
    )!;
    commitment.requirementResults[0]!.evidenceLineNumbers = [1, 3];
    expect(() => verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);
  });

  it("rejects reused or contradictory post-call commitment classifications", () => {
    const facts = makeFacts();
    const first = facts.criteria.find((criterion) => criterion.criterionId === "kickoff.d12.first_specific_commitment")!;
    const second = facts.criteria.find((criterion) => criterion.criterionId === "kickoff.d12.second_distinct_commitment")!;
    const mostly = facts.criteria.find((criterion) => criterion.criterionId === "kickoff.d12.mostly_precise_timing")!;
    second.requirementResults[0]!.evidenceLineNumbers = [
      ...first.requirementResults[0]!.evidenceLineNumbers,
    ];
    setCriterionState(facts, mostly.criterionId, "PRESENT", 12);

    expect(() => verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);
  });

  it("rejects a North Star journey link when no program journey is present", () => {
    const facts = makeFacts();
    setCriterionState(facts, "kickoff.d06.timeline_or_milestones", "ABSENT");

    expect(() => verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);
  });

  it("rejects an incomplete criterion catalog", () => {
    const facts = makeFacts();
    facts.criteria.pop();
    expect(() => verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);
  });

  it("allows NOT_APPLICABLE only for explicitly optional rubric criteria", () => {
    const kickoff = makeFacts();
    setCriterionState(kickoff, kickoff.criteria[0]!.criterionId, "NOT_APPLICABLE");
    expect(() => verifyEvidenceLedger("kickoff", kickoff, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);

    const coaching = makeFacts({ callType: "coaching", diagnosticsApplicable: false });
    expect(() => verifyEvidenceLedger("coaching", coaching, parseTranscript(SIMPLE_TRANSCRIPT)))
      .not.toThrow();
  });

  it("derives criterion support conservatively from requirement statuses", () => {
    expect(deriveCriterionSupport(["SUPPORTED", "SUPPORTED"], 0)).toEqual({
      supportVerdict: "FULLY_SUPPORTED",
      state: "PRESENT",
    });
    expect(deriveCriterionSupport(["SUPPORTED", "NOT_SUPPORTED"], 0)).toEqual({
      supportVerdict: "PARTIAL",
      state: "UNCLEAR",
    });
    expect(deriveCriterionSupport(["SUPPORTED"], 1)).toEqual({
      supportVerdict: "PARTIAL",
      state: "UNCLEAR",
    });
    expect(deriveCriterionSupport(["CONTRADICTED"], 0)).toEqual({
      supportVerdict: "NOT_SUPPORTED",
      state: "ABSENT",
    });
  });

  it("denies scoring credit when a material assumption is required", () => {
    const facts = makeFacts();
    const preparation = facts.criteria.find(
      (criterion) => criterion.criterionId === "kickoff.d01.specific_goal_from_notes_early",
    )!;
    preparation.materialAssumptions = [{
      requirementId: "pre_call_source_established",
      assumption: "Assuming the goal came from intake notes.",
    }];

    const verified = verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT));
    expect(
      verified.criteria.find((criterion) => criterion.criterionId === preparation.criterionId),
    ).toMatchObject({ supportVerdict: "PARTIAL", state: "UNCLEAR", evidenceLineNumbers: [] });
  });
});
