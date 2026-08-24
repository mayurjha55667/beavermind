import { AppError } from "@/lib/errors/app-error";
import type {
  ParsedTranscript,
  TranscriptTurn,
  VerifiedDimensionEvidence,
  VerifiedEvidenceLedger,
  VerifiedEvidenceReference,
} from "@/lib/evaluation/types";
import { speakingPercentage } from "@/lib/transcript/parser";
import type { CallFacts } from "@/schemas/evaluation";

export interface EvidenceValidationError {
  dimensionId: number;
  evidenceType: "positive" | "negative";
  evidenceIndex: number;
  message: string;
}

export function verifyEvidenceLedger(
  facts: CallFacts,
  transcript: ParsedTranscript,
): VerifiedEvidenceLedger {
  const errors: EvidenceValidationError[] = [];
  const speakers = new Set(transcript.turns.map((turn) => turn.speaker));

  if (!speakers.has(facts.coachSpeaker) || !speakers.has(facts.clientSpeaker)) {
    throw new AppError("EVIDENCE_VALIDATION_FAILED", {
      details: {
        message: "Identified coach or client speaker is not present in the transcript.",
        coachSpeaker: facts.coachSpeaker,
        clientSpeaker: facts.clientSpeaker,
      },
    });
  }

  const ids = facts.dimensions.map((dimension) => dimension.dimensionId).sort((a, b) => a - b);
  if (ids.some((id, index) => id !== index + 1)) {
    throw new AppError("EVIDENCE_VALIDATION_FAILED", {
      details: { message: "Dimension IDs must contain each value from 1 through 12 exactly once." },
    });
  }

  const dimensions: VerifiedDimensionEvidence[] = facts.dimensions.map((dimension) => ({
    dimensionId: dimension.dimensionId,
    positiveEvidence: dimension.positiveEvidence.flatMap((reference, evidenceIndex) => {
      const verified = verifyReference(reference, transcript.turns);
      if (verified.ok) {
        return [verified.value];
      }
      errors.push({
        dimensionId: dimension.dimensionId,
        evidenceType: "positive",
        evidenceIndex,
        message: verified.message,
      });
      return [];
    }),
    negativeEvidence: dimension.negativeEvidence.flatMap((reference, evidenceIndex) => {
      const verified = verifyReference(reference, transcript.turns);
      if (verified.ok) {
        return [verified.value];
      }
      errors.push({
        dimensionId: dimension.dimensionId,
        evidenceType: "negative",
        evidenceIndex,
        message: verified.message,
      });
      return [];
    }),
    missingBehaviours: dimension.missingBehaviours,
    evidenceSufficient: dimension.evidenceSufficient,
  }));

  if (errors.length > 0) {
    throw new AppError("EVIDENCE_VALIDATION_FAILED", { details: errors });
  }

  const movementCoachingPresent = Object.values(facts.movementSignals).some(Boolean);

  return {
    ...facts,
    coachSpeakingPercentage: speakingPercentage(transcript.turns, facts.coachSpeaker),
    movementCoachingPresent,
    dimensions,
  };
}

type ReferenceResult =
  | { ok: true; value: VerifiedEvidenceReference }
  | { ok: false; message: string };

function verifyReference(
  reference: CallFacts["dimensions"][number]["positiveEvidence"][number],
  turns: TranscriptTurn[],
): ReferenceResult {
  const lineNumbers = [...reference.lineNumbers];
  const unique = new Set(lineNumbers);
  if (unique.size !== lineNumbers.length) {
    return { ok: false, message: "Evidence line numbers must be unique." };
  }

  if (lineNumbers.some((line, index) => index > 0 && line !== lineNumbers[index - 1]! + 1)) {
    return { ok: false, message: "Multi-line evidence must reference contiguous ascending lines." };
  }

  const transcriptLines = lineNumbers.map((lineNumber) => turns[lineNumber - 1]);
  if (transcriptLines.some((turn) => turn === undefined)) {
    return { ok: false, message: "Evidence references a line that does not exist." };
  }

  const verifiedLines = transcriptLines.filter((turn): turn is TranscriptTurn => turn !== undefined);
  const candidates = [
    verifiedLines
      .map((turn) => "L" + turn.lineNumber + " " + turn.canonicalLine)
      .join("\n"),
    verifiedLines.map((turn) => turn.canonicalLine).join("\n"),
    verifiedLines.map((turn) => turn.text).join("\n"),
    verifiedLines.map((turn) => turn.text).join(" "),
  ];

  if (!candidates.some((candidate) => candidate.includes(reference.quote))) {
    return {
      ok: false,
      message: "Quote is not an exact substring of the referenced canonical transcript lines.",
    };
  }

  return {
    ok: true,
    value: {
      ...reference,
      transcriptLines: verifiedLines,
    },
  };
}

export function collectEvidenceLines(
  dimension: VerifiedDimensionEvidence,
  selectedLineNumbers: number[],
): TranscriptTurn[] {
  const allowed = new Map<number, TranscriptTurn>();
  for (const reference of [...dimension.positiveEvidence, ...dimension.negativeEvidence]) {
    for (const turn of reference.transcriptLines) {
      allowed.set(turn.lineNumber, turn);
    }
  }

  const requested = [...new Set(selectedLineNumbers)].sort((a, b) => a - b);
  const invalid = requested.filter((lineNumber) => !allowed.has(lineNumber));
  if (invalid.length > 0) {
    throw new AppError("SCORING_VALIDATION_FAILED", {
      details: {
        dimensionId: dimension.dimensionId,
        message: "Scoring cited lines outside the verified evidence ledger.",
        invalid,
      },
    });
  }

  return requested.flatMap((lineNumber) => {
    const turn = allowed.get(lineNumber);
    return turn ? [turn] : [];
  });
}
