import { describe, expect, it } from "vitest";
import { validateAndCalculate } from "@/lib/evaluation/calculations";
import { verifyEvidenceLedger } from "@/lib/evaluation/evidence";
import { parseTranscript } from "@/lib/transcript/parser";
import { fixture, makeFacts, makeScoring, SIMPLE_TRANSCRIPT } from "../helpers";

function calculate(
  callType: "kickoff" | "coaching",
  options: {
    facts?: ReturnType<typeof makeFacts>;
    scoring?: ReturnType<typeof makeScoring>;
    transcript?: string;
  } = {},
) {
  const transcript = parseTranscript(options.transcript ?? SIMPLE_TRANSCRIPT);
  const evidence = verifyEvidenceLedger(options.facts ?? makeFacts(), transcript);
  return validateAndCalculate({
    callType,
    evidence,
    scoring: options.scoring ?? makeScoring(callType),
    transcript,
  });
}

describe("deterministic calculations", () => {
  it("applies an overall automatic cap without model arithmetic", () => {
    const result = calculate("kickoff", { facts: makeFacts({ noFollowUpQuestions: true }) });
    expect(result.normalizedScore).toBe(100);
    expect(result.finalScore).toBe(70);
    expect(result.appliedCaps.map((cap) => cap.id)).toContain("kickoff_no_follow_up_questions");
  });

  it("repairs unknown or unsupported model cap proposals without losing fact-derived caps", () => {
    const scoring = makeScoring("kickoff");
    scoring.proposedCaps = [
      {
        capId: "model_invented_cap",
        reason: "The model invented an identifier.",
        supportingLineNumbers: [1],
      },
      {
        capId: "kickoff_unresolved_confusion",
        reason: "The verified facts do not support this cap.",
        supportingLineNumbers: [1],
      },
      {
        capId: "kickoff_no_follow_up_questions",
        reason: "This cap applies, but the cited line is invalid.",
        supportingLineNumbers: [999],
      },
    ];
    const result = calculate("kickoff", {
      facts: makeFacts({ noFollowUpQuestions: true }),
      scoring,
    });
    expect(result.finalScore).toBe(70);
    expect(result.appliedCaps).toEqual([
      expect.objectContaining({
        id: "kickoff_no_follow_up_questions",
        supportingLineNumbers: [],
      }),
    ]);
  });

  it("repairs scoring citations to the verified per-dimension evidence ledger", () => {
    const scoring = makeScoring("kickoff");
    scoring.dimensions[3]!.evidenceLineNumbers = [4, 999];
    scoring.dimensions[8]!.evidenceLineNumbers = [999];
    const result = calculate("kickoff", { scoring });
    expect(result.dimensions[3]?.evidence.map((line) => line.lineNumber)).toEqual([4]);
    expect(result.dimensions[8]?.evidence.map((line) => line.lineNumber)).toEqual([9]);
  });

  it("disables D4 only when all movement signals are absent and normalizes from 85", () => {
    const facts = makeFacts({
      movementCoachingPresent: false,
      movementSignals: {
        clientPerformedLiveMovement: false,
        coachGaveResponsiveCues: false,
        recordedMovementReviewedLive: false,
        realTimeFormCorrection: false,
      },
    });
    const scoring = makeScoring("coaching", { 4: null });
    const result = calculate("coaching", { facts, scoring });
    expect(result.dimensions[3]).toMatchObject({ disabled: true, score: null, band: "N/A" });
    expect(result.maxPossibleScore).toBe(85);
    expect(result.normalizedScore).toBe(100);
  });

  it("does not infer movement coaching in the strategy/accountability fixture", () => {
    const source = fixture("coaching-02.txt");
    const parsed = parseTranscript(source);
    const facts = makeFacts({
      coachSpeaker: "Marcus Reid",
      clientSpeaker: "Hannah Vogel",
      movementCoachingPresent: false,
      diagnosticsApplicable: false,
      movementSignals: {
        clientPerformedLiveMovement: false,
        coachGaveResponsiveCues: false,
        recordedMovementReviewedLive: false,
        realTimeFormCorrection: false,
      },
      dimensions: makeFacts().dimensions.map((dimension) => ({ ...dimension, positiveEvidence: [], evidenceSufficient: false })),
    });
    const scoring = makeScoring("coaching", { 2: null, 4: null });
    scoring.dimensions.forEach((dimension) => {
      dimension.evidenceLineNumbers = [];
      if (!dimension.disabled) {
        dimension.score = 0;
        dimension.band = "FAIL";
      }
    });
    const result = validateAndCalculate({
      callType: "coaching",
      scoring,
      evidence: verifyEvidenceLedger(facts, parsed),
      transcript: parsed,
    });
    expect(result.dimensions[3]?.disabled).toBe(true);
  });

  it("redistributes D2 proportionally to D3 and active D4", () => {
    const facts = makeFacts({ diagnosticsApplicable: false });
    const scoring = makeScoring("coaching", { 2: null });
    const result = calculate("coaching", { facts, scoring });
    expect(result.dimensions[1]).toMatchObject({ disabled: true, effectiveMaxScore: 0 });
    expect(result.dimensions[2]?.effectiveMaxScore).toBe(20);
    expect(result.dimensions[3]?.effectiveMaxScore).toBe(20);
    expect(result.maxPossibleScore).toBe(100);
  });

  it("applies the documented D5 and D8 defaults", () => {
    const facts = makeFacts({ adjustmentNeeded: false, strugglePresent: false, struggleHandled: null });
    const scoring = makeScoring("coaching", { 5: 0, 8: 0 });
    const result = calculate("coaching", { facts, scoring });
    expect(result.dimensions[4]?.score).toBe(7);
    expect(result.dimensions[7]?.score).toBe(5);
  });

  it("treats D10 booking as non-recoverable and selects it when it moves the score most", () => {
    const facts = makeFacts({ nextCallBookedLive: false });
    const result = calculate("coaching", { facts });
    expect(result.dimensions[9]?.score).toBe(0);
    expect(result.oneThing).toMatchObject({ dimensionId: 10, resolvesCap: true, improvement: 5 });
    expect(result.oneThing.counterfactualFinalTotal).toBe(100);
  });
});
