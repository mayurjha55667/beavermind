import { criterion, type CriterionDefinition, type CriterionView, type DimensionScoringRule } from "./types";

const c = criterion;

export const KICKOFF_CRITERIA: readonly CriterionDefinition[] = [
  c("kickoff.global.follow_up_question_present", 0, "At least one genuine follow-up question is present.", null),
  c("kickoff.global.client_engagement_present", 0, "The client participates meaningfully rather than remaining passive.", null),
  c("kickoff.global.unresolved_confusion", 0, "The client leaves with unresolved confusion.", null),

  c("kickoff.d01.specific_goal_from_notes_early", 1, "The coach introduces a specific client goal from pre-call notes before the client supplies it.", "Reference a specific client goal from the intake or sales notes before asking the client to repeat it.", false, 3, {
    requirements: [
      { id: "specific_client_goal", description: "The coach states a specific goal belonging to this client." },
      { id: "known_before_client_disclosure", description: "The coach states the goal before the client supplies it during this call." },
      { id: "pre_call_source_established", description: "The cited exchange explicitly attributes the goal to intake, sales, or other pre-call notes." },
    ],
    excludedInterpretations: [
      "A goal first disclosed by the client during this call.",
      "A generic goal that could apply to any client.",
      "Assuming that prior knowledge came from notes when the transcript does not establish the source.",
    ],
  }),
  c("kickoff.d01.pain_or_injury_from_notes_early", 1, "The coach introduces a specific pain point or injury from pre-call notes before the client supplies it.", "Reference a known pain point or injury from the intake notes early in the call.", false, 3, {
    requirements: [
      { id: "specific_client_condition", description: "The coach states a specific pain point or injury belonging to this client." },
      { id: "known_before_client_disclosure", description: "The coach states the condition before the client supplies it during this call." },
      { id: "pre_call_source_established", description: "The cited exchange explicitly attributes the condition to intake, sales, or other pre-call notes." },
    ],
    excludedInterpretations: [
      "A condition first disclosed by the client during this call.",
      "Generic pain screening.",
      "Assuming that prior knowledge came from notes when the transcript does not establish the source.",
    ],
  }),
  c("kickoff.d01.history_or_context_from_notes_early", 1, "The coach introduces specific history or lifestyle context from pre-call notes before the client supplies it.", "Reference specific history or lifestyle context from the intake notes early in the call.", false, 3, {
    requirements: [
      { id: "specific_client_context", description: "The coach states specific history or lifestyle context belonging to this client." },
      { id: "known_before_client_disclosure", description: "The coach states the context before the client supplies it during this call." },
      { id: "pre_call_source_established", description: "The cited exchange explicitly attributes the context to intake, sales, or other pre-call notes." },
    ],
    excludedInterpretations: [
      "Context first disclosed by the client during this call.",
      "Generic rapport or discovery questions.",
      "Assuming that prior knowledge came from notes when the transcript does not establish the source.",
    ],
  }),
  c("kickoff.d01.client_name_used_early", 1, "The coach uses the client's name naturally in the opening.", "Use the client's name naturally in the opening."),
  c("kickoff.d01.notes_acknowledged", 1, "The coach explicitly acknowledges having reviewed the client's notes.", "Acknowledge the intake or sales notes naturally."),
  c("kickoff.d01.partial_note_reference_early", 1, "The coach makes an early, transcript-verifiable surface reference explicitly tied to intake or sales notes, without using a specific goal, pain point, or history detail.", null),
  c("kickoff.d01.redundant_discovery_reset", 1, "The coach resets discovery by asking for information that should already be known from pre-call notes.", null),

  c("kickoff.d02.warm_calm_tone", 2, "The coach maintains a warm, calm, professional tone.", "Use a warmer, calmer, and more conversational tone."),
  c("kickoff.d02.personalized_interaction", 2, "The interaction is personalized to the client rather than generic.", "Personalize the interaction to the client's language and situation."),
  c("kickoff.d02.energy_matched", 2, "The coach visibly changes or adapts their tone, pace, or approach in direct response to the client's expressed energy. Client confirmations, positive answers, or the coach's consistently warm tone alone do not count.", "Match the client's energy more deliberately."),
  c("kickoff.d02.personal_relevant_disclosure", 2, "The coach shares a brief personal and relevant human connection.", "Add one brief, relevant human connection point."),
  c("kickoff.d02.client_opens_spontaneously", 2, "The client volunteers unprompted personal context or a story beyond the direct answer requested. Merely answering the coach's question does not count.", "Create enough safety and curiosity for the client to open up beyond prompted answers."),
  c("kickoff.d02.friendly_but_transactional", 2, "The exchange is friendly but mostly transactional or scripted.", null),

  c("kickoff.d03.agenda_mentioned", 3, "The coach intentionally frames what the call will cover.", "State a clear agenda at the beginning of the call."),
  c("kickoff.d03.explicit_time_framing", 3, "The coach states the available time window explicitly.", "State the available time window at the outset."),
  c("kickoff.d03.phase_connection", 3, "The agenda includes connection or discovery.", "Include the connection or discovery phase in the agenda."),
  c("kickoff.d03.phase_goals", 3, "The agenda includes goals or success alignment.", "Include goals or success alignment in the agenda."),
  c("kickoff.d03.phase_program_or_support", 3, "The agenda includes program, journey, or support explanation.", "Include the program, journey, or support phase in the agenda."),
  c("kickoff.d03.phase_actions_or_booking", 3, "The agenda includes actions, next steps, or booking.", "Include actions or next steps in the agenda."),
  c("kickoff.d03.client_verbal_consent", 3, "The client verbally agrees to the proposed agenda.", "Ask for and receive explicit client agreement to the agenda."),
  c("kickoff.d03.fragmented_mention_only", 3, "Only a fragmented or vague mention of the call structure is present.", null),
  c("kickoff.d03.crisp_delivery", 3, "The agenda phrasing itself is concise, ordered, and intentional, independent of whether time framing or consent is present.", "Make the agenda phrasing concise and intentional."),

  c("kickoff.d04.functional_goal", 4, "The client's functional or physical goal is identified.", "Identify a concrete functional or physical goal."),
  c("kickoff.d04.why_follow_up_one", 4, "The coach asks a first meaningful why follow-up.", "Ask at least one meaningful follow-up about why the goal matters."),
  c("kickoff.d04.why_follow_up_two", 4, "The coach asks a second meaningful why follow-up.", "Ask a second why follow-up to deepen the emotional driver."),
  c("kickoff.d04.emotional_or_identity_driver", 4, "An emotional or identity-based driver is explicitly uncovered.", "Uncover the emotional or identity-based reason behind the goal."),
  c("kickoff.d04.north_star_constructed", 4, "The coach constructs an explicit North Star statement.", "Turn the emotional driver into a clear North Star statement."),
  c("kickoff.d04.thirty_day_metric", 4, "A specific 30-day success metric is defined.", "Define a specific 30-day success metric connected to the North Star."),
  c("kickoff.d04.client_confirms_north_star", 4, "The client verbally confirms the North Star language.", "Ask the client to confirm that the North Star language fits."),

  c("kickoff.d05.phase_retraining", 5, "Movement Retraining or an equivalent foundation phase is explained.", "Explain the first foundation or retraining phase."),
  c("kickoff.d05.phase_remodeling", 5, "Movement Remodeling or an equivalent build phase is explained.", "Explain the second build or remodeling phase."),
  c("kickoff.d05.phase_integrating", 5, "Movement Integrating or an equivalent integration phase is explained.", "Explain the third integration phase."),
  c("kickoff.d05.correct_order", 5, "The three phases are presented in the correct progression.", "Present the three phases in their correct order."),
  c("kickoff.d05.outcomes_explained", 5, "The intended outcome of each phase is explained.", "Explain what the client should gain from each phase."),
  c("kickoff.d05.analogy_or_reassessment", 5, "An analogy or reassessment cadence makes the progression easier to understand.", "Add a simple analogy or reassessment cadence."),
  c("kickoff.d05.tied_to_client_goal", 5, "The phase progression is tied directly to the client's goal.", "Connect each phase to the client's stated goal."),
  c("kickoff.d05.client_understands", 5, "The client confirms understanding of the progression.", "Check that the client understands why the progression is structured this way."),
  c("kickoff.d05.generic_phase_reference", 5, "The coach only refers vaguely to phases, steps, or progression.", null),

  c("kickoff.d06.basic_expectations", 6, "The coach sets at least basic expectations for what happens next.", "Set clear expectations for what the client should expect next."),
  c("kickoff.d06.timeline_or_milestones", 6, "The coach explains a meaningful multi-week or multi-month program path with an intermediate progression, phase, or milestone. A desired end result at a future date is not a program timeline by itself.", "Explain the broader timeline and key milestones.", false, 4, {
    requirements: [
      { id: "coach_explains_program_path", description: "The coach explains what the client should expect to happen in the program beyond the current week." },
      { id: "intermediate_progression_or_milestone", description: "The explanation includes at least one intermediate progression, phase, or milestone distinct from the client's desired end outcome." },
      { id: "timing_attached_to_program_path", description: "A multi-week or multi-month time horizon is attached to that program path, progression, phase, or milestone." },
    ],
    excludedInterpretations: [
      "A question and answer about what outcome the client wants several months from now.",
      "A future endpoint goal without an intermediate program path, progression, phase, or milestone.",
      "An immediate action deadline.",
      "The client's current weekly workout schedule.",
      "The date or time of the next call.",
    ],
  }),
  c("kickoff.d06.emotional_friction_normalized", 6, "The coach explicitly predicts and normalizes a future difficult, frustrating, or low-motivation period. Generic encouragement such as consistency over perfection does not count.", "Normalize the emotional friction clients may experience."),
  c("kickoff.d06.valley_timing", 6, "Likely valleys or difficult weeks are placed on the timeline.", "Explain when a difficult or low-motivation period commonly appears."),
  c("kickoff.d06.good_vs_bad_pain", 6, "Good discomfort is distinguished from bad pain.", "Explain the difference between productive discomfort and warning-sign pain."),
  c("kickoff.d06.first_month_foundational", 6, "The first month is framed as foundational rather than transformational.", "Frame the first month as foundational rather than transformational."),
  c("kickoff.d06.north_star_link", 6, "The coach explicitly connects an explained program journey, progression, or milestone back to the client's North Star.", "Connect journey expectations back to the client's North Star.", false, 4, {
    requirements: [
      { id: "journey_expectation_present", description: "The coach has explained a program timeline, progression, phase, or milestone." },
      { id: "explicit_north_star_connection", description: "The coach explicitly connects that journey expectation to the client's North Star." },
    ],
    excludedInterpretations: [
      "Constructing or repeating the North Star without linking it to an explained program journey.",
      "Saying to remember or return to the North Star when motivation is low without describing a program progression or milestone.",
      "Treating the client's desired end outcome as both the journey and the North Star link.",
    ],
  }),
  c("kickoff.d06.physical_discomfort_normalized", 6, "The coach explicitly explains that some safe soreness or discomfort is expected or normal. Pain screening, referral advice, or a low-impact modification alone do not count.", "Prepare the client for safe, expected physical discomfort.", false, 3, {
    requirements: [
      { id: "safe_discomfort_identified", description: "The coach refers to safe soreness or physical discomfort." },
      { id: "explicitly_expected_or_normal", description: "The coach explicitly says that this safe discomfort is expected or normal." },
    ],
    excludedInterpretations: [
      "Pain screening without saying discomfort is expected or normal.",
      "Referral or stop-if-pain advice by itself.",
      "A low-impact exercise modification by itself.",
    ],
  }),

  c("kickoff.d07.primary_channel", 7, "The primary support channel is named clearly.", "Name the primary support channel."),
  c("kickoff.d07.response_time", 7, "The coach states an expected response time.", "State when the client can expect a response."),
  c("kickoff.d07.community_access", 7, "Community access is explained, including how to use it.", "Explain how the client accesses and uses the community."),
  c("kickoff.d07.accountability_style", 7, "The coach asks or explains the preferred accountability style.", "Clarify whether the client prefers more push or more support."),
  c("kickoff.d07.support_mentioned", 7, "At least one actual between-session support behavior is described. An agenda promise to discuss support later does not count.", "Describe how between-session support will work."),
  c("kickoff.d07.client_understands", 7, "The client confirms understanding of the support system.", "Check that the client knows how and when to reach the coach."),

  c("kickoff.d08.behavioral_patterns", 8, "The coach asks about behavioral patterns that have stopped progress before.", "Ask what has stopped progress in the past."),
  c("kickoff.d08.consistency_triggers", 8, "The coach explores triggers that disrupt consistency.", "Explore what typically disrupts the client's consistency."),
  c("kickoff.d08.learning_style", 8, "The coach establishes how the client prefers to learn or receive coaching communication and feedback.", "Ask how the client learns best and how they prefer coaching communication or feedback.", false, 3, {
    requirements: [
      { id: "preference_explicitly_explored", description: "The coach explicitly asks about, or the client unambiguously states, a learning or coaching-communication preference." },
      { id: "learning_or_feedback_delivery", description: "The preference concerns how the client learns, understands, receives explanation, or receives coaching feedback." },
    ],
    excludedInterpretations: [
      "An accountability frequency or reminder preference with no connection to learning or feedback delivery.",
      "A generic request for more support.",
      "The coach inferring a learning style without client evidence.",
    ],
  }),
  c("kickoff.d08.stress_response", 8, "The transcript explicitly establishes what the client tends to do under stress, either through a direct question and answer or an unambiguous client statement.", "Ask how the client tends to respond under stress."),
  c("kickoff.d08.uses_answers_to_personalize", 8, "The coach uses the answers to personalize the coaching approach.", "Use the client's answers to personalize the coaching approach."),
  c("kickoff.d08.archetype_signals", 8, "The coach explicitly synthesizes evidence into a meaningful, coaching-relevant client archetype or dominant behavioral pattern.", "Identify the client's dominant behavioral pattern or coaching archetype.", false, 3, {
    requirements: [
      { id: "pattern_synthesized", description: "The coach explicitly synthesizes the client's statements into a recurring or dominant pattern." },
      { id: "coaching_relevance", description: "The identified pattern is used or framed as relevant to how the client should be coached." },
    ],
    excludedInterpretations: [
      "Merely repeating one isolated behavior described by the client.",
      "A generic label that is not grounded in the client's statements.",
      "Treating any mention of all-or-nothing behavior as a complete archetype identification.",
    ],
  }),
  c("kickoff.d08.generic_questions_only", 8, "The questions remain generic or logistical rather than behavioral.", null),

  c("kickoff.d09.clear_next_steps", 9, "The client receives clear, concrete next steps.", "State clear and concrete next steps."),
  c("kickoff.d09.diagnostics_pipeline", 9, "The diagnostics-to-film-to-upload-to-program-to-start pipeline is explained.", "Explain the complete diagnostics, filming, upload, program, and start workflow."),
  c("kickoff.d09.filming_instructions", 9, "Practical filming instructions such as angle or device are provided.", "Explain how the client should film and upload diagnostic videos."),
  c("kickoff.d09.specific_timeline", 9, "Specific deadlines or start dates are stated.", "Add specific deadlines or start dates to the next steps."),
  c("kickoff.d09.client_confirms", 9, "The client confirms or teaches back the non-booking next-step workflow. Accepting a calendar date or time alone does not count.", "Ask the client to confirm the next steps in their own words.", false, 3, {
    requirements: [
      { id: "client_confirmation", description: "The client verbally confirms or teaches back what they will do next." },
      { id: "non_booking_workflow", description: "The confirmation concerns the substantive post-call workflow, not only the next appointment." },
    ],
    excludedInterpretations: ["Accepting a calendar date or time without confirming the non-booking workflow."],
  }),
  c("kickoff.d09.demo_or_screen_share", 9, "A demo or screen share removes remaining process ambiguity.", "Demonstrate the handoff process or show it on screen."),
  c("kickoff.d09.partial_instructions", 9, "Some instructions are present, but important details remain vague.", null),

  c("kickoff.d10.booking_attempted", 10, "The coach makes a concrete attempt to book the next call live.", "Attempt to book the next call before ending."),
  c("kickoff.d10.specific_date", 10, "A specific next-call date is confirmed verbally.", "Confirm a specific date for the next call."),
  c("kickoff.d10.specific_time", 10, "A specific next-call time is confirmed verbally.", "Confirm a specific time for the next call."),
  c("kickoff.d10.client_confirms", 10, "The client verbally accepts the date and time.", "Ask the client to confirm the proposed date and time."),
  c("kickoff.d10.proactive_close", 10, "The coach proactively closes the booking live.", "Proactively lock the next call before the conversation ends."),
  c("kickoff.d10.scheduling_friction_resolved", 10, "Any scheduling or time-zone friction is resolved live.", "Resolve scheduling or time-zone friction during the call."),
  c("kickoff.d10.booking_reference_only", 10, "Booking is only referenced in passing without a concrete live attempt.", null),

  c("kickoff.d11.positive_close", 11, "The call ends positively rather than abruptly.", "End the call with a positive, intentional close."),
  c("kickoff.d11.structured_recap", 11, "During the closing portion, the coach gives a structured recap of at least two distinct substantive topics covered during the call, not only the action list.", "Give a short, structured recap of what was covered.", false, 4, {
    requirements: [
      { id: "closing_recap", description: "The recap occurs during the closing portion after the substantive discussion." },
      { id: "multiple_substantive_topics", description: "The coach summarizes at least two distinct substantive topics already covered, beyond only actions, commitments, or scheduling." },
    ],
    excludedInterpretations: [
      "A mid-call action plan or transition into next steps.",
      "A list or repetition of client and coach commitments only.",
      "A booking confirmation or scheduling summary.",
      "A generic positive close without a recap of substantive topics.",
    ],
  }),
  c("kickoff.d11.confidence_anchor", 11, "The coach explicitly reinforces the client's capability or affirms that they can succeed. Asking for a confidence rating or offering generic plan encouragement does not count.", "Add a clear confidence anchor.", false, 3, {
    requirements: [
      { id: "explicit_capability_affirmation", description: "The coach explicitly states that the client is capable, can succeed, or has demonstrated a reason to believe in their ability." },
    ],
    excludedInterpretations: [
      "Asking the client to rate their own confidence.",
      "Generic encouragement about the plan without affirming the client's capability.",
      "A generic positive word such as great or excellent.",
    ],
  }),
  c("kickoff.d11.emotional_excitement", 11, "The coach expresses specific, earned excitement about the client's journey or progress. A generic approval such as 'excellent' alone does not count.", "Express specific, earned excitement about the client's journey."),

  c("kickoff.d12.first_specific_commitment", 12, "A first distinct future coach action is explicitly promised. An action completed during the call, a client action, or several artifacts bundled into one promised send count as no more than one coach commitment event.", "Make at least one specific post-call commitment.", false, 1, {
    requirements: [
      { id: "coach_owned_future_action", description: "The coach explicitly promises a specific action they will perform after the current call." },
    ],
    excludedInterpretations: [
      "An action completed during the call.",
      "An action owned by the client.",
      "The already-booked next call.",
      "Several artifacts bundled into one promised send as multiple events.",
    ],
  }),
  c("kickoff.d12.second_distinct_commitment", 12, "A second distinct future coach action or event is explicitly promised on a different evidence line from the first commitment.", "Add a second distinct post-call commitment.", false, 1, {
    requirements: [
      { id: "second_coach_owned_future_action", description: "The coach explicitly promises a second coach-owned post-call action distinct from the first event." },
    ],
    excludedInterpretations: [
      "A second artifact included in the same promised send.",
      "An action owned by the client.",
      "The already-booked next call.",
    ],
  }),
  c("kickoff.d12.third_distinct_commitment", 12, "A third distinct future coach action or event is explicitly promised on a third evidence line.", "Add another explicit post-call commitment where useful.", false, 1, {
    requirements: [
      { id: "third_coach_owned_future_action", description: "The coach explicitly promises a third coach-owned post-call action distinct from the first two events." },
    ],
    excludedInterpretations: [
      "Another artifact included in an already-counted promised send.",
      "An action owned by the client.",
      "The already-booked next call.",
    ],
  }),
  c("kickoff.d12.precise_timing_all", 12, "Every verified future coach commitment event has a precise deadline or scheduled time.", "Attach precise timing to every post-call commitment.", false, 3),
  c("kickoff.d12.mostly_precise_timing", 12, "Most, but not all, verified future coach commitment events have a precise deadline or scheduled time.", null, false, 3),
  c("kickoff.d12.vague_follow_up_only", 12, "Only a vague promise to follow up is present.", null),
];

