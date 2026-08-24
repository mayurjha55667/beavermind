import { describe, expect, it } from "vitest";
import { verifyEvidenceLedger } from "@/lib/evaluation/evidence";
import { validateRubricAudit } from "@/lib/evaluation/rubric-audit";
import { parseTranscript } from "@/lib/transcript/parser";
import {
  makeFacts,
  makeRubricAudit,
  makeScoring,
  SIMPLE_TRANSCRIPT,
} from "../helpers";

function validate(
  audit = makeRubricAudit("kickoff"),
  scoring = makeScoring("kickoff"),
) {
  const transcript = parseTranscript(SIMPLE_TRANSCRIPT);
  const evidence = verifyEvidenceLedger(makeFacts(), transcript);
  return validateRubricAudit({
    callType: "kickoff",
    audit,
    scoring,
    evidence,
  });
}

describe("strict rubric audit", () => {
  it("makes corrected rubric bands authoritative over the initial scoring", () => {
    const audited = validate(
      makeRubricAudit("kickoff", { 1: 0, 3: 3.5, 4: 10 }),
      makeScoring("kickoff", { 1: 7, 3: 4.5, 4: 15 }),
    );

    expect(audited.dimensions[0]).toMatchObject({ score: 0, band: "FAIL" });
    expect(audited.dimensions[2]).toMatchObject({ score: 3.5, band: "MID" });
    expect(audited.dimensions[3]).toMatchObject({ score: 10, band: "STRONG" });
  });

  it("rejects a score when its selected band did not pass every requirement", () => {
    const audit = makeRubricAudit("kickoff");
    audit.dimensions[2]!.bandChecks.find((check) => check.band === "ELITE")!
      .requirementsSatisfied = false;

    expect(() => validate(audit)).toThrowError(
      expect.objectContaining({ code: "SCORING_VALIDATION_FAILED" }),
    );
  });

  it("rejects a lower score when a higher complete band passed", () => {
    const audit = makeRubricAudit("kickoff", { 3: 3.5 });
    const elite = audit.dimensions[2]!.bandChecks.find((check) => check.band === "ELITE")!;
    elite.requirementsSatisfied = true;
    elite.evidenceLineNumbers = [3];

    expect(() => validate(audit, makeScoring("kickoff", { 3: 3.5 }))).toThrowError(
      expect.objectContaining({ code: "SCORING_VALIDATION_FAILED" }),
    );
  });

  it("rejects rubric evidence borrowed from another dimension", () => {
    const audit = makeRubricAudit("kickoff");
    audit.dimensions[0]!.evidenceLineNumbers = [2];

    expect(() => validate(audit)).toThrowError(
      expect.objectContaining({ code: "SCORING_VALIDATION_FAILED" }),
    );
  });

  it("applies the same band gate to coaching evaluations", () => {
    const transcript = parseTranscript(SIMPLE_TRANSCRIPT);
    const evidence = verifyEvidenceLedger(makeFacts(), transcript);
    const scoring = makeScoring("coaching", { 1: 7 });
    const result = validateRubricAudit({
      callType: "coaching",
      audit: makeRubricAudit("coaching", { 1: 7 }),
      scoring,
      evidence,
    });

    expect(result.dimensions[0]).toMatchObject({ score: 7, band: "STRONG" });
  });
});
