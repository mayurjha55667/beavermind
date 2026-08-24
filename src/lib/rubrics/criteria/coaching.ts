import { criterion, type CriterionDefinition, type CriterionView, type DimensionScoringRule } from "./types";

const c = criterion;

export const COACHING_CRITERIA: readonly CriterionDefinition[] = [
  c("coaching.global.client_engagement_present", 0, "The client participates meaningfully rather than remaining passive.", null),
  c("coaching.global.unresolved_confusion", 0, "The client leaves with unresolved confusion.", null),

  c("coaching.d01.body_check", 1, "The coach asks how the client's body has been feeling.", "Ask how the client's body has been feeling."),
  c("coaching.d01.wins_check", 1, "The coach asks about a specific recent win.", "Ask about a specific recent win."),
  c("coaching.d01.struggles_check", 1, "The coach asks what has felt difficult.", "Ask what has felt most difficult since the previous call."),
  c("coaching.d01.listens_without_interrupting", 1, "The coach listens before responding and does not interrupt.", "Allow the client to finish before responding."),
  c("coaching.d01.reflects_client_state", 1, "The coach reflects the client's state back accurately.", "Reflect the client's state back in the coach's own words."),
  c("coaching.d01.tailored_call_intention", 1, "The coach states a call intention tailored to the client's current state.", "State a call intention tailored to what the client needs today."),
  c("coaching.d01.adjusts_approach", 1, "The coach adjusts the call approach based on the opening check-in.", "Adjust the call plan based on the client's opening check-in.", false, 4, {
    requirements: [
      { id: "opening_state_identified", description: "The client's relevant state or need is established during the opening check-in." },
      { id: "call_approach_changed", description: "The coach explicitly changes or prioritizes the call approach in response." },
      { id: "causal_link_explicit", description: "The transcript explicitly links that change in approach to the opening check-in information." },
    ],
    excludedInterpretations: [
      "A pre-planned agenda that already included possible adjustments.",
      "A later exercise or lifestyle adjustment based on information first learned outside the opening check-in.",
      "Proceeding with the original agenda without an explicit change in emphasis or approach.",
    ],
  }),
  c("coaching.d01.generic_check_in", 1, "A basic or generic check-in is present.", null),
  c("coaching.d01.generic_intention", 1, "A generic call intention is stated.", null),

  c("coaching.d02.diagnostics_applicable", 2, "Diagnostics are applicable on this call because it is a milestone call or relevant video was submitted.", null, true),
  c("coaching.d02.one_or_two_movements", 2, "The coach reviews one or two movements rather than too many.", "Focus the diagnostics review on one or two movements."),
  c("coaching.d02.specific_anatomical_observation", 2, "The coach makes specific, anatomically precise observations.", "Make the diagnostic feedback anatomically specific."),
  c("coaching.d02.tied_to_pain_or_goals", 2, "The findings are tied directly to the client's pain points or goals.", "Connect each diagnostic finding to the client's pain point or goal."),
  c("coaching.d02.client_understands_connection", 2, "The client clearly understands why the finding matters.", "Check that the client understands how the finding connects to the goal."),
  c("coaching.d02.generic_feedback", 2, "The diagnostics feedback remains generic.", null),
  c("coaching.d02.review_present", 2, "A diagnostics or movement review occurs.", "Conduct a focused diagnostics review when applicable."),

  c("coaching.d03.current_block_target", 3, "The coach clearly explains what the current block is targeting.", "Explain what the current program block is targeting."),
  c("coaching.d03.explicit_twelve_month_vision", 3, "The current block is explicitly connected to the client's named 12-month vision.", "Connect the current block to the client's named 12-month vision.", false, 3, {
    requirements: [
      { id: "named_twelve_month_vision", description: "A specific 12-month client vision is explicitly stated." },
      { id: "current_block_connected", description: "The coach explicitly connects the current program block to that named vision." },
    ],
    excludedInterpretations: [
      "A generic reference to long-term health.",
      "Mentioning the current block and a distant goal without explicitly connecting them.",
    ],
  }),
  c("coaching.d03.method_difference", 3, "The coach explains that the program is built from diagnostics and goals rather than random workouts.", "Explain how this program differs from random workouts."),
  c("coaching.d03.client_belief_or_insight", 3, "The client responds with belief, understanding, or insight.", "Check that the client understands and believes in the reason for this block."),
  c("coaching.d03.specific_why_now", 3, "The coach explains why this block is the right step at this point in the journey.", "Explain why this block is the right step right now."),
  c("coaching.d03.generic_long_term_connection", 3, "The block is connected to long-term health only in generic terms.", null),
  c("coaching.d03.block_logistics_only", 3, "The block is explained only as short-term logistics.", null),

  c("coaching.d04.client_live_movement", 4, "The client performs a live movement during the call.", "Include live movement coaching when appropriate."),
  c("coaching.d04.responsive_setup_breathing_control_cues", 4, "The coach gives setup, breathing, or control cues in response to movement.", "Give responsive setup, breathing, or control cues."),
  c("coaching.d04.recorded_movement_reviewed_live", 4, "A recorded movement attempt is reviewed live with feedback.", "Review a recorded movement attempt live when appropriate."),
  c("coaching.d04.real_time_form_correction", 4, "The coach gives real-time form correction while the client moves.", "Give responsive real-time form correction."),
  c("coaching.d04.one_or_two_movements", 4, "The coach focuses on one or two movements.", "Focus the coaching section on one or two movements."),
  c("coaching.d04.specific_cues", 4, "The coach gives specific and relevant movement cues.", "Make movement cues specific and actionable."),
  c("coaching.d04.reflective_questions", 4, "The coach asks reflective questions about what the client feels or notices.", "Ask what the client feels, finds difficult, or notices changing."),
  c("coaching.d04.observable_improvement_or_understanding", 4, "Improvement is observable or the client confirms a new understanding.", "Confirm what improved or clicked for the client."),
  c("coaching.d04.goal_link", 4, "The movement coaching is linked back to the client's goal.", "Connect the movement coaching to the client's goal."),
  c("coaching.d04.back_and_forth_exchange", 4, "The section contains a real back-and-forth coaching exchange.", "Create a back-and-forth coaching exchange rather than one-way commentary."),
  c("coaching.d04.telling_only", 4, "The coach mostly tells the client what to do without reflective exchange.", null),

  c("coaching.d05.adjustment_needed", 5, "A training or lifestyle adjustment is needed on this call.", null),
  c("coaching.d05.adjustment_made", 5, "A relevant adjustment is made.", "Make a clear adjustment when one is needed."),
  c("coaching.d05.rationale_explained", 5, "The reason for the adjustment is explained.", "Explain why the adjustment is being made."),
  c("coaching.d05.long_game_link", 5, "The adjustment is explicitly tied to the client's long-term goal.", "Tie the adjustment explicitly to the client's long-term goal.", false, 5, {
    requirements: [
      { id: "specific_adjustment", description: "A specific training or lifestyle adjustment is identified." },
      { id: "named_long_term_goal", description: "The client's specific long-term goal is identified." },
      { id: "explicit_adjustment_goal_link", description: "The coach explicitly explains how that adjustment protects or advances the named long-term goal." },
    ],
    excludedInterpretations: [
      "Mentioning an adjustment in one section and the long-term goal in another without connecting them.",
      "A generic statement that the long-term goal remains the same.",
      "Safety advice with no stated connection to the client's long-term goal.",
    ],
  }),
  c("coaching.d05.protective_strategy_framing", 5, "The adjustment is framed as intelligent protection rather than backing off.", "Frame the adjustment as a strategic way to protect progress."),
  c("coaching.d05.training_constraints_addressed", 5, "Relevant training constraints are addressed.", "Address the relevant training constraints."),
  c("coaching.d05.lifestyle_constraints_addressed", 5, "Relevant lifestyle constraints are addressed.", "Address the relevant lifestyle constraints."),
  c("coaching.d05.client_confident", 5, "The client leaves the adjustment feeling confident rather than discouraged.", "Check that the client understands and feels confident about the adjustment.", false, 3, {
    requirements: [
      { id: "client_confidence_evidenced", description: "The client's own words or an unambiguous response establish confidence about the adjustment." },
    ],
    excludedInterpretations: [
      "The coach says the plan should work without the client expressing confidence.",
      "The client merely acknowledges hearing the adjustment.",
    ],
  }),
  c("coaching.d05.unexplained_adjustment", 5, "An adjustment is made without a clear rationale.", null),

  c("coaching.d06.coach_specific_commitment", 6, "The coach states a specific commitment.", "State a specific coach commitment."),
  c("coaching.d06.coach_deadline", 6, "The coach attaches a deadline to their commitment.", "Attach a deadline to the coach commitment."),
  c("coaching.d06.client_specific_commitment", 6, "The client owns a specific, measurable commitment.", "Create a specific, measurable client commitment.", false, 3, {
    requirements: [
      { id: "client_ownership", description: "The client explicitly owns or agrees to perform the action." },
      { id: "specific_and_measurable", description: "The action is specific enough that completion can be verified." },
    ],
    excludedInterpretations: [
      "A coach suggestion that the client never accepts.",
      "Generic encouragement to try, improve, or stay consistent.",
    ],
  }),
  c("coaching.d06.client_deadline", 6, "The client commitment has a deadline.", "Attach a deadline to the client commitment."),
  c("coaching.d06.weekly_theme_in_client_words", 6, "The client states a unifying weekly theme in their own words.", "Ask the client to state the unifying weekly theme in their own words.", false, 3, {
    requirements: [
      { id: "client_authored", description: "The client, rather than the coach, supplies the wording." },
      { id: "unifying_theme", description: "The client's wording expresses the week's unifying focus, intention, or principle rather than merely listing tasks." },
    ],
    excludedInterpretations: [
      "Repeating a list of commitments supplied by the coach.",
      "Selecting the most important task without naming a broader weekly focus or intention.",
      "Agreeing with a weekly theme stated only by the coach.",
    ],
  }),
  c("coaching.d06.micro_commitment_when_slipping", 6, "A micro-commitment is created when the client is slipping.", "Create a small immediate commitment when the client is slipping."),
  c("coaching.d06.clear_but_incomplete_commitments", 6, "Commitments are clear but one side, deadline, or measurement is incomplete.", null),
  c("coaching.d06.vague_actions", 6, "Only vague actions or encouragement are given.", null),

  c("coaching.d07.specific_deliverable", 7, "The client owns a specific, verifiable deliverable.", "Define one specific, verifiable accountability deliverable."),
  c("coaching.d07.client_confirms", 7, "The client verbally confirms ownership of the deliverable.", "Ask the client to confirm ownership of the accountability deliverable."),
  c("coaching.d07.gated_to_coach_action", 7, "The deliverable is clearly gated to a coach action or progression decision.", "Explain what coach action or progression the deliverable unlocks.", false, 3, {
    requirements: [
      { id: "client_deliverable", description: "A specific client-owned deliverable is identified." },
      { id: "explicit_progression_gate", description: "The coach explicitly states which coach action or progression decision depends on that deliverable." },
    ],
    excludedInterpretations: [
      "A standalone client task with no stated consequence or coach response.",
      "A vague promise that the coach will look at it later.",
    ],
  }),
  c("coaching.d07.time_bound", 7, "The deliverable has a hard or session-relative deadline.", "Add a clear deadline or submission window."),
  c("coaching.d07.accountability_gesture", 7, "Accountability is mentioned but lacks a clear consequence or progression gate.", null),

  c("coaching.d08.struggle_present", 8, "The client presents a physical, emotional, motivational, or program-related struggle.", null),
  c("coaching.d08.struggle_acknowledged", 8, "The coach acknowledges the struggle.", "Acknowledge the client's struggle directly."),
  c("coaching.d08.questions_before_solution", 8, "The coach asks questions to understand the core issue before offering a solution.", "Ask questions before moving to a solution."),
  c("coaching.d08.fact_based_nondefensive", 8, "The coach stays grounded, fact-based, and non-defensive.", "Stay fact-based and avoid defending the program."),
  c("coaching.d08.reconnects_to_why", 8, "The coach reconnects the client to their why.", "Reconnect the struggle to the client's why."),
  c("coaching.d08.reframes_and_offers_options", 8, "The coach reframes the struggle and offers useful options.", "Reframe the struggle and offer clear options."),
  c("coaching.d08.full_circle_close", 8, "The coach closes the struggle thread by returning to it and checking what else the client needs.", "Close the struggle loop by returning to it and checking what the client needs from the coach.", false, 4, {
    requirements: [
      { id: "struggle_revisited", description: "The close explicitly returns to the struggle, concern, or resolution discussed in that thread." },
      { id: "coach_support_checked", description: "The coach asks whether the client needs anything else from the coach regarding that struggle or resolution." },
    ],
    excludedInterpretations: [
      "A generic end-of-call question such as whether anything else was missed.",
      "A closing question that does not refer back to the struggle or its resolution.",
      "Checking task clarity without checking what support the client needs.",
    ],
  }),
  c("coaching.d08.client_more_capable", 8, "The client leaves the struggle section more capable and reconnected.", "Confirm that the client leaves with greater confidence and capability.", false, 3, {
    requirements: [
      { id: "client_outcome_evidenced", description: "The client's own response explicitly demonstrates increased capability, clarity, or reconnection after the struggle discussion." },
    ],
    excludedInterpretations: [
      "The coach offers a solution but the client's resulting state is not established.",
      "A polite acknowledgment such as okay or thanks by itself.",
    ],
  }),
  c("coaching.d08.struggle_ignored", 8, "The struggle is ignored, minimized, avoided, or met defensively.", null),

  c("coaching.d09.specific_progress_celebrated", 9, "The coach celebrates a specific named progress from this call.", "Celebrate one specific piece of progress from this call."),
  c("coaching.d09.direction_reiterated", 9, "The coach connects the celebrated progress to a future direction or next milestone.", "Reiterate where the celebrated progress leads next.", false, 4, {
    requirements: [
      { id: "future_direction_named", description: "A future direction, phase, or milestone is named." },
      { id: "progress_connected_forward", description: "The coach explicitly connects the progress being celebrated to that future direction." },
    ],
    excludedInterpretations: [
      "A tactical recap of next week's tasks with no future milestone.",
      "A future goal mentioned earlier but not connected to the closing celebration.",
    ],
  }),
  c("coaching.d09.client_energized", 9, "The client leaves visibly energized rather than merely satisfied.", "Create a warmer, more energizing close."),
  c("coaching.d09.positive_generic_close", 9, "The close is positive but generic or mostly logistical.", null),

  c("coaching.d10.booking_link_shared_live", 10, "The booking link is shared during the call.", "Share the booking link live during the call."),
  c("coaching.d10.client_books_live", 10, "The client books the next call during the current call.", "Have the client book the next call before ending.", false, 3, {
    requirements: [
      { id: "booking_completed_during_call", description: "The transcript explicitly establishes that the client completed the booking before the current call ended." },
    ],
    excludedInterpretations: [
      "The coach merely shares a link.",
      "The client promises to book after the call.",
      "A date is discussed without completion of the booking being established.",
    ],
  }),
  c("coaching.d10.specific_date_confirmed", 10, "The next-call date is confirmed verbally.", "Confirm the booked date verbally."),
  c("coaching.d10.specific_time_confirmed", 10, "The next-call time is confirmed verbally.", "Confirm the booked time verbally."),
  c("coaching.d10.before_close", 10, "Booking is completed before the close.", "Complete booking before the closing section."),

  c("coaching.d11.anchor_restated", 11, "The accountability anchor is explicitly restated.", "Restate the accountability anchor before closing."),
  c("coaching.d11.coach_follow_up_specific_timing", 11, "The coach states their follow-up with specific timing.", "State exactly when the coach will follow up."),
  c("coaching.d11.cause_effect_chain", 11, "The client action and coach response form a clear cause-and-effect chain.", "Explain the chain: client action by a deadline, then coach response by a deadline.", false, 4, {
    requirements: [
      { id: "client_action_and_timing", description: "A specific client action and its timing are established." },
      { id: "coach_response_and_timing", description: "A specific coach response and its timing are established." },
      { id: "dependency_explicit", description: "The transcript explicitly states that the coach response follows or depends on the client action." },
    ],
    excludedInterpretations: [
      "Separate client and coach actions with no stated dependency.",
      "A vague follow-up with no timing.",
    ],
  }),
  c("coaching.d11.client_understands_next", 11, "The client clearly understands what happens after the call.", "Check that the client understands exactly what happens next."),
  c("coaching.d11.vague_follow_up", 11, "Follow-up is mentioned but timing or the accountability chain remains vague.", null),

  c("coaching.d12.applicable_sections_covered", 12, "All applicable SOP sections, including live next-call booking, are covered.", "Cover every applicable SOP section, including live next-call booking.", false, 8, {
    requirements: [
      { id: "check_in", description: "A check-in section is present." },
      { id: "program_focus", description: "Program focus and vision are addressed." },
      { id: "adjustments", description: "Adjustments and strategy are addressed when needed." },
      { id: "accountability", description: "Action steps and accountability are addressed." },
      { id: "close", description: "A closing section is present." },
      { id: "live_booking", description: "The next call is actually booked live before the call ends." },
    ],
    excludedInterpretations: [
      "Treating a verbal reference to a future call as completed live booking.",
      "Calling all sections complete when the required booking section is absent.",
    ],
  }),
  c("coaching.d12.smooth_pacing", 12, "The call pacing is smooth rather than rushed or padded.", "Smooth out the pacing across sections."),
  c("coaching.d12.close_and_booking_not_rushed", 12, "The close and completed live booking do not feel rushed.", "Protect enough time for an unrushed close and completed live booking.", false, 5, {
    requirements: [
      { id: "close_present", description: "A substantive closing exchange is present." },
      { id: "live_booking_completed", description: "The next call is completed live during the call." },
      { id: "close_and_booking_paced", description: "The transcript supports that both the close and booking were handled without being compressed or abrupt." },
    ],
    excludedInterpretations: [
      "Inferring that booking was unrushed when no live booking occurred.",
      "A verbal future-call reference without completed booking.",
    ],
  }),
  c("coaching.d12.client_not_confused", 12, "The client remains clear about where the call is going.", "Use clearer transitions so the client knows where the call is going."),
  c("coaching.d12.framework_natural", 12, "The framework is woven naturally rather than announced robotically.", "Use more natural transitions between framework sections."),
  c("coaching.d12.uneven_pacing", 12, "Most sections are covered, but pacing is uneven or one section is compressed.", null),
  c("coaching.d12.core_sections_missing", 12, "Core sections are missing and the flow is unclear.", null),
];