const preparationDetails = [
  "kickoff.d01.specific_goal_from_notes_early",
  "kickoff.d01.pain_or_injury_from_notes_early",
  "kickoff.d01.history_or_context_from_notes_early",
] as const;
const agendaPhases = [
  "kickoff.d03.phase_connection",
  "kickoff.d03.phase_goals",
  "kickoff.d03.phase_program_or_support",
  "kickoff.d03.phase_actions_or_booking",
] as const;

export function scoreKickoffD01(f: CriterionView): number {
  const details = f.count(preparationDetails);
  if (details >= 2 && f.present("kickoff.d01.client_name_used_early")) {
    return f.present("kickoff.d01.notes_acknowledged") ? 10 : 9;
  }
  if (details > 0) return details >= 2 ? 8 : f.present("kickoff.d01.redundant_discovery_reset") ? 6 : 7;
  if (f.present("kickoff.d01.partial_note_reference_early") || f.present("kickoff.d01.notes_acknowledged")) return 4;
  return 0;
}

export function scoreKickoffD02(f: CriterionView): number {
  if (["warm_calm_tone", "personalized_interaction", "energy_matched", "personal_relevant_disclosure", "client_opens_spontaneously"].every((id) => f.present(`kickoff.d02.${id}`))) return 10;
  if (f.present("kickoff.d02.warm_calm_tone") && (f.present("kickoff.d02.personalized_interaction") || f.present("kickoff.d02.client_opens_spontaneously"))) return 7;
  if (f.present("kickoff.d02.warm_calm_tone") || f.present("kickoff.d02.friendly_but_transactional")) return 3;
  return 0;
}

