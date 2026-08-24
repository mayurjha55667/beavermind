import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { verifyEvidenceLedger } from "@/lib/evaluation/evidence";
import { parseTranscript } from "@/lib/transcript/parser";
import { CriterionResultSchema } from "@/schemas/evaluation";
import { makeFacts, SIMPLE_TRANSCRIPT } from "../helpers";

describe("atomic criterion evidence verification", () => {
  it("rejects model-generated quote text from the atomic schema", () => {
    const result = CriterionResultSchema.safeParse({
      criterionId: "kickoff.d03.agenda_mentioned",
      state: "PRESENT",
      evidenceLineNumbers: [3],
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
    facts.criteria[0]!.evidenceLineNumbers = [];
    expect(() => verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);
  });

  it("rejects ABSENT criteria that claim supporting lines", () => {
    const facts = makeFacts();
    facts.criteria[0]!.state = "ABSENT";
    expect(() => verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);
  });

  it("rejects redundant evidence lines when a criterion permits only the strongest moment", () => {
    const facts = makeFacts();
    facts.criteria[0]!.evidenceLineNumbers = [1, 3];
    expect(() => verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);
  });

  it("rejects reused or contradictory post-call commitment classifications", () => {
    const facts = makeFacts();
    const first = facts.criteria.find((criterion) => criterion.criterionId === "kickoff.d12.first_specific_commitment")!;
    const second = facts.criteria.find((criterion) => criterion.criterionId === "kickoff.d12.second_distinct_commitment")!;
    const mostly = facts.criteria.find((criterion) => criterion.criterionId === "kickoff.d12.mostly_precise_timing")!;
    second.evidenceLineNumbers = [...first.evidenceLineNumbers];
    mostly.state = "PRESENT";
    mostly.evidenceLineNumbers = [12];

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
    kickoff.criteria[0]!.state = "NOT_APPLICABLE";
    kickoff.criteria[0]!.evidenceLineNumbers = [];
    expect(() => verifyEvidenceLedger("kickoff", kickoff, parseTranscript(SIMPLE_TRANSCRIPT)))
      .toThrowError(AppError);

    const coaching = makeFacts({ callType: "coaching", diagnosticsApplicable: false });
    expect(() => verifyEvidenceLedger("coaching", coaching, parseTranscript(SIMPLE_TRANSCRIPT)))
      .not.toThrow();
  });
});
