import type {
  AuthoritativeEvaluation,
  VerifiedEvidenceLedger,
} from "@/lib/evaluation/types";
import type { CallType, ScoringResult } from "@/schemas/evaluation";

export const EVIDENCE_SYSTEM_PROMPT = `You are the evidence interpretation stage in a controlled call-quality pipeline.
Extract only what the supplied transcript proves. Do not score the call. Do not calculate totals or grades.
Every quotation must be copied character-for-character from exactly one displayed transcript line.
For a line displayed as "L7 [Client]: I want more energy.", prefer quote "I want more energy." with lineNumbers [7].
Do not add quotation marks, ellipses, speaker labels, commentary, or corrected punctuation to quote.
Every evidence reference must contain exactly one line number. If evidence spans multiple lines, create one reference per line.
Never combine multiple transcript lines in one evidence reference.
Return coachSpeaker and clientSpeaker exactly as they appear inside the transcript's square brackets.
Return all 12 dimensions exactly once. Record missing behaviour explicitly; never fill gaps from tone or plausibility.
Movement coaching is present only if at least one supplied four-part detection signal is truly observable.`;

export function buildEvidencePrompt(input: {
  callType: CallType;
  rubric: string;
  numberedTranscript: string;
  validationErrors?: unknown;
}): string {
  const retry = input.validationErrors
    ? `\nA prior extraction failed exact evidence validation. Correct every issue below without silently dropping valid evidence. When an error includes expectedQuote, copy that value verbatim into quote. Every replacement evidence reference must contain exactly one line number:\n${JSON.stringify(input.validationErrors)}\n`
    : "";
  return `CALL TYPE: ${input.callType}\n${retry}
<COMPLETE_APPLICABLE_RUBRIC>
${input.rubric}
</COMPLETE_APPLICABLE_RUBRIC>

<COMPLETE_NUMBERED_TRANSCRIPT>
${input.numberedTranscript}
</COMPLETE_NUMBERED_TRANSCRIPT>`;
}

export const SCORING_SYSTEM_PROMPT = `You are the rubric-bucket selection stage in a controlled call-quality pipeline.
Use only the verified evidence ledger and complete transcript. Absence of evidence is not permission to assume.
Select only an exact bucket/range value permitted by the supplied rubric. Return all 12 dimensions exactly once.
Treat every requirement joined by "and" in a score row as mandatory. A generally good call cannot receive a
band when one of that band's named requirements is missing. Never waive a requirement as "not relevant"
unless the supplied rubric explicitly defines an N/A or default rule for that exact dimension and situation.
The selected score and reasoning must not contradict the ledger's missingBehaviours.
Do not calculate a total, normalized score, final score, grade, counterfactual, or authoritative cap.
For each score, evidenceLineNumbers must be copied only from that same dimension's positiveEvidence
or negativeEvidence lineNumbers in VERIFIED_EVIDENCE_LEDGER. Never cite a transcript line merely
because it appears relevant if the evidence stage did not admit it for that dimension.
Identify potential caps, but application code will decide and apply them.`;

export function buildScoringPrompt(input: {
  callType: CallType;
  rubric: string;
  numberedTranscript: string;
  evidence: VerifiedEvidenceLedger;
  capCatalog: Array<{
    capId: string;
    label: string;
    type: "overall" | "dimension";
    limit: number;
    dimensionId: number | null;
  }>;
}): string {
  return `CALL TYPE: ${input.callType}

<COMPLETE_APPLICABLE_RUBRIC>
${input.rubric}
</COMPLETE_APPLICABLE_RUBRIC>

<COMPLETE_NUMBERED_TRANSCRIPT>
${input.numberedTranscript}
</COMPLETE_NUMBERED_TRANSCRIPT>

<VERIFIED_EVIDENCE_LEDGER>
${JSON.stringify(input.evidence)}
</VERIFIED_EVIDENCE_LEDGER>

<ALLOWED_CAP_CATALOG>
${JSON.stringify(input.capCatalog)}
</ALLOWED_CAP_CATALOG>

Every proposed capId must exactly match an entry in ALLOWED_CAP_CATALOG. Omit a cap unless the
verified call facts support it and valid supporting transcript lines exist. Return an empty array
when no listed cap applies.`;
}