export function scoreKickoffD03(f: CriterionView): number {
  const phaseCount = f.count(agendaPhases);
  const time = f.present("kickoff.d03.explicit_time_framing");
  const consent = f.present("kickoff.d03.client_verbal_consent");
  if (time && phaseCount >= 3 && consent) return f.present("kickoff.d03.crisp_delivery") ? 5 : 4.5;
  if (f.present("kickoff.d03.agenda_mentioned")) {
    const satisfied = [time, phaseCount >= 3, consent].filter(Boolean).length;
    if (satisfied === 2) return 3.5;
    if (satisfied === 1) return 3;
    return 2.5;
  }
  return f.present("kickoff.d03.fragmented_mention_only") ? 1 : 0;
}

export function scoreKickoffD04(f: CriterionView): number {
  const elite = f.present("kickoff.d04.functional_goal") && f.present("kickoff.d04.why_follow_up_one") && f.present("kickoff.d04.why_follow_up_two") && f.present("kickoff.d04.emotional_or_identity_driver") && f.present("kickoff.d04.north_star_constructed") && f.present("kickoff.d04.thirty_day_metric") && f.present("kickoff.d04.client_confirms_north_star");
  if (elite) return 15;
  if (f.present("kickoff.d04.functional_goal") && f.present("kickoff.d04.why_follow_up_one") && f.present("kickoff.d04.emotional_or_identity_driver")) return 10;
  return f.present("kickoff.d04.functional_goal") ? 5 : 0;
}