export function scoreCoachingD01(f: CriterionView): number {
  if (["body_check", "wins_check", "struggles_check", "listens_without_interrupting", "reflects_client_state", "tailored_call_intention", "adjusts_approach"].every((id) => f.present(`coaching.d01.${id}`))) return 10;
  if (f.count(["coaching.d01.body_check", "coaching.d01.wins_check", "coaching.d01.struggles_check"]) >= 2 && f.present("coaching.d01.reflects_client_state") && (f.present("coaching.d01.tailored_call_intention") || f.present("coaching.d01.generic_intention"))) return 7;
  return f.present("coaching.d01.generic_check_in") ? 3 : 0;
}

export function scoreCoachingD02(f: CriterionView): number {
  if (!f.present("coaching.d02.diagnostics_applicable")) return 0;
  if (["one_or_two_movements", "specific_anatomical_observation", "tied_to_pain_or_goals", "client_understands_connection"].every((id) => f.present(`coaching.d02.${id}`))) return 10;
  if (f.present("coaching.d02.review_present") && f.present("coaching.d02.one_or_two_movements") && f.present("coaching.d02.specific_anatomical_observation")) return 7;
  return f.present("coaching.d02.review_present") || f.present("coaching.d02.generic_feedback") ? 3 : 0;
}

export function scoreCoachingD03(f: CriterionView): number {
  if (["current_block_target", "explicit_twelve_month_vision", "method_difference", "client_belief_or_insight", "specific_why_now"].every((id) => f.present(`coaching.d03.${id}`))) return 15;
  if (f.present("coaching.d03.current_block_target") && (f.present("coaching.d03.explicit_twelve_month_vision") || f.present("coaching.d03.generic_long_term_connection"))) return 10;
  return f.present("coaching.d03.current_block_target") || f.present("coaching.d03.block_logistics_only") ? 5 : 0;
}

