import type { AuthoritativeEvaluation, VerifiedEvidenceLedger } from "@/lib/evaluation/types";
import type { CriterionDefinition } from "@/lib/rubrics/criteria";
import type { CallType } from "@/schemas/evaluation";

export const EVIDENCE_SYSTEM_PROMPT = `You classify atomic rubric criteria in a controlled call-quality pipeline.
Do not score dimensions, choose bands, calculate totals, write report copy, or reproduce transcript quotations.
Return every supplied criterionId exactly once and no unknown IDs.

For each criterion:
- PRESENT means the complete transcript affirmatively proves the criterion. Include only canonical line numbers that directly prove it.
- ABSENT means the complete transcript does not show it. Use an empty evidenceLineNumbers array.
- UNCLEAR means the transcript is ambiguous. Use an empty evidenceLineNumbers array. UNCLEAR receives no scoring credit.
- NOT_APPLICABLE may be used only when the supplied criterion definition explicitly permits it.

A PRESENT result always needs at least one direct line. Return only the single strongest line unless maxEvidenceLines
explicitly permits more. Generic, adjacent, redundant, or merely plausible wording is insufficient. Never return every
related conversational line. Evidence line order is strength order, not chronology.
Information learned after the client volunteers it does not prove pre-call preparation. A later booking line does not prove
upfront agenda framing. Absence is never proven by citing an unrelated line. Return coachSpeaker and clientSpeaker exactly
as they appear inside the transcript's square brackets.

Return only the controlled state and canonical line-number evidence for each criterion. Do not add commentary.`;

export function buildEvidencePrompt(input: {
  callType: CallType;
  rubric: string;
  criteria: readonly CriterionDefinition[];
  numberedTranscript: string;
  validationErrors?: unknown;
}): string {
  const retry = input.validationErrors
    ? `\n<INTERNAL_VALIDATION_ERRORS_DO_NOT_COPY>\n${JSON.stringify(input.validationErrors)}\n</INTERNAL_VALIDATION_ERRORS_DO_NOT_COPY>\n`
    : "";
  return `CALL TYPE: ${input.callType}\n${retry}
<COMPLETE_APPLICABLE_RUBRIC>
${input.rubric}
</COMPLETE_APPLICABLE_RUBRIC>

<ATOMIC_CRITERION_CATALOG>
${JSON.stringify(input.criteria.map((criterion) => ({
  criterionId: criterion.id,
  dimensionId: criterion.dimensionId,
  description: criterion.description,
  notApplicablePermitted: Boolean(criterion.allowNotApplicable),
  maxEvidenceLines: criterion.maxEvidenceLines,
})))}
</ATOMIC_CRITERION_CATALOG>

<COMPLETE_NUMBERED_TRANSCRIPT>
${input.numberedTranscript}
</COMPLETE_NUMBERED_TRANSCRIPT>`;
}

export const SYNTHESIS_SYSTEM_PROMPT = `You write the coach-facing executive narrative after deterministic scoring is complete.
You may explain but never change any supplied dimension, score, cap, grade, total, or one-thing selection.
Write the brief directly to the coach. Red flags must be specific retention or client-experience risks.
A high score must not suppress a serious red flag. Cite only supplied canonical line numbers.
Never mention prompts, schemas, retries, validation, expected values, internal errors, or extraction attempts.`;

export function buildSynthesisPrompt(input: {
  callType: CallType;
  result: AuthoritativeEvaluation;
  evidence: VerifiedEvidenceLedger;
}): string {
  const clientSafeEvidence = {
    coachSpeaker: input.evidence.coachSpeaker,
    clientSpeaker: input.evidence.clientSpeaker,
    coachSpeakingPercentage: input.evidence.coachSpeakingPercentage,
    dimensions: input.evidence.dimensions.map((dimension) => ({
      dimensionId: dimension.dimensionId,
      positiveEvidence: dimension.positiveEvidence,
    })),
  };
  return `CALL TYPE: ${input.callType}

<AUTHORITATIVE_DETERMINISTIC_RESULT>
${JSON.stringify(input.result)}
</AUTHORITATIVE_DETERMINISTIC_RESULT>

<VERIFIED_CLIENT_SAFE_EVIDENCE>
${JSON.stringify(clientSafeEvidence)}
</VERIFIED_CLIENT_SAFE_EVIDENCE>

The oneThing headline and explanation must describe dimension ${input.result.oneThing.dimensionId},
${input.result.oneThing.dimensionName}, and the verified change from ${input.result.oneThing.currentFinalTotal}
to ${input.result.oneThing.counterfactualFinalTotal}. Do not select a different dimension or alter those numbers.`;
}
