import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import {
  runCompleteEvaluation,
  runEvidenceStage,
} from "@/lib/evaluation/stages";
import {
  InMemoryRepository,
  QueueProvider,
  makeFacts,
  makeNarrative,
  makeRubricAudit,
  makeScoring,
  providerFailure,
} from "../helpers";

function successfulProvider() {
  return new QueueProvider({
    call_facts: [makeFacts()],
    rubric_scoring: [makeScoring("kickoff")],
    rubric_audit: [makeRubricAudit("kickoff")],
    report_narrative: [makeNarrative()],
  });
}

describe("four-stage evaluation integration", () => {
  it("completes with 12 traceable dimensions and a persisted report", async () => {
    const repository = new InMemoryRepository();
    const provider = successfulProvider();
    await runCompleteEvaluation(repository.evaluation.id, { repository, provider });

    expect(repository.evaluation.status).toBe("completed");
    expect(repository.dimensions).toHaveLength(12);
    expect(repository.dimensions.every((dimension) => dimension.evidence.length > 0)).toBe(true);
    expect(repository.dimensions.every((dimension) => dimension.missingBehaviours.length === 0)).toBe(true);
    expect(provider.calls).toEqual([
      "call_facts",
      "rubric_scoring",
      "rubric_audit",
      "report_narrative",
    ]);
  });

  it("retries invalid structured evidence output once and then succeeds", async () => {
    const repository = new InMemoryRepository();
    const provider = new QueueProvider({
      call_facts: [{ invalid: true }, makeFacts()],
      rubric_scoring: [makeScoring("kickoff")],
      rubric_audit: [makeRubricAudit("kickoff")],
      report_narrative: [makeNarrative()],
    });
    await runCompleteEvaluation(repository.evaluation.id, { repository, provider });
    expect(repository.evaluation.status).toBe("completed");
    expect(provider.calls.filter((name) => name === "call_facts")).toHaveLength(2);
  });

  it("retries a rubric audit that approves a band without satisfying its requirements", async () => {
    const repository = new InMemoryRepository();
    const invalidAudit = makeRubricAudit("kickoff");
    invalidAudit.dimensions[0]!.bandChecks.find((check) => check.band === "ELITE")!
      .requirementsSatisfied = false;
    const provider = new QueueProvider({
      call_facts: [makeFacts()],
      rubric_scoring: [makeScoring("kickoff")],
      rubric_audit: [invalidAudit, makeRubricAudit("kickoff")],
      report_narrative: [makeNarrative()],
    });

    await runCompleteEvaluation(repository.evaluation.id, { repository, provider });

    expect(provider.calls.filter((name) => name === "rubric_audit")).toHaveLength(2);
    expect(repository.evaluation.status).toBe("completed");
  });

  it("fails safely after a fabricated quote also fails the correction retry", async () => {
    const repository = new InMemoryRepository();
    const fabricated = () => {
      const facts = makeFacts();
      facts.dimensions[0]!.positiveEvidence[0]!.quote = "This was never said.";
      return facts;
    };
    const provider = new QueueProvider({ call_facts: [fabricated(), fabricated()] });
    await expect(
      runCompleteEvaluation(repository.evaluation.id, { repository, provider }),
    ).rejects.toMatchObject({ code: "EVIDENCE_VALIDATION_FAILED" });
    expect(repository.evaluation).toMatchObject({
      status: "failed",
      errorCode: "EVIDENCE_VALIDATION_FAILED",
    });
    expect(provider.calls).toHaveLength(2);
  });

  it("persists a useful failed state after provider failure", async () => {
    const repository = new InMemoryRepository();
    const provider = new QueueProvider({
      call_facts: [providerFailure(), providerFailure()],
    });
    await expect(
      runCompleteEvaluation(repository.evaluation.id, { repository, provider }),
    ).rejects.toBeInstanceOf(AppError);
    expect(repository.evaluation.status).toBe("failed");
    expect(repository.evaluation.errorCode).toBe("PROVIDER_FAILURE");
    expect(repository.evaluation.errorMessage).not.toContain("stack");
  });

  it("does not duplicate an LLM call when a validated stage is retried", async () => {
    const repository = new InMemoryRepository();
    const provider = new QueueProvider({ call_facts: [makeFacts()] });
    await runEvidenceStage(repository.evaluation.id, { repository, provider });
    await runEvidenceStage(repository.evaluation.id, { repository, provider });
    expect(provider.calls).toEqual(["call_facts"]);
  });

  it("rejects unsupported positive credit when no verified evidence exists", async () => {
    const repository = new InMemoryRepository();
    const facts = makeFacts({
      dimensions: makeFacts().dimensions.map((dimension) => ({
        ...dimension,
        positiveEvidence: [],
        negativeEvidence: [],
        evidenceSufficient: false,
      })),
    });
    const scoring = makeScoring("kickoff");
    scoring.dimensions.forEach((dimension) => { dimension.evidenceLineNumbers = []; });
    const provider = new QueueProvider({
      call_facts: [facts],
      rubric_scoring: [scoring],
      rubric_audit: [makeRubricAudit("kickoff"), makeRubricAudit("kickoff")],
    });
    await expect(
      runCompleteEvaluation(repository.evaluation.id, { repository, provider }),
    ).rejects.toMatchObject({ code: "SCORING_VALIDATION_FAILED" });
    expect(repository.evaluation.status).toBe("failed");
  });
});