export function scoreKickoffD05(f: CriterionView): number {
  const phases = f.count(["kickoff.d05.phase_retraining", "kickoff.d05.phase_remodeling", "kickoff.d05.phase_integrating"]);
  if (phases === 3 && f.present("kickoff.d05.correct_order")) {
    const eliteExtras = f.count(["kickoff.d05.outcomes_explained", "kickoff.d05.analogy_or_reassessment", "kickoff.d05.tied_to_client_goal", "kickoff.d05.client_understands"]);
    if (eliteExtras === 4) return 10;
    if (eliteExtras >= 3) return 9;
    return Math.min(8, 6 + eliteExtras);
  }
  if (phases >= 1) return phases === 2 ? 5 : 3;
  return f.present("kickoff.d05.generic_phase_reference") ? 1 : 0;
}

export function scoreKickoffD06(f: CriterionView): number {
  if (["timeline_or_milestones", "emotional_friction_normalized", "valley_timing", "good_vs_bad_pain", "first_month_foundational", "north_star_link"].every((id) => f.present(`kickoff.d06.${id}`))) return 10;
  if (f.present("kickoff.d06.basic_expectations") && f.present("kickoff.d06.timeline_or_milestones") && f.present("kickoff.d06.physical_discomfort_normalized")) return 7;
  return f.present("kickoff.d06.basic_expectations") ? 3 : 0;
}

