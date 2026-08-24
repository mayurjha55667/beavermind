import { notFound } from "next/navigation";
import { z } from "zod";
import { EvaluationView } from "@/components/evaluation-view";
import { SupabaseEvaluationRepository } from "@/lib/db/repository";
import { toPublicEvaluation } from "@/lib/evaluation/public-report";

export const dynamic = "force-dynamic";

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const repository = new SupabaseEvaluationRepository();
  const base = await repository.getEvaluation(id);
  if (!base) notFound();
  const evaluation =
    base.status === "completed" ? (await repository.getCompletedEvaluation(id)) ?? base : base;
  return <EvaluationView initialEvaluation={toPublicEvaluation(evaluation)} />;
}
