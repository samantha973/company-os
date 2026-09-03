// Auth-agnostic write cores for awards, the news pipeline, case studies and
// touchpoints. Callers gate authorization and pass the verified company id.
// Every write is company-scoped in the query, audited, and sets updated_at.

import { companyOs } from "@/lib/supabase";
import { recordAudit } from "@/lib/admin/audit";
import type { Result } from "@/lib/admin/mutations";
import { AWARD_STAGES, CASE_STUDY_STATUSES, isOneOf, PIPELINE_STATUSES, TOUCHPOINT_KINDS } from "@/lib/pr/enums";

type Ctx = { actor: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function nul(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}
function dateOrErr(v: unknown, label: string): string | null | undefined {
  const d = nul(v);
  if (d && !DATE.test(d)) return undefined;
  return d;
}

async function programBelongs(companyId: string, programId: string): Promise<boolean> {
  const { data } = await companyOs.from("pr_programs").select("id").eq("id", programId).eq("company_id", companyId).maybeSingle();
  return !!data;
}
async function rowOf(table: string, companyId: string, id: string): Promise<Record<string, unknown> | null> {
  const { data } = await companyOs.from(table).select("*").eq("id", id).eq("company_id", companyId).is("archived_at", null).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}
async function planBelongs(companyId: string, id: string): Promise<boolean> {
  const { data } = await companyOs.from("pr_quarterly_plans").select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
  return !!data;
}
async function documentBelongs(companyId: string, id: string): Promise<boolean> {
  const { data } = await companyOs.from("program_documents").select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
  return !!data;
}

async function setPublished(table: string, companyId: string, id: string, published: boolean, ctx: Ctx): Promise<Result> {
  if (!(await rowOf(table, companyId, id))) return { ok: false, error: "Not found." };
  const updates = { published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
  const { error } = await companyOs.from(table).update(updates).eq("id", id).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table, recordId: id, operation: "update", actor: ctx.actor, context: { action: "set_published", published } });
  return { ok: true };
}
async function archiveRow(table: string, companyId: string, id: string, ctx: Ctx): Promise<Result> {
  const updates = { archived_at: new Date().toISOString(), archived_by: ctx.actor, updated_at: new Date().toISOString() };
  const { data, error } = await companyOs.from(table).update(updates).eq("id", id).eq("company_id", companyId).is("archived_at", null).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Not found." };
  await recordAudit({ table, recordId: id, operation: "archive", actor: ctx.actor });
  return { ok: true };
}

// ── Awards ────────────────────────────────────────────────────────────────
export type AwardInput = {
  awardName: string;
  category?: string | null;
  website?: string | null;
  stage?: string;
  entryClose?: string | null;
  eventDate?: string | null;
  quarterlyPlanId?: string | null;
};
export type AwardPatch = Partial<AwardInput & { submissionDocumentId: string | null; costCents: number | null; outcomeNote: string | null }>;

async function awardColumns(companyId: string, p: AwardPatch): Promise<Record<string, unknown> | string> {
  const out: Record<string, unknown> = {};
  if (p.awardName !== undefined) {
    const n = nul(p.awardName);
    if (!n) return "Name the award.";
    out.award_name = n;
  }
  if (p.category !== undefined) out.category = nul(p.category);
  if (p.website !== undefined) out.website = nul(p.website);
  if (p.stage !== undefined) {
    if (!isOneOf(AWARD_STAGES, p.stage)) return "Invalid stage.";
    out.stage = p.stage;
  }
  for (const [k, col] of [["entryClose", "entry_close"], ["eventDate", "event_date"]] as const) {
    if (p[k] !== undefined) {
      const d = dateOrErr(p[k], k);
      if (d === undefined) return "Dates must be YYYY-MM-DD.";
      out[col] = d;
    }
  }
  if (p.quarterlyPlanId !== undefined) {
    const id = nul(p.quarterlyPlanId);
    if (id && !(await planBelongs(companyId, id))) return "That plan is not this client's.";
    out.quarterly_plan_id = id;
  }
  if (p.submissionDocumentId !== undefined) {
    const id = nul(p.submissionDocumentId);
    if (id && !(await documentBelongs(companyId, id))) return "That document is not this client's.";
    out.submission_document_id = id;
  }
  if (p.costCents !== undefined) {
    if (p.costCents === null || (p.costCents as unknown) === "") out.cost_cents = null;
    else {
      const n = Number(p.costCents);
      if (!Number.isFinite(n) || n < 0) return "Cost must be a number.";
      out.cost_cents = Math.round(n);
    }
  }
  if (p.outcomeNote !== undefined) out.outcome_note = nul(p.outcomeNote);
  return out;
}

