import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { verifyEvidenceLedger } from "@/lib/evaluation/evidence";
import { parseTranscript } from "@/lib/transcript/parser";
import { EvidenceReferenceSchema } from "@/schemas/evaluation";
import { makeFacts, SIMPLE_TRANSCRIPT } from "../helpers";

describe("exact evidence verification", () => {
  it("constrains each model evidence reference to one transcript line", () => {
    const result = EvidenceReferenceSchema.safeParse({
      lineNumbers: [1, 3],
      quote: "Combined evidence",
      interpretation: "Two separate moments",
    });
    expect(result.success).toBe(false);
  });

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
    let thrown: unknown;
    try {
      verifyEvidenceLedger(facts, parseTranscript(SIMPLE_TRANSCRIPT));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      code: "EVIDENCE_VALIDATION_FAILED",
      details: [
        expect.objectContaining({
          dimensionId: 1,
          lineNumbers: [1],
          expectedQuote: "Evidence for dimension 1.",
        }),
      ],
    });
  });

  it("accepts an exact quote copied with its displayed line number and speaker", () => {
    const facts = makeFacts();
    facts.dimensions[0]!.positiveEvidence[0]!.quote =
      "L1 [Coach]: Evidence for dimension 1.";
    expect(() => verifyEvidenceLedger(facts, parseTranscript(SIMPLE_TRANSCRIPT))).not.toThrow();
  });

  it("rejects non-contiguous multi-line evidence", () => {
    const facts = makeFacts();
    facts.dimensions[0]!.positiveEvidence[0]!.lineNumbers = [1, 3];
    expect(() => verifyEvidenceLedger(facts, parseTranscript(SIMPLE_TRANSCRIPT))).toThrowError(
      AppError,
    );
  });
});
