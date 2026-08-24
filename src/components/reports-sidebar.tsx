import Link from "next/link";
import type { EvaluationSummary } from "@/lib/evaluation/types";
import type { EvaluationStatus } from "@/schemas/evaluation";

export const REPORT_STAGE_LABELS: Record<EvaluationStatus, string> = {
  queued: "Queued",
  extracting_evidence: "Verifying evidence",
  scoring: "Applying the rubric",
  validating: "Checking scores and caps",
  synthesizing: "Writing the client report",
  completed: "Report complete",
  failed: "Evaluation failed",
};

export function ReportsSidebar({
  reports,
  activeReportId,
}: {
  reports: EvaluationSummary[];
  activeReportId: string | null;
}) {
  const newEvaluationActive = activeReportId === null;

  return (
    <aside className="reports-sidebar" aria-label="Report navigation">
      <div className="reports-sidebar-top">
        <Link href="/" className="brand" aria-label="Signal Review home">
          <span className="brand-mark">S</span>
          <span>Signal Review</span>
        </Link>
        <Link
          href="/"
          className={`new-evaluation-link${newEvaluationActive ? " active" : ""}`}
          aria-current={newEvaluationActive ? "page" : undefined}
        >
          <span aria-hidden="true">+</span>
          New
        </Link>
      </div>
      <div className="reports-nav-heading">
        <span>Reports</span>
        <small>{reports.length}</small>
      </div>
      <nav className="reports-nav" aria-label="Evaluations">
        <ul className="reports-list">
          {reports.map((report) => {
            const active = report.id === activeReportId;
            const statusLabel = REPORT_STAGE_LABELS[report.currentStage];
            return (
              <li key={report.id}>
                <Link
                  href={`/evaluations/${report.id}`}
                  className={`report-nav-item${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="report-nav-meta">
                    <span className={`report-status-dot status-${report.status}`} aria-hidden="true" />
                    {report.callType === "kickoff" ? "Kick-off call" : "Coaching call"}
                  </span>
                  <strong>
                    {report.status === "completed"
                      ? `${formatScore(report.finalScore)} / 100`
                      : statusLabel}
                  </strong>
                  <span className="report-nav-detail">
                    {formatReportDate(report.createdAt)} · {report.id.slice(0, 8).toUpperCase()}
                  </span>
                  {report.grade ? <span className="report-nav-grade">{report.grade}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="reports-sidebar-note">
        Report navigation contains metadata only. Transcript content stays server-side.
      </p>
    </aside>
  );
}

function formatScore(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
