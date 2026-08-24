import { describe, expect, it } from "vitest";
import { verifyEvidenceLedger } from "@/lib/evaluation/evidence";
import { EVIDENCE_SYSTEM_PROMPT, buildEvidencePrompt } from "@/lib/llm/prompts";
import { getCriterionCatalog } from "@/lib/rubrics/criteria";
import { parseTranscript } from "@/lib/transcript/parser";
import { makeFacts, SIMPLE_TRANSCRIPT } from "../helpers";

describe("strict semantic entailment contracts", () => {
  it("sends requirement boundaries and exclusions instead of asking for a free verdict", () => {
    const catalog = getCriterionCatalog("kickoff");
    const learningStyle = catalog.find(
      (criterion) => criterion.id === "kickoff.d08.learning_style",
    )!;
    const prompt = buildEvidencePrompt({
      callType: "kickoff",
      criteria: [learningStyle],
      numberedTranscript: "L1 [Coach]: How do you prefer to learn?",
    });

    expect(EVIDENCE_SYSTEM_PROMPT).toContain("strict-reviewer test");
    expect(EVIDENCE_SYSTEM_PROMPT).toContain("does not by itself establish a learning style");
    expect(EVIDENCE_SYSTEM_PROMPT).not.toContain("PRESENT means");
    expect(prompt).toContain("preference_explicitly_explored");
    expect(prompt).toContain("accountability frequency or reminder preference");
  });

  it("defines explicit multi-part contracts for the known false-positive boundaries", () => {
    const catalog = new Map(
      getCriterionCatalog("kickoff").map((criterion) => [criterion.id, criterion]),
    );

    expect(catalog.get("kickoff.d06.timeline_or_milestones")?.requirements.map((item) => item.id))
      .toEqual([
        "coach_explains_program_path",
        "intermediate_progression_or_milestone",
        "timing_attached_to_program_path",
      ]);
    expect(catalog.get("kickoff.d06.timeline_or_milestones")?.excludedInterpretations.join(" "))
      .toMatch(/future endpoint goal/i);
    expect(catalog.get("kickoff.d06.north_star_link")?.requirements.map((item) => item.id))
      .toEqual(["journey_expectation_present", "explicit_north_star_connection"]);
    expect(catalog.get("kickoff.d06.physical_discomfort_normalized")?.requirements.map((item) => item.id))
      .toContain("explicitly_expected_or_normal");
    expect(catalog.get("kickoff.d08.learning_style")?.excludedInterpretations.join(" "))
      .toMatch(/accountability/i);
    expect(catalog.get("kickoff.d12.first_specific_commitment")?.excludedInterpretations.join(" "))
      .toMatch(/booked next call/i);
    expect(catalog.get("kickoff.d11.structured_recap")?.requirements.map((item) => item.id))
      .toEqual(["closing_recap", "multiple_substantive_topics"]);
    expect(catalog.get("kickoff.d11.structured_recap")?.excludedInterpretations.join(" "))
      .toMatch(/commitments only/i);

    const coaching = new Map(
      getCriterionCatalog("coaching").map((criterion) => [criterion.id, criterion]),
    );
    expect(coaching.get("coaching.d03.explicit_twelve_month_vision")?.requirements.map((item) => item.id))
      .toEqual(["named_twelve_month_vision", "current_block_connected"]);
    expect(coaching.get("coaching.d10.client_books_live")?.excludedInterpretations.join(" "))
      .toMatch(/promises to book after the call/i);
    expect(coaching.get("coaching.d01.adjusts_approach")?.requirements.map((item) => item.id))
      .toEqual(["opening_state_identified", "call_approach_changed", "causal_link_explicit"]);
    expect(coaching.get("coaching.d05.long_game_link")?.requirements.map((item) => item.id))
      .toContain("explicit_adjustment_goal_link");
    expect(coaching.get("coaching.d06.weekly_theme_in_client_words")?.excludedInterpretations.join(" "))
      .toMatch(/list of commitments/i);
    expect(coaching.get("coaching.d08.full_circle_close")?.excludedInterpretations.join(" "))
      .toMatch(/generic end-of-call question/i);
    expect(coaching.get("coaching.d09.direction_reiterated")?.excludedInterpretations.join(" "))
      .toMatch(/tactical recap/i);
    expect(coaching.get("coaching.d12.applicable_sections_covered")?.requirements.map((item) => item.id))
      .toContain("live_booking");
    expect(coaching.get("coaching.d12.close_and_booking_not_rushed")?.requirements.map((item) => item.id))
      .toContain("live_booking_completed");
  });

  it("tells the extractor not to stitch unrelated moments into one supported criterion", () => {
    expect(EVIDENCE_SYSTEM_PROMPT).toContain("Do not combine");
    expect(EVIDENCE_SYSTEM_PROMPT).toContain("independent moments from different sections");
  });

  it("derives PARTIAL and removes positive credit when one required part is missing", () => {
    const facts = makeFacts();
    const preparation = facts.criteria.find(
      (criterion) => criterion.criterionId === "kickoff.d01.specific_goal_from_notes_early",
    )!;
    const sourceRequirement = preparation.requirementResults.find(
      (requirement) => requirement.requirementId === "pre_call_source_established",
    )!;
    sourceRequirement.status = "NOT_SUPPORTED";
    sourceRequirement.evidenceLineNumbers = [];

    const evidence = verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT));
    expect(evidence.criteria.find((criterion) => criterion.criterionId === preparation.criterionId))
      .toMatchObject({
        supportVerdict: "PARTIAL",
        state: "UNCLEAR",
        evidenceLineNumbers: [],
      });
  });

  it("retains direct contradictions as negative evidence without awarding credit", () => {
    const facts = makeFacts();
    const confidence = facts.criteria.find(
      (criterion) => criterion.criterionId === "kickoff.d11.confidence_anchor",
    )!;
    confidence.requirementResults[0]!.status = "CONTRADICTED";
    confidence.requirementResults[0]!.evidenceLineNumbers = [11];

    const evidence = verifyEvidenceLedger("kickoff", facts, parseTranscript(SIMPLE_TRANSCRIPT));
    const verified = evidence.criteria.find(
      (criterion) => criterion.criterionId === confidence.criterionId,
    );
    expect(verified).toMatchObject({ supportVerdict: "NOT_SUPPORTED", state: "ABSENT" });
    expect(evidence.dimensions[10]?.negativeEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lineNumbers: [11] }),
      ]),
    );
  });
});