export function scoreCoachingD04(f: CriterionView): number {
  const movement = f.count(["coaching.d04.client_live_movement", "coaching.d04.responsive_setup_breathing_control_cues", "coaching.d04.recorded_movement_reviewed_live", "coaching.d04.real_time_form_correction"]) > 0;
  if (!movement) return 0;
  if (["one_or_two_movements", "specific_cues", "reflective_questions", "observable_improvement_or_understanding", "goal_link", "back_and_forth_exchange"].every((id) => f.present(`coaching.d04.${id}`))) return 15;
  if (f.present("coaching.d04.specific_cues") && f.present("coaching.d04.back_and_forth_exchange")) return 10;
  return f.present("coaching.d04.telling_only") || movement ? 5 : 0;
}

export function scoreCoachingD05(f: CriterionView): number {
  const adjustmentState = f.state("coaching.d05.adjustment_needed");
  if (adjustmentState === "ABSENT") return 7;
  if (adjustmentState !== "PRESENT") return 0;
  if (["adjustment_made", "rationale_explained", "long_game_link", "protective_strategy_framing", "client_confident"].every((id) => f.present(`coaching.d05.${id}`))) return 10;
  if (f.present("coaching.d05.adjustment_made") && f.present("coaching.d05.rationale_explained")) return 7;
  return f.present("coaching.d05.adjustment_made") || f.present("coaching.d05.unexplained_adjustment") ? 3 : 0;
}