export async function createAwardCore(companyId: string, programId: string, input: AwardInput, ctx: Ctx): Promise<Result & { id?: string }> {
  if (!(await programBelongs(companyId, programId))) return { ok: false, error: "Program not found." };
  const cols = await awardColumns(companyId, input);
  if (typeof cols === "string") return { ok: false, error: cols };
  if (!cols.award_name) return { ok: false, error: "Name the award." };
  const row = { company_id: companyId, pr_program_id: programId, created_by: ctx.actor, stage: "proposed", ...cols };
  const { data, error } = await companyOs.from("pr_awards").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "pr_awards", recordId: data.id, operation: "insert", actor: ctx.actor, newData: row });
  return { ok: true, id: data.id };
}
export async function updateAwardCore(companyId: string, id: string, patch: AwardPatch, ctx: Ctx): Promise<Result> {
  if (!(await rowOf("pr_awards", companyId, id))) return { ok: false, error: "Not found." };
  const cols = await awardColumns(companyId, patch);
  if (typeof cols === "string") return { ok: false, error: cols };
  const updates = { ...cols, updated_at: new Date().toISOString() };
  const { error } = await companyOs.from("pr_awards").update(updates).eq("id", id).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "pr_awards", recordId: id, operation: "update", actor: ctx.actor, newData: updates });
  return { ok: true };
}
export const publishAwardCore = (companyId: string, id: string, published: boolean, ctx: Ctx) => setPublished("pr_awards", companyId, id, published, ctx);
export const archiveAwardCore = (companyId: string, id: string, ctx: Ctx) => archiveRow("pr_awards", companyId, id, ctx);

// ── News pipeline ─────────────────────────────────────────────────────────
export type PipelineInput = { headline: string; description?: string | null; targetQuarterPlanId?: string | null };
export type PipelinePatch = Partial<PipelineInput & { status: string; lastReviewedOn: string | null }>;

async function pipelineColumns(companyId: string, p: PipelinePatch): Promise<Record<string, unknown> | string> {
  const out: Record<string, unknown> = {};
  if (p.headline !== undefined) {
    const h = nul(p.headline);
    if (!h) return "Give the idea a headline.";
    out.headline = h;
  }
  if (p.description !== undefined) out.description = nul(p.description);
  if (p.status !== undefined) {
    if (!isOneOf(PIPELINE_STATUSES, p.status)) return "Invalid status.";
    out.status = p.status;
  }
  if (p.targetQuarterPlanId !== undefined) {
    const id = nul(p.targetQuarterPlanId);
    if (id && !(await planBelongs(companyId, id))) return "That plan is not this client's.";
    out.target_quarter_plan_id = id;
  }
  if (p.lastReviewedOn !== undefined) {
    const d = dateOrErr(p.lastReviewedOn, "lastReviewedOn");
    if (d === undefined) return "Dates must be YYYY-MM-DD.";
    out.last_reviewed_on = d;
  }
  return out;
}

