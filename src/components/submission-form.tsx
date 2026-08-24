"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CallType } from "@/schemas/evaluation";

const MAX_CHARACTERS = 100_000;

export function SubmissionForm() {
  const router = useRouter();
  const [callType, setCallType] = useState<CallType>("kickoff");
  const [diagnosticsApplicable, setDiagnosticsApplicable] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lineCount = useMemo(
    () => transcript.split(/\r?\n/u).filter((line) => line.trim().length > 0).length,
    [transcript],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          callType === "coaching"
            ? { callType, transcript, diagnosticsApplicable }
            : { callType, transcript },
        ),
      });
      const payload = (await response.json()) as {
        id?: string;
        evaluationId?: string;
        error?: { message?: string };
      };
      const evaluationId = payload.id ?? payload.evaluationId;
      if (!response.ok || !evaluationId) {
        throw new Error(payload.error?.message ?? "The evaluation could not be created.");
      }
      router.push(`/evaluations/${evaluationId}`);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The evaluation could not be created.",
      );
      setSubmitting(false);
    }
  }

  const invalid =
    submitting || transcript.trim().length === 0 || transcript.length > MAX_CHARACTERS;

  return (
    <form onSubmit={submit} className="submission-card">
      <fieldset className="space-y-3">
        <legend className="field-label">Call type</legend>
        <div className="segment" aria-label="Call type">
          {(["kickoff", "coaching"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={callType === value}
              onClick={() => setCallType(value)}
              className={callType === value ? "segment-button active" : "segment-button"}
            >
              {value === "kickoff" ? "Kick-off call" : "Coaching call"}
            </button>
          ))}
        </div>
      </fieldset>

      {callType === "coaching" ? (
        <fieldset className="space-y-3">
          <legend className="field-label">Diagnostics context</legend>
          <div className="segment" aria-label="Diagnostics context">
            <button
              type="button"
              aria-pressed={!diagnosticsApplicable}
              onClick={() => setDiagnosticsApplicable(false)}
              className={!diagnosticsApplicable ? "segment-button active" : "segment-button"}
            >
              Regular coaching call
            </button>
            <button
              type="button"
              aria-pressed={diagnosticsApplicable}
              onClick={() => setDiagnosticsApplicable(true)}
              className={diagnosticsApplicable ? "segment-button active" : "segment-button"}
            >
              Milestone or video review
            </button>
          </div>
          <p className="helper-text">
            Select the second option only when diagnostics are expected this cycle, such as weeks
            8, 16, or 24, or when a relevant movement video was submitted.
          </p>
        </fieldset>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <label htmlFor="transcript" className="field-label">Call transcript</label>
          <span className={transcript.length > MAX_CHARACTERS ? "counter error" : "counter"}>
            {lineCount.toLocaleString()} lines · {transcript.length.toLocaleString()} /{" "}
            {MAX_CHARACTERS.toLocaleString()} chars
          </span>
        </div>
        <textarea
          id="transcript"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder={"[Coach Name]: Thanks for joining today…\n[Client Name]: Glad to be here…"}
          className="transcript-input"
          spellCheck={false}
          aria-describedby="transcript-help"
          aria-invalid={Boolean(error) || transcript.length > MAX_CHARACTERS}
        />
        <p id="transcript-help" className="helper-text">
          One turn per line in <code>[Speaker]: text</code> format. The complete transcript stays
          together so evidence can be connected across the call.
        </p>
      </div>

      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <div className="submit-row">
        <p>
          You’ll receive a permanent report link immediately. Processing continues if this tab is
          closed.
        </p>
        <button type="submit" disabled={invalid} className="primary-button">
          {submitting ? "Creating report…" : "Evaluate call"}
        </button>
      </div>
    </form>
  );
}
