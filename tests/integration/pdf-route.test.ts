import { afterEach, describe, expect, it, vi } from "vitest";
import { runCompleteEvaluation } from "@/lib/evaluation/stages";
import type { CompletedEvaluation } from "@/lib/evaluation/types";
import {
  InMemoryRepository,
  QueueProvider,
  makeFacts,
  makeNarrative,
  makeRubricAudit,
  makeScoring,
} from "../helpers";

afterEach(() => {
  vi.doUnmock("@/lib/db/repository");
  vi.resetModules();
});

describe("completed PDF route", () => {
  it("returns a persistent PDF generated from completed report data", async () => {
    const repository = new InMemoryRepository();
    const provider = new QueueProvider({
      call_facts: [makeFacts()],
      rubric_scoring: [makeScoring("kickoff")],
      rubric_audit: [makeRubricAudit("kickoff")],
      report_narrative: [makeNarrative()],
    });
    await runCompleteEvaluation(repository.evaluation.id, { repository, provider });
    const completed = await repository.getCompletedEvaluation(repository.evaluation.id);
    expect(completed).not.toBeNull();

    vi.doMock("@/lib/db/repository", () => ({
      SupabaseEvaluationRepository: class {
        async getCompletedEvaluation(): Promise<CompletedEvaluation | null> {
          return completed;
        }
      },
    }));
    const { GET } = await import("@/app/api/evaluations/[id]/pdf/route");
    const response = await GET(new Request("http://localhost/pdf"), {
      params: Promise.resolve({ id: repository.evaluation.id }),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  }, 20_000);
});
