// 90-day plan readers. A plan is a company_os.pr_quarterly_plans row; its
// targets are client_backlog_items with quarterly_plan_id set; progress per
// target comes from the pr_target_progress view. Same discipline as
// lib/hub/program.ts: companyId in, never widen scope; the caller gates.

import { companyOs } from "@/lib/supabase";
import { BACKLOG_SELECT, type BacklogItem } from "@/lib/client-backlog";

export const PLAN_SELECT =
  "id, pr_program_id, company_id, quarter_label, starts_on, ends_on, planning_meeting_id, business_objective, comms_objective, approved_plan_md, signoff_date, published_at, created_by, created_at, updated_at";

export type QuarterlyPlan = {
  id: string;
  pr_program_id: string;
  company_id: string;
  quarter_label: string;
  starts_on: string;
  ends_on: string;
  planning_meeting_id: string | null;
  business_objective: string | null;
  comms_objective: string | null;
  approved_plan_md: string | null;
  signoff_date: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TargetProgress = {
  outcome_count: number;
  task_count: number;
  task_done_count: number;
};

export type PlanTarget = BacklogItem & { progress: TargetProgress };

// A target is on track unless it is parked or carries a variance.
export function targetOnTrack(t: { status: string; variance_reason: string | null }): boolean {
  return t.status !== "parked" && !t.variance_reason;
}

export function targetDone(t: Pick<PlanTarget, "status" | "quantity_target" | "progress">): boolean {
  if (t.status === "shipped") return true;
  return t.quantity_target != null && t.quantity_target > 0 && t.progress.outcome_count >= t.quantity_target;
}

// The plan whose quarter contains `today`, else the most recent one. Archived
// rows are never returned.
export function pickCurrentPlan(plans: QuarterlyPlan[], today = new Date()): QuarterlyPlan | null {
  const iso = today.toISOString().slice(0, 10);
  const live = plans.find((p) => p.starts_on <= iso && p.ends_on >= iso);
  if (live) return live;
  return [...plans].sort((a, b) => (a.starts_on < b.starts_on ? 1 : -1))[0] ?? null;
}

export async function listPlans(
  companyId: string,
  programId: string,
  opts?: { publishedOnly?: boolean },
): Promise<QuarterlyPlan[]> {
  let q = companyOs
    .from("pr_quarterly_plans")
    .select(PLAN_SELECT)
    .eq("company_id", companyId)
    .eq("pr_program_id", programId)
    .is("archived_at", null)
    .order("starts_on", { ascending: false });
  if (opts?.publishedOnly) q = q.not("published_at", "is", null);
  const { data } = await q;
  return (data ?? []) as unknown as QuarterlyPlan[];
}

export async function getPlan(companyId: string, planId: string): Promise<QuarterlyPlan | null> {
  const { data } = await companyOs
    .from("pr_quarterly_plans")
    .select(PLAN_SELECT)
    .eq("id", planId)
    .eq("company_id", companyId)
    .is("archived_at", null)
    .maybeSingle();
  return (data as unknown as QuarterlyPlan | null) ?? null;
}

// Targets for a plan, with progress from the view, in workstream/sort order.
export async function getPlanTargets(companyId: string, planId: string): Promise<PlanTarget[]> {
  const [{ data: items }, { data: progress }] = await Promise.all([
    companyOs
      .from("client_backlog_items")
      .select(BACKLOG_SELECT)
      .eq("company_id", companyId)
      .eq("quarterly_plan_id", planId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("id"),
    companyOs
      .from("pr_target_progress")
      .select("backlog_item_id, outcome_count, task_count, task_done_count")
      .eq("quarterly_plan_id", planId),
  ]);
  const byId = new Map(
    ((progress ?? []) as Array<{ backlog_item_id: string } & TargetProgress>).map((p) => [
      p.backlog_item_id,
      { outcome_count: p.outcome_count, task_count: p.task_count, task_done_count: p.task_done_count },
    ]),
  );
  return ((items ?? []) as unknown as BacklogItem[]).map((i) => ({
    ...i,
    progress: byId.get(i.id) ?? { outcome_count: 0, task_count: 0, task_done_count: 0 },
  }));
}

export type PlanSnapshot = {
  id: string;
  quarterLabel: string;
  startsOn: string;
  endsOn: string;
  publishedAt: string | null;
  targetsTotal: number;
  targetsOnTrack: number;
  targetsWithVariance: number;
};

// One snapshot per program for a company: the current plan and its target
// tallies, for the hub band. Empty map when nothing is planned yet.
export async function getCurrentPlanSnapshots(
  companyId: string,
  opts?: { publishedOnly?: boolean },
): Promise<Map<string, PlanSnapshot>> {
  let q = companyOs
    .from("pr_quarterly_plans")
    .select(PLAN_SELECT)
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("starts_on", { ascending: false });
  if (opts?.publishedOnly) q = q.not("published_at", "is", null);
  const { data } = await q;
  const plans = (data ?? []) as unknown as QuarterlyPlan[];
  if (plans.length === 0) return new Map();

  const byProgram = new Map<string, QuarterlyPlan[]>();
  for (const p of plans) {
    const list = byProgram.get(p.pr_program_id) ?? [];
    list.push(p);
    byProgram.set(p.pr_program_id, list);
  }
  const current = [...byProgram.entries()]
    .map(([programId, list]) => [programId, pickCurrentPlan(list)] as const)
    .filter((e): e is readonly [string, QuarterlyPlan] => e[1] !== null);
  if (current.length === 0) return new Map();

  const { data: targets } = await companyOs
    .from("client_backlog_items")
    .select("id, quarterly_plan_id, status, variance_reason")
    .eq("company_id", companyId)
    .in("quarterly_plan_id", current.map(([, p]) => p.id))
    .is("archived_at", null);
  const rows = (targets ?? []) as Array<{ quarterly_plan_id: string; status: string; variance_reason: string | null }>;

  const out = new Map<string, PlanSnapshot>();
  for (const [programId, plan] of current) {
    const mine = rows.filter((r) => r.quarterly_plan_id === plan.id);
    out.set(programId, {
      id: plan.id,
      quarterLabel: plan.quarter_label,
      startsOn: plan.starts_on,
      endsOn: plan.ends_on,
      publishedAt: plan.published_at,
      targetsTotal: mine.length,
      targetsOnTrack: mine.filter(targetOnTrack).length,
      targetsWithVariance: mine.filter((t) => !!t.variance_reason).length,
    });
  }
  return out;
}
