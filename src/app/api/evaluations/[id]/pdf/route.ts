import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SupabaseEvaluationRepository } from "@/lib/db/repository";
import { toAppError } from "@/lib/errors/app-error";
import { EvaluationPdf } from "@/lib/pdf/evaluation-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: { code: "EVALUATION_NOT_FOUND", message: "This evaluation could not be found." } },
      { status: 404 },
    );
  }

  try {
    const evaluation = await new SupabaseEvaluationRepository().getCompletedEvaluation(id);
    if (!evaluation) {
      return NextResponse.json(
        { error: { code: "REPORT_NOT_READY", message: "The PDF is available after the report completes." } },
        { status: 409 },
      );
    }
    const buffer = await renderToBuffer(EvaluationPdf({ evaluation }));
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="signal-review-${id.slice(0, 8)}.pdf"`,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(
      { error: { code: appError.code, message: appError.publicMessage } },
      { status: 500 },
    );
  }
}