export async function createPipelineCore(companyId: string, programId: string, input: PipelineInput, ctx: Ctx): Promise<Result & { id?: string }> {
  if (!(await programBelongs(companyId, programId))) return { ok: false, error: "Program not found." };
  const cols = await pipelineColumns(companyId, input);
  if (typeof cols === "string") return { ok: false, error: cols };
  if (!cols.headline) return { ok: false, error: "Give the idea a headline." };
  const row = { company_id: companyId, pr_program_id: programId, created_by: ctx.actor, status: "logged", last_reviewed_on: new Date().toISOString().slice(0, 10), ...cols };
  const { data, error } = await companyOs.from("pr_news_pipeline").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "pr_news_pipeline", recordId: data.id, operation: "insert", actor: ctx.actor, newData: row });
  return { ok: true, id: data.id };
}
export async function updatePipelineCore(companyId: string, id: string, patch: PipelinePatch, ctx: Ctx): Promise<Result> {
  if (!(await rowOf("pr_news_pipeline", companyId, id))) return { ok: false, error: "Not found." };
  const cols = await pipelineColumns(companyId, patch);
  if (typeof cols === "string") return { ok: false, error: cols };
  const updates = { ...cols, last_reviewed_on: (cols.last_reviewed_on as string | null | undefined) ?? new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() };
  const { error } = await companyOs.from("pr_news_pipeline").update(updates).eq("id", id).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "pr_news_pipeline", recordId: id, operation: "update", actor: ctx.actor, newData: updates });
  return { ok: true };
}
export const publishPipelineCore = (companyId: string, id: string, published: boolean, ctx: Ctx) => setPublished("pr_news_pipeline", companyId, id, published, ctx);
export const archivePipelineCore = (companyId: string, id: string, ctx: Ctx) => archiveRow("pr_news_pipeline", companyId, id, ctx);

// Promote: the idea becomes a plan target under the given workstream, and the
// pipeline row records which target it became.
export async function promotePipelineCore(
  companyId: string,
  id: string,
  input: { planId: string; groupKey: string; quantityTarget?: number | null },
  ctx: Ctx,
): Promise<Result & { targetId?: string }> {
  const row = await rowOf("pr_news_pipeline", companyId, id);
  if (!row) return { ok: false, error: "Not found." };
  if (row.promoted_backlog_item_id) return { ok: false, error: "Already promoted." };
  if (!(await planBelongs(companyId, input.planId))) return { ok: false, error: "Pick a plan." };
  const { data: g } = await companyOs.from("client_roadmap_groups").select("id").eq("company_id", companyId).eq("key", input.groupKey).is("archived_at", null).maybeSingle();
  if (!g) return { ok: false, error: "Pick a workstream." };
  const target = {
    company_id: companyId,
    pr_program_id: row.pr_program_id as string,
    quarterly_plan_id: input.planId,
    group_key: input.groupKey,
    title: row.headline as string,
    build_desc: (row.description as string | null) ?? null,
    quantity_target: input.quantityTarget ?? null,
    status: "accepted",
    source: "edge8" as const,
    sort_order: 999,
  };
  const { data: t, error } = await companyOs.from("client_backlog_items").insert(target).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "client_backlog_items", recordId: t.id, operation: "insert", actor: ctx.actor, newData: target, context: { promoted_from: id } });
  const updates = { status: "promoted", promoted_backlog_item_id: t.id, target_quarter_plan_id: input.planId, last_reviewed_on: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() };
  const { error: e2 } = await companyOs.from("pr_news_pipeline").update(updates).eq("id", id).eq("company_id", companyId);
  if (e2) return { ok: false, error: e2.message };
  await recordAudit({ table: "pr_news_pipeline", recordId: id, operation: "update", actor: ctx.actor, newData: updates });
  return { ok: true, targetId: t.id };
}

// ── Case studies ──────────────────────────────────────────────────────────
export type CaseStudyInput = { title: string; description?: string | null; customerPersonId?: string | null; customerCompanyId?: string | null };
export type CaseStudyPatch = Partial<CaseStudyInput & { status: string }>;

async function caseColumns(p: CaseStudyPatch): Promise<Record<string, unknown> | string> {
  const out: Record<string, unknown> = {};
  if (p.title !== undefined) {
    const t = nul(p.title);
    if (!t) return "Give the story a title.";
    out.title = t;
  }
  if (p.description !== undefined) out.description = nul(p.description);
  if (p.status !== undefined) {
    if (!isOneOf(CASE_STUDY_STATUSES, p.status)) return "Invalid status.";
    out.status = p.status;
  }
  if (p.customerPersonId !== undefined) {
    const id = nul(p.customerPersonId);
    if (id) {
      const { data } = await companyOs.from("people").select("id").eq("id", id).is("archived_at", null).maybeSingle();
      if (!data) return "Pick a customer contact.";
    }
    out.customer_person_id = id;
  }
  if (p.customerCompanyId !== undefined) {
    const id = nul(p.customerCompanyId);
    if (id) {
      const { data } = await companyOs.from("companies").select("id").eq("id", id).maybeSingle();
      if (!data) return "Pick a customer company.";
    }
    out.customer_company_id = id;
  }
  return out;
}

