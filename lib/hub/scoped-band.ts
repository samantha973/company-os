// The hub band's tallies under a plan scope. pr_program_stats is all-time;
// when the reader picks a quarter the band must count only what fell in it,
// so the page re-derives the four tiles from the already-loaded rows.
// Client-safe (types only).

import type { ProgramSummary } from "@/lib/hub/program";
import type { PlanTarget, QuarterlyPlan } from "@/lib/hub/plan";
import { targetOnTrack } from "@/lib/hub/plan";
import { AWARD_IN_FLIGHT, scopeAwards, scopeOutcomes, type PlanScope } from "@/lib/hub/scope";

export function scopeProgramSummary(
  program: ProgramSummary,
  scope: PlanScope,
  data: {
    outcomes: Array<{ kind: "coverage" | "linkedin"; publishedAt: string | null; publishDate: string | null; createdAt: string }>;
    awards: Array<{ stage: string; quarterlyPlanId: string | null; entryClose: string | null; eventDate: string | null; createdAt: string }>;
    plan: { selected: QuarterlyPlan | null; targets: PlanTarget[] } | null;
  },
): ProgramSummary {
  const outcomes = scopeOutcomes(data.outcomes, scope).filter((o) => o.publishedAt);
  const awards = scopeAwards(data.awards, scope);
  const selected = data.plan?.selected ?? null;
  const targets = data.plan?.targets ?? [];
  return {
    ...program,
    stats: {
      ...program.stats,
      coverageCount: outcomes.filter((o) => o.kind === "coverage").length,
      linkedinPostCount: outcomes.filter((o) => o.kind === "linkedin").length,
      awardsInFlight: awards.filter((a) => AWARD_IN_FLIGHT.has(a.stage)).length,
    },
    currentPlan: selected
      ? {
          id: selected.id,
          quarterLabel: selected.quarter_label,
          startsOn: selected.starts_on,
          endsOn: selected.ends_on,
          publishedAt: selected.published_at,
          targetsTotal: targets.length,
          targetsOnTrack: targets.filter(targetOnTrack).length,
          targetsWithVariance: targets.filter((t) => !!t.variance_reason).length,
        }
      : program.currentPlan,
  };
}
