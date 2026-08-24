import { describe, expect, it } from "vitest";
import { getRubricConfig, gradeForScore } from "@/lib/rubrics/config";

describe("rubric configuration", () => {
  it("represents kick-off ranges and half-step dimensions exactly", () => {
    const kickoff = getRubricConfig("kickoff");
    expect(kickoff.dimensions).toHaveLength(12);
    expect(kickoff.dimensions[0]?.allowedScores).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(kickoff.dimensions[2]?.allowedScores).toEqual([0, 1, 1.5, 2, 2.5, 3, 3.5, 4.5, 5]);
    expect(kickoff.dimensions[2]?.allowedScores).not.toContain(4);
  });

  it("uses only discrete coaching buckets", () => {
    const coaching = getRubricConfig("coaching");
    expect(coaching.dimensions).toHaveLength(12);
    expect(coaching.dimensions[0]?.allowedScores).toEqual([0, 3, 7, 10]);
    expect(coaching.dimensions[3]?.allowedScores).toEqual([0, 5, 10, 15]);
    expect(coaching.dimensions[9]?.allowedScores).toEqual([0, 5]);
  });

  it.each([
    [90, "ELITE"], [89.9, "STRONG"], [80, "STRONG"], [70, "INCONSISTENT"],
    [60, "AT RISK"], [59.9, "FAIL"],
  ] as const)("maps %s to %s", (score, grade) => expect(gradeForScore(score)).toBe(grade));
});
