import type {
  AuthoritativeEvaluation,
  VerifiedEvidenceLedger,
} from "@/lib/evaluation/types";
import type { CallType } from "@/schemas/evaluation";

export const EVIDENCE_SYSTEM_PROMPT = `You are the evidence interpretation stage in a controlled call-quality pipeline.
Extract only what the supplied transcript proves. Do not score the call. Do not calculate totals or grades.
Every quotation must be copied character-for-character from one displayed transcript line or contiguous displayed transcript lines.
For a line displayed as "L7 [Client]: I want more energy.", prefer quote "I want more energy." with lineNumbers [7].
Do not add quotation marks, ellipses, speaker labels, commentary, or corrected punctuation to quote.
Never combine non-contiguous lines in one evidence reference; create separate references instead.
Line numbers are one-based, unique, and must be returned in ascending contiguous order for multi-line evidence.
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
    ? `\nA prior extraction failed exact evidence validation. Correct every issue below without silently dropping valid evidence. For quote mismatches, recopy the exact text from the referenced line. For non-contiguous line numbers, split them into separate evidence references:\n${JSON.stringify(input.validationErrors)}\n`
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
Do not calculate a total, normalized score, final score, grade, counterfactual, or authoritative cap.
For each score, cite only line numbers already present in that dimension's verified evidence ledger.
Identify potential caps, but application code will decide and apply them.`;

export function buildScoringPrompt(input: {
  callType: CallType;
  rubric: string;
  numberedTranscript: string;
  evidence: VerifiedEvidenceLedger;
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
</VERIFIED_EVIDENCE_LEDGER>`;
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