export async function createCaseStudyCore(companyId: string, programId: string, input: CaseStudyInput, ctx: Ctx): Promise<Result & { id?: string }> {
  if (!(await programBelongs(companyId, programId))) return { ok: false, error: "Program not found." };
  const cols = await caseColumns(input);
  if (typeof cols === "string") return { ok: false, error: cols };
  if (!cols.title) return { ok: false, error: "Give the story a title." };
  const row = { company_id: companyId, pr_program_id: programId, created_by: ctx.actor, status: "proposed", ...cols };
  const { data, error } = await companyOs.from("pr_case_studies").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "pr_case_studies", recordId: data.id, operation: "insert", actor: ctx.actor, newData: row });
  return { ok: true, id: data.id };
}
export async function updateCaseStudyCore(companyId: string, id: string, patch: CaseStudyPatch, ctx: Ctx): Promise<Result> {
  if (!(await rowOf("pr_case_studies", companyId, id))) return { ok: false, error: "Not found." };
  const cols = await caseColumns(patch);
  if (typeof cols === "string") return { ok: false, error: cols };
  const updates = { ...cols, updated_at: new Date().toISOString() };
  const { error } = await companyOs.from("pr_case_studies").update(updates).eq("id", id).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "pr_case_studies", recordId: id, operation: "update", actor: ctx.actor, newData: updates });
  return { ok: true };
}
export const publishCaseStudyCore = (companyId: string, id: string, published: boolean, ctx: Ctx) => setPublished("pr_case_studies", companyId, id, published, ctx);
export const archiveCaseStudyCore = (companyId: string, id: string, ctx: Ctx) => archiveRow("pr_case_studies", companyId, id, ctx);

// ── Touchpoints ───────────────────────────────────────────────────────────
export type TouchpointInput = { kind: string; occurredOn: string; subject?: string | null; body?: string | null };

export async function logTouchpointCore(companyId: string, programId: string, input: TouchpointInput, ctx: Ctx): Promise<Result> {
  if (!(await programBelongs(companyId, programId))) return { ok: false, error: "Program not found." };
  if (!isOneOf(TOUCHPOINT_KINDS, input.kind)) return { ok: false, error: "Pick a kind." };
  if (!DATE.test(input.occurredOn)) return { ok: false, error: "Pick a date." };
  const row = {
    kind: input.kind,
    subject: nul(input.subject),
    body: nul(input.body),
    occurred_at: `${input.occurredOn}T12:00:00Z`,
    company_id: companyId,
    subject_type: "pr_program",
    subject_id: programId,
    metadata: { source: "pr_hub", author: ctx.actor },
  };
  const { data, error } = await companyOs.from("interactions").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "interactions", recordId: data.id, operation: "insert", actor: ctx.actor, newData: row });
  return { ok: true };
}

// The server-action surface the supporting panels bind to (companyId pre-bound).
export type SupportingActions = {
  createAward: (programId: string, input: AwardInput) => Promise<Result & { id?: string }>;
  updateAward: (id: string, patch: AwardPatch) => Promise<Result>;
  publishAward: (id: string, published: boolean) => Promise<Result>;
  archiveAward: (id: string) => Promise<Result>;
  createPipeline: (programId: string, input: PipelineInput) => Promise<Result & { id?: string }>;
  updatePipeline: (id: string, patch: PipelinePatch) => Promise<Result>;
  publishPipeline: (id: string, published: boolean) => Promise<Result>;
  archivePipeline: (id: string) => Promise<Result>;
  promotePipeline: (id: string, input: { planId: string; groupKey: string; quantityTarget?: number | null }) => Promise<Result & { targetId?: string }>;
  createCaseStudy: (programId: string, input: CaseStudyInput) => Promise<Result & { id?: string }>;
  updateCaseStudy: (id: string, patch: CaseStudyPatch) => Promise<Result>;
  publishCaseStudy: (id: string, published: boolean) => Promise<Result>;
  archiveCaseStudy: (id: string) => Promise<Result>;
  logTouchpoint: (programId: string, input: TouchpointInput) => Promise<Result>;
};
