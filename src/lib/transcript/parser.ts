import { AppError } from "@/lib/errors/app-error";
import type { ParsedTranscript, TranscriptTurn } from "@/lib/evaluation/types";

export const MAX_TRANSCRIPT_CHARACTERS = 100_000;
const MIN_TRANSCRIPT_TURNS = 4;
const TURN_PATTERN = /^\[([^\]\r\n]+)\]:\s*(.+)$/u;

export function parseTranscript(originalTranscript: string): ParsedTranscript {
  if (originalTranscript.length > MAX_TRANSCRIPT_CHARACTERS) {
    throw new AppError("TRANSCRIPT_TOO_LARGE");
  }

  const normalizedTranscript = originalTranscript
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n");

  if (normalizedTranscript.length === 0) {
    throw new AppError("INVALID_INPUT", { message: "Transcript is empty." });
  }

  const turns: TranscriptTurn[] = normalizedTranscript.split("\n").map((line, index) => {
    const match = TURN_PATTERN.exec(line);
    if (!match) {
      throw new AppError("TRANSCRIPT_FORMAT_INVALID", {
        details: { sourceLine: index + 1 },
      });
    }

    const speaker = match[1]?.trim();
    const text = match[2]?.trim();
    if (!speaker || !text) {
      throw new AppError("TRANSCRIPT_FORMAT_INVALID", {
        details: { sourceLine: index + 1 },
      });
    }

    return {
      lineNumber: index + 1,
      speaker,
      text,
      canonicalLine: `[${speaker}]: ${text}`,
    };
  });

  const speakerCount = new Set(turns.map((turn) => turn.speaker)).size;
  if (turns.length < MIN_TRANSCRIPT_TURNS || speakerCount < 2) {
    throw new AppError("TRANSCRIPT_FORMAT_INVALID", {
      details: { turnCount: turns.length, speakerCount },
    });
  }

  return {
    originalTranscript,
    normalizedTranscript: turns.map((turn) => turn.canonicalLine).join("\n"),
    numberedTranscript: turns
      .map((turn) => `L${turn.lineNumber} ${turn.canonicalLine}`)
      .join("\n"),
    turns,
  };
}

export function speakingPercentage(turns: TranscriptTurn[], speaker: string): number {
  const counts = turns.reduce(
    (accumulator, turn) => {
      const count = turn.text.replace(/\s/gu, "").length;
      accumulator.total += count;
      if (turn.speaker === speaker) {
        accumulator.speaker += count;
      }
      return accumulator;
    },
    { speaker: 0, total: 0 },
  );

  return counts.total === 0 ? 0 : Math.round((counts.speaker / counts.total) * 1_000) / 10;
}
