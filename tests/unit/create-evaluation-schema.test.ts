import { describe, expect, it } from "vitest";
import { CreateEvaluationSchema } from "@/schemas/evaluation";

describe("evaluation submission context", () => {
  it("requires diagnostics applicability for coaching calls", () => {
    expect(CreateEvaluationSchema.safeParse({
      callType: "coaching",
      transcript: "[Coach]: Hello\n[Client]: Hi",
    }).success).toBe(false);

    expect(CreateEvaluationSchema.safeParse({
      callType: "coaching",
      transcript: "[Coach]: Hello\n[Client]: Hi",
      diagnosticsApplicable: false,
    }).success).toBe(true);
  });

  it("does not accept coaching-only context on kickoff calls", () => {
    expect(CreateEvaluationSchema.safeParse({
      callType: "kickoff",
      transcript: "[Coach]: Hello\n[Client]: Hi",
      diagnosticsApplicable: false,
    }).success).toBe(false);
  });
});
