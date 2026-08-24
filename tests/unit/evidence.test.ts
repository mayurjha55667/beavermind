import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { verifyEvidenceLedger } from "@/lib/evaluation/evidence";
import { parseTranscript } from "@/lib/transcript/parser";
import { makeFacts, SIMPLE_TRANSCRIPT } from "../helpers";

describe("exact evidence verification", () => {
  it("reconstructs verified lines from canonical transcript turns", () => {
    const transcript = parseTranscript(SIMPLE_TRANSCRIPT);
    const verified = verifyEvidenceLedger(makeFacts(), transcript);
    expect(verified.dimensions[0]?.positiveEvidence[0]?.transcriptLines[0]).toMatchObject({
      lineNumber: 1,
      speaker: "Coach",
      text: "Evidence for dimension 1.",
    });
    expect(verified.coachSpeakingPercentage).toBeGreaterThan(0);
  });

  it("rejects a paraphrased or fabricated quote", () => {
    const facts = makeFacts();
    facts.dimensions[0]!.positiveEvidence[0]!.quote = "A quote that never happened.";
    expect(() => verifyEvidenceLedger(facts, parseTranscript(SIMPLE_TRANSCRIPT))).toThrowError(
      expect.objectContaining({ code: "EVIDENCE_VALIDATION_FAILED" }),
    );
  });

  it("rejects non-contiguous multi-line evidence", () => {
    const facts = makeFacts();
    facts.dimensions[0]!.positiveEvidence[0]!.lineNumbers = [1, 3];
    expect(() => verifyEvidenceLedger(facts, parseTranscript(SIMPLE_TRANSCRIPT))).toThrowError(
      AppError,
    );
  });
});
