// Client-facing 90-day plan. Company-scoped through portalRead, and ONLY
// published plans (published_at set) ever leave this module — a draft the
// team is still writing is invisible to the client. Targets carry the
// variance reason + note by design: that is the honest context the client
// hub promises.

import type { PortalActor } from "@/lib/portal-auth";
import { portalRead } from "@/lib/portal/data";
import { getPlanTargets, pickCurrentPlan, PLAN_SELECT, type PlanTarget, type QuarterlyPlan } from "@/lib/hub/plan";
import { ROADMAP_GROUPS_SELECT, type RoadmapGroup } from "@/lib/client-backlog";

export type PortalPlanTab = {
  companyId: string;
  programId: string;
  plans: QuarterlyPlan[];
  selected: QuarterlyPlan | null;
  targets: PlanTarget[];
  groups: RoadmapGroup[];
};

export async function hasPublishedPlan(actor: PortalActor): Promise<boolean> {
  if (actor.companyScope.length === 0) return false;
  const { data } = await portalRead(actor, "pr_quarterly_plans", "id").not("published_at", "is", null).is("archived_at", null).limit(1);
  return (data ?? []).length > 0;
}

export async function getPlanTabForActor(actor: PortalActor, planId?: string | null): Promise<PortalPlanTab | null> {
  if (actor.companyScope.length === 0) return null;
  const { data } = await portalRead(actor, "pr_quarterly_plans", PLAN_SELECT)
    .not("published_at", "is", null)
    .is("archived_at", null)
    .order("starts_on", { ascending: false });
  const plans = (data ?? []) as unknown as QuarterlyPlan[];
  if (plans.length === 0) return null;

  const selected = (planId && plans.find((p) => p.id === planId)) || pickCurrentPlan(plans);
  if (!selected) return null;

  const [targets, { data: groupData }] = await Promise.all([
    getPlanTargets(selected.company_id, selected.id),
    portalRead(actor, "client_roadmap_groups", ROADMAP_GROUPS_SELECT).is("archived_at", null).order("sort_order", { ascending: true }),
  ]);
  const groups = ((groupData ?? []) as unknown as RoadmapGroup[]).filter(
    (g) => g.company_id === selected.company_id && (g.pr_program_id === null || g.pr_program_id === selected.pr_program_id),
  );
  return {
    companyId: selected.company_id,
    programId: selected.pr_program_id,
    plans: plans.filter((p) => p.pr_program_id === selected.pr_program_id),
    selected,
    targets,
    groups,
  };
}
