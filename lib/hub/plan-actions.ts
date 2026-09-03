// Auth-agnostic write cores for 90-day plans, their targets and workstreams.
// Callers (admin and team server actions) gate authorization and pass the
// company id they verified. Every write is company-scoped in the query,
// audited, and sets updated_at (no triggers on these tables).

import { companyOs } from "@/lib/supabase";
import { recordAudit } from "@/lib/admin/audit";
import type { Result } from "@/lib/admin/mutations";
import { BACKLOG_STATUSES } from "@/lib/client-backlog";
import { isOneOf, VARIANCE_REASONS } from "@/lib/pr/enums";

const PLANS = "pr_quarterly_plans";
const TARGETS = "client_backlog_items";
const GROUPS = "client_roadmap_groups";

export type PlanInput = {
  quarter_label: string;
  starts_on: string;
  ends_on: string;
  planning_meeting_id?: string | null;
  business_objective?: string | null;
  comms_objective?: string | null;
};

export type PlanPatch = Partial<
  PlanInput & { approved_plan_md: string | null; signoff_date: string | null }
>;

export type TargetInput = {
  group_key: string;
  title: string;
  quantity_target?: number | null;
  status?: string;
};

export type TargetPatch = Partial<{
  title: string;
  group_key: string;
  quantity_target: number | null;
  status: string;
  variance_reason: string | null;
  variance_note: string | null;
}>;

// The server-action surface every plan UI binds to (companyId pre-bound).
export type PlanActions = {
  createPlan: (programId: string, input: PlanInput) => Promise<Result & { id?: string }>;
  updatePlan: (planId: string, patch: PlanPatch) => Promise<Result>;
  publishPlan: (planId: string, published: boolean) => Promise<Result>;
  createTarget: (planId: string, input: TargetInput) => Promise<Result & { id?: string }>;
  updateTarget: (targetId: string, patch: TargetPatch) => Promise<Result>;
  archiveTarget: (targetId: string) => Promise<Result>;
  createWorkstream: (programId: string, title: string) => Promise<Result>;
};

type Ctx = { actor: string };

function nul(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function programBelongs(companyId: string, programId: string): Promise<boolean> {
  const { data } = await companyOs.from("pr_programs").select("id").eq("id", programId).eq("company_id", companyId).maybeSingle();
  return !!data;
}

async function meetingBelongs(companyId: string, meetingId: string): Promise<boolean> {
  const { data } = await companyOs.from("meetings").select("id").eq("id", meetingId).eq("company_id", companyId).is("archived_at", null).maybeSingle();
  return !!data;
}

async function groupExists(companyId: string, key: string): Promise<boolean> {
  const { data } = await companyOs.from(GROUPS).select("id").eq("company_id", companyId).eq("key", key).is("archived_at", null).maybeSingle();
  return !!data;
}

async function planRow(companyId: string, planId: string): Promise<{ id: string; pr_program_id: string } | null> {
  const { data } = await companyOs.from(PLANS).select("id, pr_program_id").eq("id", planId).eq("company_id", companyId).is("archived_at", null).maybeSingle();
  return (data as { id: string; pr_program_id: string } | null) ?? null;
}

export async function createPlanCore(companyId: string, programId: string, input: PlanInput, ctx: Ctx): Promise<Result & { id?: string }> {
  if (!(await programBelongs(companyId, programId))) return { ok: false, error: "Program not found." };
  const label = nul(input.quarter_label);
  if (!label) return { ok: false, error: "Name the quarter (e.g. Q2 FY27)." };
  if (!DATE.test(input.starts_on) || !DATE.test(input.ends_on)) return { ok: false, error: "Start and end dates are required." };
  if (input.ends_on < input.starts_on) return { ok: false, error: "The quarter must end after it starts." };
  const meeting = nul(input.planning_meeting_id);
  if (meeting && !(await meetingBelongs(companyId, meeting))) return { ok: false, error: "That meeting is not this client's." };

  const row = {
    pr_program_id: programId,
    company_id: companyId,
    quarter_label: label,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
    planning_meeting_id: meeting,
    business_objective: nul(input.business_objective),
    comms_objective: nul(input.comms_objective),
    created_by: ctx.actor,
  };
  const { data, error } = await companyOs.from(PLANS).insert(row).select("id").single();
  if (error) return { ok: false, error: error.message.includes("pr_quarterly_plans_program_quarter_key") ? "A plan for that quarter already exists." : error.message };
  await recordAudit({ table: PLANS, recordId: data.id, operation: "insert", actor: ctx.actor, newData: row });
  return { ok: true, id: data.id };
}

export async function updatePlanCore(companyId: string, planId: string, patch: PlanPatch, ctx: Ctx): Promise<Result> {
  if (!(await planRow(companyId, planId))) return { ok: false, error: "Plan not found." };
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.quarter_label !== undefined) {
    const label = nul(patch.quarter_label);
    if (!label) return { ok: false, error: "Name the quarter." };
    updates.quarter_label = label;
  }
  for (const k of ["starts_on", "ends_on", "signoff_date"] as const) {
    if (patch[k] !== undefined) {
      const v = nul(patch[k]);
      if (v && !DATE.test(v)) return { ok: false, error: "Dates must be YYYY-MM-DD." };
      if (k !== "signoff_date" && !v) return { ok: false, error: "Start and end dates are required." };
      updates[k] = v;
    }
  }
  if (patch.planning_meeting_id !== undefined) {
    const m = nul(patch.planning_meeting_id);
    if (m && !(await meetingBelongs(companyId, m))) return { ok: false, error: "That meeting is not this client's." };
    updates.planning_meeting_id = m;
  }
  for (const k of ["business_objective", "comms_objective", "approved_plan_md"] as const) {
    if (patch[k] !== undefined) updates[k] = nul(patch[k]);
  }
  const { error } = await companyOs.from(PLANS).update(updates).eq("id", planId).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: PLANS, recordId: planId, operation: "update", actor: ctx.actor, newData: updates });
  return { ok: true };
}

