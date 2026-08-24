import type { AuthoritativeEvaluation, VerifiedEvidenceLedger } from "@/lib/evaluation/types";
import type { CriterionDefinition } from "@/lib/rubrics/criteria";
import type { CallType } from "@/schemas/evaluation";

export const EVIDENCE_SYSTEM_PROMPT = `You classify atomic rubric criteria in a controlled call-quality pipeline.
Do not score dimensions, choose bands, calculate totals, choose criterion verdicts, write report copy, or reproduce
transcript quotations. Return every supplied criterionId and every supplied requirementId exactly once and no unknown IDs.

Apply the strict-reviewer test to each requirement independently:
Imagine a skeptical human reviewer sees only the requirement and the cited evidence bundle. Mark SUPPORTED only when
those lines explicitly establish the complete requirement without material unstated context or charitable inference.
Related topics, nearby keywords, general tone, and overall impressions are not evidence.
All requirements within one criterion must describe the same behaviour or explicitly connected exchange. Do not combine
independent moments from different sections merely because one mentions the action and another mentions the goal, outcome,
or close. When the transcript does not explicitly connect those moments, mark the linking requirement NOT_SUPPORTED or
UNVERIFIABLE.

Requirement statuses:
- SUPPORTED: the smallest complete cited evidence bundle establishes the full requirement. At least one line is required,
  except when the user-supplied call context explicitly marks a contextual criterion as authoritative.
- NOT_SUPPORTED: the complete transcript does not establish the requirement and does not directly establish its opposite.
  Return no evidence lines.
- CONTRADICTED: cited lines directly establish the opposite of the requirement. Direct evidence lines are required.
- UNVERIFIABLE: related evidence exists, but a material fact such as source, timing, ownership, intent, or outcome cannot be
  established from the transcript. Cite only the limiting lines, if any.
- NOT_APPLICABLE: use only when the criterion explicitly permits it, and return no evidence lines.

Material assumptions:
- Report each material unstated assumption that would be necessary to upgrade a requirement to SUPPORTED.
- A requirement that depends on a material assumption must be UNVERIFIABLE or NOT_SUPPORTED, never SUPPORTED.
- Normal interpretation within a cited exchange, such as resolving a pronoun from the immediately preceding line, is not a
  material assumption. Inventing an external source, prior knowledge, motivation, timing, ownership, or outcome is.

Search for supporting, limiting, and contradictory evidence before assigning a status. Respect every supplied exclusion.
Information learned after the client volunteers it does not prove pre-call preparation. Safety advice does not by itself
normalize discomfort. An accountability preference does not by itself establish a learning style. A booked next call is not
a post-call deliverable. An immediate deadline is not a multi-week journey.

Use the smallest complete evidence bundle and never include adjacent filler or every related line. Do not exceed the
criterion's maxEvidenceLines across all requirement results. Return coachSpeaker and clientSpeaker exactly as they appear
inside the transcript's square brackets.

Return only controlled requirement statuses, canonical line-number evidence, and material assumptions. Do not add commentary.`;

export function buildEvidencePrompt(input: {
  callType: CallType;
  criteria: readonly CriterionDefinition[];
  numberedTranscript: string;
  diagnosticsApplicable?: boolean | null;
  validationErrors?: unknown;
}): string {
  const retry = input.validationErrors
    ? `\n<INTERNAL_VALIDATION_ERRORS_DO_NOT_COPY>\n${JSON.stringify(input.validationErrors)}\n</INTERNAL_VALIDATION_ERRORS_DO_NOT_COPY>\n`
    : "";
  const declaredCallContext = {
    diagnosticsApplicable: input.callType === "coaching"
      ? (input.diagnosticsApplicable ?? null)
      : null,
  };
  return `CALL TYPE: ${input.callType}\n${retry}
<DECLARED_CALL_CONTEXT>
${JSON.stringify(declaredCallContext)}
</DECLARED_CALL_CONTEXT>

When diagnosticsApplicable is true or false, it is authoritative user-supplied context. For
coaching.d02.diagnostics_applicable only, return every requirement as SUPPORTED with no transcript lines when true, or
NOT_APPLICABLE with no transcript lines when false. Do not infer or contradict this value from the transcript. A null value
means legacy context was not supplied, so apply the ordinary transcript-based rules.

<ATOMIC_REQUIREMENT_CATALOG>
${JSON.stringify(input.criteria.map((criterion) => ({
  criterionId: criterion.id,
  dimensionId: criterion.dimensionId,
  description: criterion.description,
  requirements: criterion.requirements.map((requirement) => ({
    requirementId: requirement.id,
    description: requirement.description,
  })),
  excludedInterpretations: criterion.excludedInterpretations,
  notApplicablePermitted: Boolean(criterion.allowNotApplicable),
  maxEvidenceLines: criterion.maxEvidenceLines,
})))}
</ATOMIC_REQUIREMENT_CATALOG>

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
      negativeEvidence: dimension.negativeEvidence,
    })),
  };
  const oneThingInstruction = input.result.oneThing.improvement === 0
    ? `The oneThing headline and explanation must use maintenance language for dimension ${input.result.oneThing.dimensionId},
${input.result.oneThing.dimensionName}. State that it is already at ${input.result.oneThing.currentScore}/${input.result.oneThing.fullScore}
and cannot increase the current final score of ${input.result.oneThing.currentFinalTotal}. Never call 0 points a change or an improvement.`
    : `The oneThing headline and explanation must describe dimension ${input.result.oneThing.dimensionId},
${input.result.oneThing.dimensionName}, and the verified change from ${input.result.oneThing.currentFinalTotal}
to ${input.result.oneThing.counterfactualFinalTotal}. Do not select a different dimension or alter those numbers.`;
  return `CALL TYPE: ${input.callType}

<AUTHORITATIVE_DETERMINISTIC_RESULT>
${JSON.stringify(input.result)}
</AUTHORITATIVE_DETERMINISTIC_RESULT>

<VERIFIED_CLIENT_SAFE_EVIDENCE>
${JSON.stringify(clientSafeEvidence)}
</VERIFIED_CLIENT_SAFE_EVIDENCE>

${oneThingInstruction}`;
}