export function scoreKickoffD07(f: CriterionView): number {
  if (["primary_channel", "response_time", "community_access", "accountability_style", "client_understands"].every((id) => f.present(`kickoff.d07.${id}`))) return 5;
  return f.present("kickoff.d07.support_mentioned") || f.present("kickoff.d07.primary_channel") ? 3 : 0;
}

export function scoreKickoffD08(f: CriterionView): number {
  if (["behavioral_patterns", "consistency_triggers", "learning_style", "stress_response", "uses_answers_to_personalize", "archetype_signals"].every((id) => f.present(`kickoff.d08.${id}`))) return 10;
  if (f.count(["kickoff.d08.behavioral_patterns", "kickoff.d08.consistency_triggers", "kickoff.d08.learning_style", "kickoff.d08.stress_response"]) >= 1) return 7;
  return f.present("kickoff.d08.generic_questions_only") ? 3 : 0;
}

export function scoreKickoffD09(f: CriterionView): number {
  if (["clear_next_steps", "diagnostics_pipeline", "filming_instructions", "specific_timeline", "client_confirms", "demo_or_screen_share"].every((id) => f.present(`kickoff.d09.${id}`))) return 10;
  if (f.present("kickoff.d09.clear_next_steps") && f.present("kickoff.d09.specific_timeline") && f.present("kickoff.d09.client_confirms")) return 7;
  return f.present("kickoff.d09.partial_instructions") || f.present("kickoff.d09.clear_next_steps") ? 3 : 0;
}

