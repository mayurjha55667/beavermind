import { AppError } from "@/lib/errors/app-error";
import type {
  ParsedTranscript,
  TranscriptTurn,
  VerifiedCriterionEvidence,
  VerifiedDimensionEvidence,
  VerifiedEvidenceLedger,
  VerifiedEvidenceReference,
} from "@/lib/evaluation/types";
import { getCriterionCatalog } from "@/lib/rubrics/criteria";
import { speakingPercentage } from "@/lib/transcript/parser";
import type {
  CallFacts,
  CallType,
  CriterionState,
  CriterionSupportVerdict,
  RequirementSupportStatus,
} from "@/schemas/evaluation";

export interface EvidenceValidationError {
  criterionId?: string;
  message: string;
  lineNumbers?: number[];
}

export function deriveCriterionSupport(
  statuses: readonly RequirementSupportStatus[],
  materialAssumptionCount: number,
): { supportVerdict: CriterionSupportVerdict; state: CriterionState } {
  if (statuses.length > 0 && statuses.every((status) => status === "NOT_APPLICABLE")) {
    return { supportVerdict: "NOT_APPLICABLE", state: "NOT_APPLICABLE" };
  }

  if (
    statuses.length > 0 &&
    statuses.every((status) => status === "SUPPORTED") &&
    materialAssumptionCount === 0
  ) {
    return { supportVerdict: "FULLY_SUPPORTED", state: "PRESENT" };
  }

  const partiallyEstablished =
    statuses.some((status) => status === "SUPPORTED" || status === "UNVERIFIABLE");
  if (partiallyEstablished) {
    return { supportVerdict: "PARTIAL", state: "UNCLEAR" };
  }

  return { supportVerdict: "NOT_SUPPORTED", state: "ABSENT" };
}

function criterionConsistencyErrors(
  callType: CallType,
  criterionMap: Map<string, VerifiedCriterionEvidence>,
): EvidenceValidationError[] {
  if (callType !== "kickoff") return [];

  const consistencyErrors: EvidenceValidationError[] = [];
  const present = (id: string): boolean => criterionMap.get(id)?.state === "PRESENT";

  if (
    present("kickoff.d06.north_star_link") &&
    !present("kickoff.d06.timeline_or_milestones")
  ) {
    consistencyErrors.push({
      criterionId: "kickoff.d06.north_star_link",
      message: "A North Star journey link cannot be PRESENT unless a program timeline, progression, or milestone is PRESENT.",
    });
  }

  const eventIds = [
    "kickoff.d12.first_specific_commitment",
    "kickoff.d12.second_distinct_commitment",
    "kickoff.d12.third_distinct_commitment",
  ] as const;

  if (present(eventIds[1]) && !present(eventIds[0])) {
    consistencyErrors.push({
      criterionId: eventIds[1],
      message: "A second commitment cannot be PRESENT unless the first distinct commitment is PRESENT.",
    });
  }
  if (present(eventIds[2]) && (!present(eventIds[0]) || !present(eventIds[1]))) {
    consistencyErrors.push({
      criterionId: eventIds[2],
      message: "A third commitment cannot be PRESENT unless the first and second distinct commitments are PRESENT.",
    });
  }

  const claimedEventLine = new Map<number, string>();
  for (const id of eventIds) {
    if (!present(id)) continue;
    const lineNumber = criterionMap.get(id)?.evidenceLineNumbers[0];
    if (lineNumber === undefined) continue;
    const prior = claimedEventLine.get(lineNumber);
    if (prior) {
      consistencyErrors.push({
        criterionId: id,
        message: `Distinct commitment events cannot reuse the same evidence line as ${prior}.`,
        lineNumbers: [lineNumber],
      });
    } else {
      claimedEventLine.set(lineNumber, id);
    }
  }

  const preciseAll = "kickoff.d12.precise_timing_all";
  const mostlyPrecise = "kickoff.d12.mostly_precise_timing";
  if (present(preciseAll) && present(mostlyPrecise)) {
    consistencyErrors.push({
      criterionId: mostlyPrecise,
      message: "Every commitment being precisely timed and only most commitments being precisely timed are mutually exclusive.",
    });
  }
  if ((present(preciseAll) || present(mostlyPrecise)) && !present(eventIds[0])) {
    consistencyErrors.push({
      criterionId: present(preciseAll) ? preciseAll : mostlyPrecise,
      message: "Commitment timing cannot be PRESENT when no specific future coach commitment is PRESENT.",
    });
  }
  if (present("kickoff.d12.vague_follow_up_only") && eventIds.some(present)) {
    consistencyErrors.push({
      criterionId: "kickoff.d12.vague_follow_up_only",
      message: "A vague-only follow-up cannot coexist with a specific future coach commitment.",
    });
  }

  return consistencyErrors;
}

