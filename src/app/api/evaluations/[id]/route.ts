import { NextResponse } from "next/server";
import { z } from "zod";
import { SupabaseEvaluationRepository } from "@/lib/db/repository";
import { toPublicEvaluation } from "@/lib/evaluation/public-report";
import { toAppError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const params = await context.params;
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json(
      { error: { code: "EVALUATION_NOT_FOUND", message: "This evaluation could not be found." } },
      { status: 404 },
    );
  }

  try {
    const repository = new SupabaseEvaluationRepository();
    const base = await repository.getEvaluation(params.id);
    if (!base) {
      return NextResponse.json(
        { error: { code: "EVALUATION_NOT_FOUND", message: "This evaluation could not be found." } },
        { status: 404 },
      );
    }
    const evaluation =
      base.status === "completed" ? (await repository.getCompletedEvaluation(params.id)) ?? base : base;
    return NextResponse.json(toPublicEvaluation(evaluation), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(
      { error: { code: appError.code, message: appError.publicMessage } },
      { status: 500 },
    );
  }
}
