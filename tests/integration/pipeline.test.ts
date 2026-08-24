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
  providerFailure,
} from "../helpers";

function successfulProvider() {
  return new QueueProvider({
    call_facts: [makeFacts()],
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
    expect(provider.calls).toEqual(["call_facts", "report_narrative"]);
  });

  it("retries invalid structured evidence output once and then succeeds", async () => {
    const repository = new InMemoryRepository();
    const provider = new QueueProvider({
      call_facts: [{ invalid: true }, makeFacts()],
      report_narrative: [makeNarrative()],
    });
    await runCompleteEvaluation(repository.evaluation.id, { repository, provider });
    expect(repository.evaluation.status).toBe("completed");
    expect(provider.calls.filter((name) => name === "call_facts")).toHaveLength(2);
  });

  it("fails safely after an invalid line reference also fails the correction retry", async () => {
    const repository = new InMemoryRepository();
    const invalid = () => {
      const facts = makeFacts();
      facts.criteria[0]!.requirementResults[0]!.evidenceLineNumbers = [999];
      return facts;
    };
    const provider = new QueueProvider({ call_facts: [invalid(), invalid()] });
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

  it("rejects PRESENT criterion credit when no verified line exists", async () => {
    const repository = new InMemoryRepository();
    const invalid = () => {
      const facts = makeFacts();
      facts.criteria[0]!.requirementResults[0]!.evidenceLineNumbers = [];
      return facts;
    };
    const provider = new QueueProvider({
      call_facts: [invalid(), invalid()],
    });
    await expect(
      runCompleteEvaluation(repository.evaluation.id, { repository, provider }),
    ).rejects.toMatchObject({ code: "EVIDENCE_VALIDATION_FAILED" });
    expect(repository.evaluation.status).toBe("failed");
  });

  it("blocks internal extraction diagnostics from client-facing narrative", async () => {
    const repository = new InMemoryRepository();
    const narrative = makeNarrative();
    narrative.brief = "The prior extraction used the wrong expectedQuote.";
    const provider = new QueueProvider({
      call_facts: [makeFacts()],
      report_narrative: [narrative],
    });

    await expect(
      runCompleteEvaluation(repository.evaluation.id, { repository, provider }),
    ).rejects.toMatchObject({ code: "NARRATIVE_VALIDATION_FAILED" });
    expect(repository.evaluation).toMatchObject({
      status: "failed",
      errorCode: "NARRATIVE_VALIDATION_FAILED",
    });
  });
});