export function verifyEvidenceLedger(
  callType: CallType,
  facts: CallFacts,
  transcript: ParsedTranscript,
): VerifiedEvidenceLedger {
  const speakers = new Set(transcript.turns.map((turn) => turn.speaker));
  if (!speakers.has(facts.coachSpeaker) || !speakers.has(facts.clientSpeaker)) {
    throw new AppError("EVIDENCE_VALIDATION_FAILED", {
      details: {
        message: "Identified coach or client speaker is not present in the transcript.",
        coachSpeaker: facts.coachSpeaker,
        clientSpeaker: facts.clientSpeaker,
      },
    });
  }

  const catalog = getCriterionCatalog(callType);
  const definitions = new Map(catalog.map((criterion) => [criterion.id, criterion]));
  const suppliedIds = facts.criteria.map((criterion) => criterion.criterionId);
  const suppliedSet = new Set(suppliedIds);
  const missing = catalog.filter((criterion) => !suppliedSet.has(criterion.id)).map((criterion) => criterion.id);
  const unknown = [...suppliedSet].filter((id) => !definitions.has(id));
  const duplicates = suppliedIds.filter((id, index) => suppliedIds.indexOf(id) !== index);
  if (missing.length > 0 || unknown.length > 0 || duplicates.length > 0) {
    throw new AppError("EVIDENCE_VALIDATION_FAILED", {
      details: {
        message: "Atomic criterion IDs must match the complete applicable catalog exactly once.",
        missing,
        unknown,
        duplicates: [...new Set(duplicates)],
      },
    });
  }

  const errors: EvidenceValidationError[] = [];
  const criteria: VerifiedCriterionEvidence[] = facts.criteria.flatMap((result) => {
    const definition = definitions.get(result.criterionId);
    if (!definition) return [];

    const expectedRequirementIds = definition.requirements.map((requirement) => requirement.id);
    const suppliedRequirementIds = result.requirementResults.map((requirement) => requirement.requirementId);
    const suppliedRequirementSet = new Set(suppliedRequirementIds);
    const missingRequirements = expectedRequirementIds.filter((id) => !suppliedRequirementSet.has(id));
    const unknownRequirements = [...suppliedRequirementSet].filter(
      (id) => !expectedRequirementIds.includes(id),
    );
    const duplicateRequirements = suppliedRequirementIds.filter(
      (id, index) => suppliedRequirementIds.indexOf(id) !== index,
    );
    if (
      missingRequirements.length > 0 ||
      unknownRequirements.length > 0 ||
      duplicateRequirements.length > 0
    ) {
      errors.push({
        criterionId: result.criterionId,
        message: `Requirement IDs must match the criterion contract exactly once. Missing: ${missingRequirements.join(", ") || "none"}; unknown: ${unknownRequirements.join(", ") || "none"}; duplicates: ${[...new Set(duplicateRequirements)].join(", ") || "none"}.`,
      });
      return [];
    }

    const statuses = result.requirementResults.map((requirement) => requirement.status);
    const hasNotApplicable = statuses.includes("NOT_APPLICABLE");
    if (hasNotApplicable && !statuses.every((status) => status === "NOT_APPLICABLE")) {
      errors.push({
        criterionId: result.criterionId,
        message: "NOT_APPLICABLE cannot be mixed with other requirement statuses.",
      });
      return [];
    }
    if (hasNotApplicable && !definition.allowNotApplicable) {
      errors.push({
        criterionId: result.criterionId,
        message: "NOT_APPLICABLE is not permitted for this criterion.",
      });
      return [];
    }
    if (hasNotApplicable && result.materialAssumptions.length > 0) {
      errors.push({
        criterionId: result.criterionId,
        message: "NOT_APPLICABLE criteria cannot include material assumptions.",
      });
      return [];
    }

    const knownRequirementIds = new Set(expectedRequirementIds);
    const invalidAssumption = result.materialAssumptions.find(
      (assumption) => !knownRequirementIds.has(assumption.requirementId),
    );
    if (invalidAssumption) {
      errors.push({
        criterionId: result.criterionId,
        message: `Material assumption references unknown requirement ${invalidAssumption.requirementId}.`,
      });
      return [];
    }

    const allLineNumbers = result.requirementResults.flatMap(
      (requirement) => requirement.evidenceLineNumbers,
    );
    const uniqueLineNumbers = [...new Set(allLineNumbers)];
    if (uniqueLineNumbers.length > definition.maxEvidenceLines) {
      errors.push({
        criterionId: result.criterionId,
        message: `Criterion permits at most ${definition.maxEvidenceLines} evidence line(s) across its complete evidence bundle.`,
        lineNumbers: uniqueLineNumbers,
      });
      return [];
    }

    for (const requirement of result.requirementResults) {
      const lineNumbers = requirement.evidenceLineNumbers;
      if (new Set(lineNumbers).size !== lineNumbers.length) {
        errors.push({
          criterionId: result.criterionId,
          message: `Requirement ${requirement.requirementId} evidence lines must be unique.`,
          lineNumbers,
        });
      }
      if (
        (requirement.status === "SUPPORTED" || requirement.status === "CONTRADICTED") &&
        lineNumbers.length === 0
      ) {
        errors.push({
          criterionId: result.criterionId,
          message: `${requirement.status} requirement ${requirement.requirementId} requires direct evidence lines.`,
        });
      }
      if (
        (requirement.status === "NOT_SUPPORTED" || requirement.status === "NOT_APPLICABLE") &&
        lineNumbers.length > 0
      ) {
        errors.push({
          criterionId: result.criterionId,
          message: `${requirement.status} requirement ${requirement.requirementId} must not claim evidence lines.`,
          lineNumbers,
        });
      }
    }
    const invalidLineNumbers = uniqueLineNumbers.filter(
      (lineNumber) => transcript.turns[lineNumber - 1] === undefined,
    );
    if (invalidLineNumbers.length > 0) {
      errors.push({
        criterionId: result.criterionId,
        message: "Criterion references a line that does not exist.",
        lineNumbers: invalidLineNumbers,
      });
      return [];
    }

    if (errors.some((error) => error.criterionId === result.criterionId)) return [];

    const requirementResults = result.requirementResults.map((requirement) => ({
      requirementId: requirement.requirementId,
      status: requirement.status,
      evidenceLineNumbers: [...requirement.evidenceLineNumbers],
      transcriptLines: requirement.evidenceLineNumbers.map(
        (lineNumber) => transcript.turns[lineNumber - 1]!,
      ),
    }));
    const derived = deriveCriterionSupport(statuses, result.materialAssumptions.length);
    const supportedLineNumbers = derived.state === "PRESENT"
      ? [...new Set(
          requirementResults
            .filter((requirement) => requirement.status === "SUPPORTED")
            .flatMap((requirement) => requirement.evidenceLineNumbers),
        )]
      : [];
    return [{
      criterionId: result.criterionId,
      dimensionId: definition.dimensionId,
      state: derived.state,
      supportVerdict: derived.supportVerdict,
      evidenceLineNumbers: supportedLineNumbers,
      transcriptLines: supportedLineNumbers.map((lineNumber) => transcript.turns[lineNumber - 1]!),
      requirementResults,
      materialAssumptions: result.materialAssumptions.map((assumption) => ({ ...assumption })),
    }];
  });

  if (errors.length > 0) throw new AppError("EVIDENCE_VALIDATION_FAILED", { details: errors });

  const criterionMap = new Map(criteria.map((criterion) => [criterion.criterionId, criterion]));
  const consistencyErrors = criterionConsistencyErrors(callType, criterionMap);
  if (consistencyErrors.length > 0) {
    throw new AppError("EVIDENCE_VALIDATION_FAILED", { details: consistencyErrors });
  }
  const state = (id: string): CriterionState => criterionMap.get(id)?.state ?? "ABSENT";
  const present = (id: string): boolean => state(id) === "PRESENT";
  const linesFor = (ids: readonly string[]): TranscriptTurn[] => {
    const lines = new Map<number, TranscriptTurn>();
    for (const id of ids) {
      for (const line of criterionMap.get(id)?.transcriptLines ?? []) lines.set(line.lineNumber, line);
    }
    return [...lines.values()].sort((a, b) => a.lineNumber - b.lineNumber);
  };
  const textFor = (ids: readonly string[]): string[] => linesFor(ids).map((line) => line.text);

  const dimensions: VerifiedDimensionEvidence[] = Array.from({ length: 12 }, (_, index) => {
    const dimensionId = index + 1;
    const dimensionDefinitions = catalog.filter((criterion) => criterion.dimensionId === dimensionId);
    const positiveEvidence: VerifiedEvidenceReference[] = dimensionDefinitions
      .filter((definition) => present(definition.id))
      .map((definition) => {
        const verified = criterionMap.get(definition.id)!;
        return {
          lineNumbers: verified.evidenceLineNumbers,
          interpretation: definition.description,
          transcriptLines: verified.transcriptLines,
        };
      });
    const negativeEvidence: VerifiedEvidenceReference[] = dimensionDefinitions.flatMap((definition) => {
      const verified = criterionMap.get(definition.id);
      if (!verified || verified.state === "PRESENT") return [];
      const requirementDefinitions = new Map(
        definition.requirements.map((requirement) => [requirement.id, requirement]),
      );
      return verified.requirementResults.flatMap((requirement) => {
        if (
          requirement.evidenceLineNumbers.length === 0 ||
          (requirement.status !== "CONTRADICTED" && requirement.status !== "UNVERIFIABLE")
        ) {
          return [];
        }
        const requirementDefinition = requirementDefinitions.get(requirement.requirementId);
        return [{
          lineNumbers: requirement.evidenceLineNumbers,
          interpretation: `${requirementDefinition?.description ?? definition.description} (${requirement.status.toLowerCase()})`,
          transcriptLines: requirement.transcriptLines,
        }];
      });
    });
    return {
      dimensionId,
      positiveEvidence,
      negativeEvidence,
      missingBehaviours: dimensionDefinitions.flatMap((definition) =>
        !present(definition.id) && definition.missingBehaviour ? [definition.missingBehaviour] : [],
      ),
      evidenceSufficient: positiveEvidence.length > 0,
    };
  });

  const coachSpeaking = speakingPercentage(transcript.turns, facts.coachSpeaker);
  const movementSignals = callType === "coaching"
    ? {
        clientPerformedLiveMovement: present("coaching.d04.client_live_movement"),
        coachGaveResponsiveCues: present("coaching.d04.responsive_setup_breathing_control_cues"),
        recordedMovementReviewedLive: present("coaching.d04.recorded_movement_reviewed_live"),
        realTimeFormCorrection: present("coaching.d04.real_time_form_correction"),
      }
    : {
        clientPerformedLiveMovement: false,
        coachGaveResponsiveCues: false,
        recordedMovementReviewedLive: false,
        realTimeFormCorrection: false,
      };
  const movementDetectionIds = [
    "coaching.d04.client_live_movement",
    "coaching.d04.responsive_setup_breathing_control_cues",
    "coaching.d04.recorded_movement_reviewed_live",
    "coaching.d04.real_time_form_correction",
  ] as const;
  const movementCoachingPresent =
    callType === "coaching" && movementDetectionIds.some((id) => state(id) !== "ABSENT");

  if (callType === "kickoff") {
    return {
      coachSpeaker: facts.coachSpeaker,
      clientSpeaker: facts.clientSpeaker,
      coachSpeakingPercentage: coachSpeaking,
      coachDominatedWithoutEngagement: !present("kickoff.global.client_engagement_present"),
      nextCallBookedLive: present("kickoff.d10.specific_date") && present("kickoff.d10.specific_time") && present("kickoff.d10.client_confirms"),
      unresolvedConfusion: present("kickoff.global.unresolved_confusion"),
      strugglePresent: false,
      struggleHandled: null,
      movementCoachingPresent,
      movementSignals,
      diagnosticsApplicable: false,
      adjustmentNeeded: false,
      noFollowUpQuestions: !present("kickoff.global.follow_up_question_present"),
      noActionStepsForEitherParty: !present("kickoff.d09.clear_next_steps"),
      noNorthStarOrLongTermVision: !present("kickoff.d04.north_star_constructed"),
      concreteAccountabilityOwned: present("kickoff.d07.accountability_style"),
      structuredRecapPresent: present("kickoff.d11.structured_recap"),
      coachCommitments: textFor(["kickoff.d12.first_specific_commitment", "kickoff.d12.second_distinct_commitment", "kickoff.d12.third_distinct_commitment"]),
      clientCommitments: textFor(["kickoff.d09.clear_next_steps"]),
      accountabilityDeadlines: textFor(["kickoff.d12.precise_timing_all", "kickoff.d12.mostly_precise_timing"]),
      criteria,
      dimensions,
    };
  }

  const strugglePresent = state("coaching.d08.struggle_present") !== "ABSENT";
  const concreteAccountabilityOwned = ["specific_deliverable", "client_confirms", "gated_to_coach_action", "time_bound"]
    .every((id) => present(`coaching.d07.${id}`));
  return {
    coachSpeaker: facts.coachSpeaker,
    clientSpeaker: facts.clientSpeaker,
    coachSpeakingPercentage: coachSpeaking,
    coachDominatedWithoutEngagement: !present("coaching.global.client_engagement_present"),
    nextCallBookedLive: present("coaching.d10.client_books_live") && present("coaching.d10.specific_date_confirmed") && present("coaching.d10.specific_time_confirmed"),
    unresolvedConfusion: present("coaching.global.unresolved_confusion"),
    strugglePresent,
    struggleHandled: strugglePresent ? !present("coaching.d08.struggle_ignored") && present("coaching.d08.struggle_acknowledged") : null,
    movementCoachingPresent,
    movementSignals,
    diagnosticsApplicable: state("coaching.d02.diagnostics_applicable") !== "NOT_APPLICABLE",
    adjustmentNeeded: state("coaching.d05.adjustment_needed") !== "ABSENT",
    noFollowUpQuestions: false,
    noActionStepsForEitherParty: !present("coaching.d06.coach_specific_commitment") && !present("coaching.d06.client_specific_commitment"),
    noNorthStarOrLongTermVision: !present("coaching.d03.explicit_twelve_month_vision"),
    concreteAccountabilityOwned,
    structuredRecapPresent: present("coaching.d11.anchor_restated"),
    coachCommitments: textFor(["coaching.d06.coach_specific_commitment"]),
    clientCommitments: textFor(["coaching.d06.client_specific_commitment", "coaching.d07.specific_deliverable"]),
    accountabilityDeadlines: textFor(["coaching.d06.coach_deadline", "coaching.d06.client_deadline", "coaching.d07.time_bound"]),
    criteria,
    dimensions,
  };
}

export function collectEvidenceLines(
  dimension: VerifiedDimensionEvidence,
  selectedLineNumbers: number[],
): TranscriptTurn[] {
  const allowed = new Map<number, TranscriptTurn>();
  for (const reference of [...dimension.positiveEvidence, ...dimension.negativeEvidence]) {
    for (const turn of reference.transcriptLines) allowed.set(turn.lineNumber, turn);
  }
  const requested = [...new Set(selectedLineNumbers)].sort((a, b) => a - b);
  const invalid = requested.filter((lineNumber) => !allowed.has(lineNumber));
  if (invalid.length > 0) {
    throw new AppError("SCORING_VALIDATION_FAILED", {
      details: { dimensionId: dimension.dimensionId, message: "Scoring cited lines outside the verified atomic criteria.", invalid },
    });
  }
  return requested.flatMap((lineNumber) => {
    const turn = allowed.get(lineNumber);
    return turn ? [turn] : [];
  });
}
