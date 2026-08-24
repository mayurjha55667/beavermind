import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { SupabaseEvaluationRepository } from "@/lib/db/repository";
import { getServerEnvironment } from "@/lib/env";
import { AppError, safeDiagnostic, toAppError } from "@/lib/errors/app-error";
import { PROMPT_VERSION, getRubricConfig } from "@/lib/rubrics/config";
import { parseTranscript } from "@/lib/transcript/parser";
import { CreateEvaluationSchema } from "@/schemas/evaluation";
import { evaluateCallWorkflow } from "../../../../workflows/evaluate-call";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 120_000) return errorResponse(new AppError("TRANSCRIPT_TOO_LARGE"), 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(new AppError("INVALID_INPUT"), 400);
  }

  const parsedBody = CreateEvaluationSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Choose a call type and provide a transcript in [Speaker]: text format.",
          fields: parsedBody.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    const transcript = parseTranscript(parsedBody.data.transcript);
    const environment = getServerEnvironment();
    const repository = new SupabaseEvaluationRepository();
    const id = crypto.randomUUID();
    const rubric = getRubricConfig(parsedBody.data.callType);

    await repository.createEvaluation({
      id,
      callType: parsedBody.data.callType,
      originalTranscript: transcript.originalTranscript,
      numberedTranscript: transcript.numberedTranscript,
      rubricVersion: rubric.version,
      promptVersion: PROMPT_VERSION,
      modelProvider: environment.LLM_PROVIDER,
      modelName: environment.LLM_MODEL,
    });

    let workflowRunId: string;
    try {
      const run = await start(evaluateCallWorkflow, [id]);
      workflowRunId = run.runId;
    } catch (error) {
      const appError = new AppError("WORKFLOW_START_FAILED", { cause: error });
      await repository.markFailed(id, {
        code: appError.code,
        message: appError.publicMessage,
        diagnostic: safeDiagnostic(appError),
      });
      return errorResponse(appError, 503, { evaluationId: id });
    }
    try {
      await repository.setWorkflowRunId(id, workflowRunId);
    } catch {
      // The durable run is already queued. Missing observability metadata must not publish a false
      // failure or invite a duplicate workflow start.
      console.warn(JSON.stringify({ evaluationId: id, stage: "workflow_metadata", code: "DATABASE_FAILURE" }));
    }

    const reportUrl = `${environment.APP_BASE_URL.replace(/\/$/u, "")}/evaluations/${id}`;
    return NextResponse.json(
      { id, status: "queued", url: reportUrl },
      { status: 202, headers: { Location: reportUrl } },
    );
  } catch (error) {
    const appError = toAppError(error);
    const status =
      appError.code === "TRANSCRIPT_TOO_LARGE"
        ? 413
        : appError.code === "INVALID_INPUT" || appError.code === "TRANSCRIPT_FORMAT_INVALID"
          ? 400
          : 500;
    return errorResponse(appError, status);
  }
}

function errorResponse(
  error: AppError,
  status: number,
  extra: Record<string, unknown> = {},
): Response {
  return NextResponse.json(
    { error: { code: error.code, message: error.publicMessage }, ...extra },
    { status },
  );
}
