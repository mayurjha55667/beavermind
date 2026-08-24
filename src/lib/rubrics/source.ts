import { readFileSync } from "node:fs";
import type { CallType } from "@/schemas/evaluation";

const RUBRIC_FILES: Record<CallType, string> = {
  kickoff: "kickoff-call-rubric.md",
  coaching: "coaching-call-rubric.md",
};

export function getCompleteRubricText(callType: CallType): string {
  return readFileSync(new URL(`./source/${RUBRIC_FILES[callType]}`, import.meta.url), "utf8");
}