export function scoreKickoffD10(f: CriterionView): number {
  const locked = f.present("kickoff.d10.specific_date") && f.present("kickoff.d10.specific_time") && f.present("kickoff.d10.client_confirms");
  if (locked) return f.present("kickoff.d10.proactive_close") ? 5 : 4.5;
  if (f.present("kickoff.d10.booking_attempted")) return f.present("kickoff.d10.specific_date") || f.present("kickoff.d10.specific_time") ? 3.5 : 2.5;
  return f.present("kickoff.d10.booking_reference_only") ? 1 : 0;
}

export function scoreKickoffD11(f: CriterionView): number {
  if (["positive_close", "structured_recap", "confidence_anchor", "emotional_excitement"].every((id) => f.present(`kickoff.d11.${id}`))) return 5;
  return f.present("kickoff.d11.positive_close") ? 3 : 0;
}

export function scoreKickoffD12(f: CriterionView): number {
  const commitmentCount = f.present("kickoff.d12.third_distinct_commitment")
    ? 3
    : f.present("kickoff.d12.second_distinct_commitment")
      ? 2
      : f.present("kickoff.d12.first_specific_commitment")
        ? 1
        : 0;
  const precise = f.present("kickoff.d12.precise_timing_all");
  const mostlyPrecise = f.present("kickoff.d12.mostly_precise_timing");
  if (commitmentCount >= 3 && precise) return 5;
  if (commitmentCount >= 2 && precise) return 4.5;
  if (commitmentCount >= 2 && mostlyPrecise) return 4;
  if (commitmentCount >= 2) return 3;
  if (commitmentCount === 1) return precise || mostlyPrecise ? 3 : 2;
  return f.present("kickoff.d12.vague_follow_up_only") ? 1 : 0;
}

export const KICKOFF_SCORING_RULES: readonly DimensionScoringRule[] = [
  scoreKickoffD01, scoreKickoffD02, scoreKickoffD03, scoreKickoffD04,
  scoreKickoffD05, scoreKickoffD06, scoreKickoffD07, scoreKickoffD08,
  scoreKickoffD09, scoreKickoffD10, scoreKickoffD11, scoreKickoffD12,
].map((score, index) => ({ dimensionId: index + 1, score }));
