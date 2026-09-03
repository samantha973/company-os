// PR Hub vocabularies. Client-safe (no server-only deps). Each tuple mirrors a
// CHECK constraint in supabase/pr-hub/*.sql; keep them in lockstep. Pattern
// from lib/client-backlog.ts: `as const` tuple, derived type, label map.

export const PROGRAM_STATUSES = ["draft", "active", "paused", "complete"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const PROGRAM_HEALTH = ["green", "amber", "red"] as const;
export type ProgramHealth = (typeof PROGRAM_HEALTH)[number];
export const PROGRAM_HEALTH_LABEL: Record<ProgramHealth, string> = {
  green: "Green",
  amber: "Amber",
  red: "Red",
};

// Workstream keys match the client_roadmap_groups rows seed_pr_workstreams()
// inserts (hyphenated, historical).
export const WORKSTREAMS = [
  "news-announcements",
  "thought-leadership",
  "newsjacking",
  "linkedin-authority",
  "speaking",
  "awards",
] as const;
export type Workstream = (typeof WORKSTREAMS)[number];
export const WORKSTREAM_LABEL: Record<Workstream, string> = {
  "news-announcements": "News Announcements",
  "thought-leadership": "Thought Leadership",
  newsjacking: "Media Relations & Newsjacking",
  "linkedin-authority": "LinkedIn",
  speaking: "Speaking",
  awards: "Awards",
};

// tasks.metadata.pr.type — what kind of PR effort a board card is.
export const PR_TASK_TYPES = ["announcement", "proactive_pitch", "reactive", "newsjack", "linkedin", "award", "speaking", "other"] as const;
export type PrTaskType = (typeof PR_TASK_TYPES)[number];
export const PR_TASK_TYPE_LABEL: Record<PrTaskType, string> = {
  announcement: "Announcement",
  proactive_pitch: "Proactive pitch",
  reactive: "Reactive",
  newsjack: "Newsjack",
  linkedin: "LinkedIn",
  award: "Award",
  speaking: "Speaking",
  other: "Other",
};

export const VARIANCE_REASONS = ["client_delayed", "deal_not_finalised", "reprioritised", "external", "other"] as const;
export type VarianceReason = (typeof VARIANCE_REASONS)[number];
export const VARIANCE_REASON_LABEL: Record<VarianceReason, string> = {
  client_delayed: "Client delayed",
  deal_not_finalised: "Deal not finalised",
  reprioritised: "Reprioritised",
  external: "External",
  other: "Other",
};

export const AWARD_STAGES = ["proposed", "agreed", "submitted", "shortlisted", "won", "lost", "withdrawn"] as const;
export type AwardStage = (typeof AWARD_STAGES)[number];
export const AWARD_STAGE_LABEL: Record<AwardStage, string> = {
  proposed: "Proposed",
  agreed: "Agreed",
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  won: "Won",
  lost: "Not won",
  withdrawn: "Withdrawn",
};
// Stages the hub band counts as "in flight".
export const AWARD_IN_FLIGHT: readonly AwardStage[] = ["agreed", "submitted", "shortlisted"];

export const PIPELINE_STATUSES = ["logged", "candidate", "promoted", "parked"] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];
export const PIPELINE_STATUS_LABEL: Record<PipelineStatus, string> = {
  logged: "Logged",
  candidate: "Candidate",
  promoted: "Promoted",
  parked: "Parked",
};

export const CASE_STUDY_STATUSES = ["proposed", "in_progress", "approved", "used"] as const;
export type CaseStudyStatus = (typeof CASE_STUDY_STATUSES)[number];
export const CASE_STUDY_STATUS_LABEL: Record<CaseStudyStatus, string> = {
  proposed: "Proposed",
  in_progress: "In progress",
  approved: "Approved",
  used: "Used",
};

// marketing_content.channel values that count as earned coverage. LinkedIn
// posts are channel='linkedin' on the same table.
export const COVERAGE_CHANNELS = ["earned", "online", "print", "tv", "radio", "podcast", "syndication", "speaking", "other"] as const;
export type CoverageChannel = (typeof COVERAGE_CHANNELS)[number];
export const COVERAGE_CHANNEL_LABEL: Record<CoverageChannel | "linkedin", string> = {
  earned: "Earned",
  online: "Online",
  print: "Print",
  tv: "TV",
  radio: "Radio",
  podcast: "Podcast",
  syndication: "Syndication",
  speaking: "Speaking",
  other: "Other",
  linkedin: "LinkedIn",
};

export const TOUCHPOINT_KINDS = ["meeting", "call", "lunch", "gift", "catchup", "note"] as const;
export type TouchpointKind = (typeof TOUCHPOINT_KINDS)[number];
export const TOUCHPOINT_KIND_LABEL: Record<TouchpointKind, string> = {
  meeting: "Meeting",
  call: "Call",
  lunch: "Lunch",
  gift: "Gift",
  catchup: "Catch-up",
  note: "Note",
};
// Kinds that count as a formal catch-up on the hub band (mirrors the view).
export const FORMAL_TOUCHPOINTS: readonly TouchpointKind[] = ["meeting", "lunch", "catchup"];

export function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}