export function scoreCoachingD06(f: CriterionView): number {
  if (["coach_specific_commitment", "coach_deadline", "client_specific_commitment", "client_deadline", "weekly_theme_in_client_words"].every((id) => f.present(`coaching.d06.${id}`))) return 15;
  if (f.present("coaching.d06.coach_specific_commitment") && f.present("coaching.d06.client_specific_commitment") && (f.present("coaching.d06.coach_deadline") || f.present("coaching.d06.client_deadline"))) return 10;
  return f.present("coaching.d06.vague_actions") || f.present("coaching.d06.clear_but_incomplete_commitments") ? 5 : 0;
}

export function scoreCoachingD07(f: CriterionView): number {
  if (["specific_deliverable", "client_confirms", "gated_to_coach_action", "time_bound"].every((id) => f.present(`coaching.d07.${id}`))) return 5;
  return f.present("coaching.d07.accountability_gesture") || f.present("coaching.d07.specific_deliverable") ? 3 : 0;
}

export function scoreCoachingD08(f: CriterionView): number {
  const struggleState = f.state("coaching.d08.struggle_present");
  if (struggleState === "ABSENT") return 5;
  if (struggleState !== "PRESENT") return 0;
  if (f.present("coaching.d08.struggle_ignored")) return 0;
  if (["struggle_acknowledged", "questions_before_solution", "fact_based_nondefensive", "reconnects_to_why", "reframes_and_offers_options", "full_circle_close", "client_more_capable"].every((id) => f.present(`coaching.d08.${id}`))) return 5;
  return f.present("coaching.d08.struggle_acknowledged") ? 3 : 0;
}