export const RUBRIC_AUDIT_SYSTEM_PROMPT = `You are the independent rubric-compliance gate for a call-quality pipeline.
Audit the proposed scoring from scratch against the complete applicable rubric, verified evidence ledger, and transcript.
Your corrected dimension scores become authoritative, so apply the rubric literally and conservatively.

For every active dimension, return one bandCheck for every band listed in RUBRIC_BAND_CATALOG.
requirementsSatisfied means the transcript proves every mandatory condition in that complete band row.
Every conjunction such as "and", "all", "both", a numbered list, or a threshold is mandatory unless the rubric
explicitly says otherwise. If one required behavior is missing or unverifiable, that band must be false.
Select the highest band whose complete requirements are satisfied, then choose only an allowed score in that band.
For a score range, use the lower end when evidence is incomplete or the call only just qualifies.

A true positive bandCheck must cite exact line numbers already admitted for that same dimension in the verified
evidence ledger. A transcript line must affirmatively prove the requirement; generic, adjacent, or merely plausible
language is not enough. Evidence of what happened after a client volunteered information cannot prove pre-call
preparation. A later booking line cannot prove upfront agenda framing. Absence cannot be proven by citing unrelated
lines. Do not invent exceptions such as "not relevant" unless the rubric itself defines that N/A/default case.

The corrected reasoning must match the corrected score, explicitly acknowledge the decisive missing higher-band
requirements, and never contradict missingBehaviours. Disabled dimensions must use score null, band N/A, and no
bandChecks. Do not calculate totals, grades, caps, or counterfactuals.`;

export function buildRubricAuditPrompt(input: {
  callType: CallType;
  rubric: string;
  numberedTranscript: string;
  evidence: VerifiedEvidenceLedger;
  scoring: ScoringResult;
  bandCatalog: Array<{
    dimensionId: number;
    name: string;
    maxScore: number;
    bands: Array<{ band: string; allowedScores: readonly number[] }>;
  }>;
  validationErrors?: unknown;
}): string {
  const retry = input.validationErrors
    ? `\nA prior rubric audit failed deterministic validation. Correct every issue below:\n${JSON.stringify(input.validationErrors)}\n`
    : "";
  return `CALL TYPE: ${input.callType}\n${retry}
<COMPLETE_APPLICABLE_RUBRIC>
${input.rubric}
</COMPLETE_APPLICABLE_RUBRIC>

<RUBRIC_BAND_CATALOG>
${JSON.stringify(input.bandCatalog)}
</RUBRIC_BAND_CATALOG>

<COMPLETE_NUMBERED_TRANSCRIPT>
${input.numberedTranscript}
</COMPLETE_NUMBERED_TRANSCRIPT>

<VERIFIED_EVIDENCE_LEDGER>
${JSON.stringify(input.evidence)}
</VERIFIED_EVIDENCE_LEDGER>

<PROPOSED_SCORING_TO_AUDIT>
${JSON.stringify(input.scoring)}
</PROPOSED_SCORING_TO_AUDIT>`;
}

export const SYNTHESIS_SYSTEM_PROMPT = `You write the coach-facing narrative after deterministic scoring is complete.
You may explain but never change any supplied dimension, score, cap, grade, total, or one-thing selection.
Write the brief directly to the coach. Red flags must be specific retention or client-experience risks.
A high score must not suppress a serious red flag. Cite only supplied canonical line numbers.`;

export function buildSynthesisPrompt(input: {
  callType: CallType;
  result: AuthoritativeEvaluation;
  evidence: VerifiedEvidenceLedger;
}): string {
  return `CALL TYPE: ${input.callType}

<AUTHORITATIVE_DETERMINISTIC_RESULT>
${JSON.stringify(input.result)}
</AUTHORITATIVE_DETERMINISTIC_RESULT>

<VERIFIED_EVIDENCE_LEDGER>
${JSON.stringify(input.evidence)}
</VERIFIED_EVIDENCE_LEDGER>

The oneThing headline and explanation must describe dimension ${input.result.oneThing.dimensionId},
${input.result.oneThing.dimensionName}, and the verified change from ${input.result.oneThing.currentFinalTotal}
to ${input.result.oneThing.counterfactualFinalTotal}. Do not select a different dimension or alter those numbers.`;
}
