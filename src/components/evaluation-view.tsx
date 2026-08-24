"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicEvaluation } from "@/lib/evaluation/public-report";

const PROCESSING_STAGES = [
  "queued",
  "extracting_evidence",
  "scoring",
  "validating",
  "synthesizing",
] as const;

const STAGE_LABELS: Record<PublicEvaluation["currentStage"], string> = {
  queued: "Queued",
  extracting_evidence: "Verifying evidence",
  scoring: "Applying the rubric",
  validating: "Checking scores and caps",
  synthesizing: "Writing the client report",
  completed: "Report complete",
  failed: "Evaluation failed",
};

export function EvaluationView({ initialEvaluation }: { initialEvaluation: PublicEvaluation }) {
  const [evaluation, setEvaluation] = useState(initialEvaluation);
  const [pollingStopped, setPollingStopped] = useState(false);

  useEffect(() => {
    if (evaluation.status === "completed" || evaluation.status === "failed") return;
    let cancelled = false;
    let polls = 0;
    const timer = window.setInterval(async () => {
      polls += 1;
      if (polls >= 360) {
        window.clearInterval(timer);
        if (!cancelled) setPollingStopped(true);
        return;
      }
      try {
        const response = await fetch(`/api/evaluations/${evaluation.id}`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const next = (await response.json()) as PublicEvaluation;
        setEvaluation(next);
        if (next.status === "completed" || next.status === "failed") window.clearInterval(timer);
      } catch {
        // A transient polling failure must not change durable evaluation state.
      }
    }, 2_500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [evaluation.id, evaluation.status]);

  if (evaluation.status === "completed") return <CompletedReport evaluation={evaluation} />;
  if (evaluation.status === "failed") return <FailureState evaluation={evaluation} />;
  return <ProcessingState evaluation={evaluation} pollingStopped={pollingStopped} />;
}

function ReportHeader({ evaluation }: { evaluation: PublicEvaluation }) {
  return (
    <header className="report-topbar">
      <Link href="/" className="brand" aria-label="Signal Review home">
        <span className="brand-mark">S</span>
        <span>Signal Review</span>
      </Link>
      <div className="report-id">Report {evaluation.id.slice(0, 8).toUpperCase()}</div>
    </header>
  );
}

function ProcessingState({
  evaluation,
  pollingStopped,
}: {
  evaluation: PublicEvaluation;
  pollingStopped: boolean;
}) {
  const activeIndex = PROCESSING_STAGES.indexOf(
    evaluation.currentStage as (typeof PROCESSING_STAGES)[number],
  );
  return (
    <main className="report-shell">
      <ReportHeader evaluation={evaluation} />
      <section className="status-card" aria-live="polite">
        <div className="status-icon" aria-hidden="true">↗</div>
        <div className="eyebrow">Evaluation in progress</div>
        <h1>{STAGE_LABELS[evaluation.currentStage]}</h1>
        <p>
          This report is stored durably. You can close this tab and return to the same URL at any
          time.
        </p>
        <ol className="progress-list">
          {PROCESSING_STAGES.map((stage, index) => (
            <li key={stage} className={index <= activeIndex ? "done" : ""}>
              <span>{index < activeIndex ? "✓" : index + 1}</span>
              {STAGE_LABELS[stage]}
            </li>
          ))}
        </ol>
        {pollingStopped ? (
          <div className="status-note">
            Automatic updates paused after 15 minutes. The workflow is still durable; refresh this
            page later to read the latest state.
          </div>
        ) : (
          <div className="status-note">This page checks for a durable status update every few seconds.</div>
        )}
      </section>
    </main>
  );
}

function FailureState({ evaluation }: { evaluation: PublicEvaluation }) {
  return (
    <main className="report-shell">
      <ReportHeader evaluation={evaluation} />
      <section className="status-card failure" role="alert">
        <div className="status-icon" aria-hidden="true">!</div>
        <div className="eyebrow">Evaluation stopped safely</div>
        <h1>We couldn’t complete this report.</h1>
        <p>{evaluation.errorMessage ?? "The evaluation failed without publishing a partial report."}</p>
        <div className="error-code">Reference: {evaluation.errorCode ?? "INTERNAL_ERROR"}</div>
        <Link href="/" className="secondary-button">Start another evaluation</Link>
      </section>
    </main>
  );
}

function CompletedReport({ evaluation }: { evaluation: PublicEvaluation }) {
  const date = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(evaluation.completedAt ?? evaluation.createdAt));
  const oneThing = evaluation.oneThing;

  return (
    <main className="report-shell completed-shell">
      <ReportHeader evaluation={evaluation} />
      <section className="report-heading">
        <div>
          <div className="eyebrow">{evaluation.callType === "kickoff" ? "Kick-off" : "Coaching"} call · {date}</div>
          <h1>Call quality review</h1>
          <p>Verified against the complete transcript and authoritative client rubric.</p>
        </div>
        <a className="primary-button download-button" href={`/api/evaluations/${evaluation.id}/pdf`}>
          Download PDF <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section className="score-grid">
        <div className="score-card">
          <div className="score-ring">
            <strong>{formatScore(evaluation.finalScore)}</strong>
            <span>/ 100</span>
          </div>
          <div>
            <span className={`grade-pill grade-${evaluation.grade?.toLowerCase().replace(" ", "-")}`}>
              {evaluation.grade}
            </span>
            <p>
              Raw {formatScore(evaluation.rawScore)} / {formatScore(evaluation.maxPossibleScore)} · normalized {formatScore(evaluation.normalizedScore)}
            </p>
          </div>
        </div>
        <div className="one-thing-card">
          <div className="eyebrow">The one thing</div>
          <h2>{oneThing && "headline" in oneThing ? oneThing.headline : oneThing?.dimensionName}</h2>
          <p>{oneThing && "explanation" in oneThing ? oneThing.explanation : ""}</p>
          {oneThing ? (
            <div className="counterfactual">
              <span>{formatScore(oneThing.currentFinalTotal)}</span>
              <span aria-hidden="true">→</span>
              <strong>{formatScore(oneThing.counterfactualFinalTotal)}</strong>
              <small>+{formatScore(oneThing.improvement)} points</small>
            </div>
          ) : null}
        </div>
      </section>

      {evaluation.appliedCaps.length > 0 ? (
        <section className="caps-panel" aria-label="Applied score caps">
          <div>
            <strong>Automatic rubric caps applied</strong>
            <p>These limits were triggered from verified call facts and enforced in code.</p>
          </div>
          <div className="cap-list">
            {evaluation.appliedCaps.map((cap) => <span key={cap.id}>{cap.label}</span>)}
          </div>
        </section>
      ) : null}

      <section className="narrative-grid">
        <article className="brief-card">
          <div className="section-number">01</div>
          <div className="eyebrow">Coach brief</div>
          <h2>How the call landed</h2>
          <p>{evaluation.brief}</p>
        </article>
        <article className="red-flags-card">
          <div className="section-number">02</div>
          <div className="eyebrow">Client risk</div>
          <h2>Red flags</h2>
          {evaluation.redFlags.length === 0 ? (
            <p className="empty-state">No material retention red flags were supported by verified evidence.</p>
          ) : (
            <div className="red-flag-list">
              {evaluation.redFlags.map((flag, index) => (
                <div className="red-flag" key={`${flag.title}-${index}`}>
                  <span className={`severity severity-${flag.severity}`}>{flag.severity}</span>
                  <strong>{flag.title}</strong>
                  <p>{flag.explanation}</p>
                  <small>Evidence: {flag.evidenceLineNumbers.map((line) => `L${line}`).join(", ")}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="dimensions-section">
        <div className="dimensions-heading">
          <div>
            <div className="eyebrow">03 · Scorecard</div>
            <h2>Twelve dimensions</h2>
          </div>
          <p>Open a dimension to inspect its rationale, canonical evidence, gaps, and quickest route to full marks.</p>
        </div>
        <div className="dimension-list">
          {evaluation.dimensions.map((dimension) => (
            <details className="dimension-card" key={dimension.dimensionId}>
              <summary>
                <span className="dimension-index">D{String(dimension.dimensionId).padStart(2, "0")}</span>
                <span className="dimension-name">
                  <strong>{dimension.name}</strong>
                  <small>{dimension.disabled ? dimension.disabledReason : dimension.band}</small>
                </span>
                <span className="dimension-score">
                  {dimension.disabled ? "N/A" : `${formatScore(dimension.score)} / ${formatScore(dimension.rubricMaxScore)}`}
                </span>
                <span className="summary-plus" aria-hidden="true">+</span>
              </summary>
              <div className="dimension-body">
                {dimension.effectiveMaxScore !== dimension.rubricMaxScore && !dimension.disabled ? (
                  <div className="weight-note">Effective redistributed weight: {formatScore(dimension.effectiveMaxScore)} points</div>
                ) : null}
                <div className="dimension-copy">
                  <h3>Why this score</h3>
                  <p>{dimension.reasoning}</p>
                </div>
                <div className="dimension-copy">
                  <h3>Verified evidence</h3>
                  {dimension.evidence.length === 0 ? (
                    <p className="empty-state">No supporting transcript evidence was verified.</p>
                  ) : (
                    <blockquote className="evidence-block">
                      {dimension.evidence.map((line) => (
                        <p key={line.lineNumber}>
                          <span>L{line.lineNumber}</span>
                          <strong>{line.speaker}</strong>
                          {line.text}
                        </p>
                      ))}
                    </blockquote>
                  )}
                </div>
                <div className="dimension-split">
                  <div className="dimension-copy">
                    <h3>Missing behaviours</h3>
                    {dimension.missingBehaviours.length === 0 ? (
                      <p className="empty-state">No rubric behaviour was explicitly missing.</p>
                    ) : (
                      <ul>{dimension.missingBehaviours.map((item) => <li key={item}>{item}</li>)}</ul>
                    )}
                  </div>
                  <div className="quick-fix">
                    <span>Quick fix</span>
                    <p>{dimension.quickFix}</p>
                    <small>Maximum lift if all dimension gaps are fixed: +{formatScore(dimension.improvementPotential)}</small>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>
      <footer className="report-footer">
        <span>Signal Review · Evidence-grounded evaluation</span>
        <span>Report {evaluation.id}</span>
      </footer>
    </main>
  );
}

function formatScore(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