export function scoreCoachingD09(f: CriterionView): number {
  if (["specific_progress_celebrated", "direction_reiterated", "client_energized"].every((id) => f.present(`coaching.d09.${id}`))) return 5;
  return f.present("coaching.d09.positive_generic_close") || f.present("coaching.d09.specific_progress_celebrated") ? 3 : 0;
}

export function scoreCoachingD10(f: CriterionView): number {
  return ["booking_link_shared_live", "client_books_live", "specific_date_confirmed", "specific_time_confirmed", "before_close"].every((id) => f.present(`coaching.d10.${id}`)) ? 5 : 0;
}

export function scoreCoachingD11(f: CriterionView): number {
  if (["anchor_restated", "coach_follow_up_specific_timing", "cause_effect_chain", "client_understands_next"].every((id) => f.present(`coaching.d11.${id}`))) return 5;
  return f.present("coaching.d11.vague_follow_up") || f.present("coaching.d11.coach_follow_up_specific_timing") ? 3 : 0;
}

export function scoreCoachingD12(f: CriterionView): number {
  if (["applicable_sections_covered", "smooth_pacing", "close_and_booking_not_rushed", "client_not_confused", "framework_natural"].every((id) => f.present(`coaching.d12.${id}`))) return 5;
  if (
    f.present("coaching.d12.uneven_pacing") ||
    f.present("coaching.d12.applicable_sections_covered") ||
    f.count([
      "coaching.d12.smooth_pacing",
      "coaching.d12.client_not_confused",
      "coaching.d12.framework_natural",
    ]) >= 2
  ) return 3;
  return 0;
}

export const COACHING_SCORING_RULES: readonly DimensionScoringRule[] = [
  scoreCoachingD01, scoreCoachingD02, scoreCoachingD03, scoreCoachingD04,
  scoreCoachingD05, scoreCoachingD06, scoreCoachingD07, scoreCoachingD08,
  scoreCoachingD09, scoreCoachingD10, scoreCoachingD11, scoreCoachingD12,
].map((score, index) => ({ dimensionId: index + 1, score }));