export async function publishPlanCore(companyId: string, planId: string, published: boolean, ctx: Ctx): Promise<Result> {
  if (!(await planRow(companyId, planId))) return { ok: false, error: "Plan not found." };
  const updates = { published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
  const { error } = await companyOs.from(PLANS).update(updates).eq("id", planId).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: PLANS, recordId: planId, operation: "update", actor: ctx.actor, context: { action: "set_published", published } });
  return { ok: true };
}

export async function createTargetCore(companyId: string, planId: string, input: TargetInput, ctx: Ctx): Promise<Result & { id?: string }> {
  const plan = await planRow(companyId, planId);
  if (!plan) return { ok: false, error: "Plan not found." };
  const title = nul(input.title);
  if (!title) return { ok: false, error: "Describe the target." };
  if (!(await groupExists(companyId, input.group_key))) return { ok: false, error: "Pick a workstream." };
  if (input.status && !isOneOf(BACKLOG_STATUSES, input.status)) return { ok: false, error: "Invalid status." };
  const qty = input.quantity_target == null || input.quantity_target === ("" as unknown) ? null : Number(input.quantity_target);
  if (qty !== null && (!Number.isInteger(qty) || qty < 0)) return { ok: false, error: "Target must be a whole number." };

  const row = {
    company_id: companyId,
    pr_program_id: plan.pr_program_id,
    quarterly_plan_id: planId,
    group_key: input.group_key,
    title,
    quantity_target: qty,
    status: input.status ?? "accepted",
    source: "edge8" as const,
    sort_order: 999,
  };
  const { data, error } = await companyOs.from(TARGETS).insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TARGETS, recordId: data.id, operation: "insert", actor: ctx.actor, newData: row });
  return { ok: true, id: data.id };
}

export async function updateTargetCore(companyId: string, targetId: string, patch: TargetPatch, ctx: Ctx): Promise<Result> {
  const { data: t } = await companyOs.from(TARGETS).select("id").eq("id", targetId).eq("company_id", companyId).is("archived_at", null).maybeSingle();
  if (!t) return { ok: false, error: "Target not found." };
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const title = nul(patch.title);
    if (!title) return { ok: false, error: "Describe the target." };
    updates.title = title;
  }
  if (patch.group_key !== undefined) {
    if (!(await groupExists(companyId, patch.group_key))) return { ok: false, error: "Pick a workstream." };
    updates.group_key = patch.group_key;
  }
  if (patch.quantity_target !== undefined) {
    const q = patch.quantity_target === null || (patch.quantity_target as unknown) === "" ? null : Number(patch.quantity_target);
    if (q !== null && (!Number.isInteger(q) || q < 0)) return { ok: false, error: "Target must be a whole number." };
    updates.quantity_target = q;
  }
  if (patch.status !== undefined) {
    if (!isOneOf(BACKLOG_STATUSES, patch.status)) return { ok: false, error: "Invalid status." };
    updates.status = patch.status;
  }
  if (patch.variance_reason !== undefined) {
    const r = nul(patch.variance_reason);
    if (r && !isOneOf(VARIANCE_REASONS, r)) return { ok: false, error: "Invalid variance reason." };
    updates.variance_reason = r;
  }
  if (patch.variance_note !== undefined) updates.variance_note = nul(patch.variance_note);

  const { error } = await companyOs.from(TARGETS).update(updates).eq("id", targetId).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TARGETS, recordId: targetId, operation: "update", actor: ctx.actor, newData: updates });
  return { ok: true };
}

export async function archiveTargetCore(companyId: string, targetId: string, ctx: Ctx): Promise<Result> {
  const updates = { archived_at: new Date().toISOString(), archived_by: ctx.actor, updated_at: new Date().toISOString() };
  const { data, error } = await companyOs.from(TARGETS).update(updates).eq("id", targetId).eq("company_id", companyId).is("archived_at", null).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Target not found." };
  await recordAudit({ table: TARGETS, recordId: targetId, operation: "archive", actor: ctx.actor });
  return { ok: true };
}

function slugKey(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export async function createWorkstreamCore(companyId: string, programId: string, title: string, ctx: Ctx): Promise<Result> {
  if (!(await programBelongs(companyId, programId))) return { ok: false, error: "Program not found." };
  const t = nul(title);
  if (!t) return { ok: false, error: "Name the workstream." };
  const key = slugKey(t);
  if (!key) return { ok: false, error: "Name the workstream." };
  if (await groupExists(companyId, key)) return { ok: false, error: "That workstream already exists." };
  const { data: last } = await companyOs.from(GROUPS).select("sort_order").eq("company_id", companyId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const row = { company_id: companyId, pr_program_id: programId, key, title: t, sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1 };
  const { data, error } = await companyOs.from(GROUPS).insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: GROUPS, recordId: data.id, operation: "insert", actor: ctx.actor, newData: row });
  return { ok: true };
}
