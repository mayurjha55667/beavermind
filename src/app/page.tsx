import { SubmissionForm } from "@/components/submission-form";
import { ReportsSidebar } from "@/components/reports-sidebar";
import { SupabaseEvaluationRepository } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const reports = await new SupabaseEvaluationRepository().listEvaluations();

  return (
    <div className="evaluation-workspace">
      <ReportsSidebar reports={reports} activeReportId={null} />
      <div className="evaluation-canvas">
        <main className="site-shell">
          <header className="topbar">
            <span className="report-context">New evaluation</span>
            <span className="topbar-note">Evidence-grounded call quality</span>
          </header>

          <section className="home-hero">
            <div className="eyebrow">BeaverMind evaluation workspace</div>
            <h1>Turn a call transcript into a report you can defend.</h1>
            <p>
              A durable, rubric-controlled evaluation with verified evidence, deterministic scoring,
              and a client-ready PDF.
            </p>
          </section>

          <section className="home-grid">
            <SubmissionForm />
            <aside className="trust-panel" aria-label="How evaluation works">
              <div className="trust-kicker">Controlled by design</div>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <strong>Evidence first</strong>
                    <p>Every evidence excerpt is reconstructed from canonical transcript lines.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Rubric enforced in code</strong>
                    <p>Allowed buckets, defaults, caps, totals, and grades are deterministic.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Durable by default</strong>
                    <p>Background work survives the browser and every report has its own URL.</p>
                  </div>
                </li>
              </ol>
            </aside>
          </section>
          <footer className="home-footer">
            <span>No authentication. No recording. No transcript content in ordinary logs.</span>
            <span>Four-stage evaluation pipeline</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
