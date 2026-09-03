// Auth-agnostic write cores for outcomes (marketing_content rows tagged to a
// program). Callers gate authorization and pass the verified company id.
// Every link (task, target, journalist, asset) is validated to the same
// company before it is written. published_at is the client-visibility flag;
// status mirrors it (published / drafted) so the marketing calendar's own
// vocabulary stays true.

import { companyOs } from "@/lib/supabase";
import { recordAudit } from "@/lib/admin/audit";
import type { Result } from "@/lib/admin/mutations";
import { COVERAGE_CHANNELS, isOneOf } from "@/lib/pr/enums";

const TABLE = "marketing_content";

export type OutcomeInput = {
  kind: "coverage" | "linkedin";
  title: string;
  channel?: string | null; // coverage channel; ignored for linkedin
  outlet?: string | null;
  url?: string | null;
  publishDate?: string | null;
  reach?: number | null;
  copyMd?: string | null;
  backlogItemId?: string | null;
  taskId?: string | null;
  journalistPersonId?: string | null;
  mediaAssetDocumentId?: string | null;
  published?: boolean;
};

export type OutcomePatch = Partial<Omit<OutcomeInput, "kind" | "published">>;

export type OutcomeActions = {
  create: (programId: string, input: OutcomeInput) => Promise<Result & { id?: string }>;
  update: (outcomeId: string, patch: OutcomePatch) => Promise<Result>;
  publish: (outcomeId: string, published: boolean) => Promise<Result>;
  remove: (outcomeId: string) => Promise<Result>;
};

type Ctx = { actor: string };

function nul(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeUrl(raw: string | null): string | null | undefined {
  if (raw === null) return null;
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

async function programBelongs(companyId: string, programId: string): Promise<boolean> {
  const { data } = await companyOs.from("pr_programs").select("id").eq("id", programId).eq("company_id", companyId).maybeSingle();
  return !!data;
}
async function targetBelongs(companyId: string, id: string): Promise<boolean> {
  const { data } = await companyOs.from("client_backlog_items").select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
  return !!data;
}
async function taskBelongs(companyId: string, id: string): Promise<boolean> {
  const { data } = await companyOs.from("tasks").select("id, board:boards!tasks_board_id_fkey(client_company_id)").eq("id", id).maybeSingle();
  const b = (data as { board?: { client_company_id: string | null } | { client_company_id: string | null }[] | null } | null)?.board;
  const board = Array.isArray(b) ? b[0] : b;
  return board?.client_company_id === companyId;
}
async function journalistExists(id: string): Promise<boolean> {
  const { data } = await companyOs.from("people").select("id").eq("id", id).eq("persona", "media").is("archived_at", null).maybeSingle();
  return !!data;
}
async function documentBelongs(companyId: string, id: string): Promise<boolean> {
  const { data } = await companyOs.from("program_documents").select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
  return !!data;
}
async function outcomeRow(companyId: string, id: string): Promise<{ id: string; published_at: string | null } | null> {
  const { data } = await companyOs.from(TABLE).select("id, published_at").eq("id", id).eq("company_id", companyId).maybeSingle();
  return (data as { id: string; published_at: string | null } | null) ?? null;
}

// Validate + normalise the link fields shared by create and update. Returns
// the columns to write, or an error string.
async function linkColumns(companyId: string, p: OutcomePatch): Promise<Record<string, unknown> | string> {
  const out: Record<string, unknown> = {};
  if (p.backlogItemId !== undefined) {
    const id = nul(p.backlogItemId);
    if (id && !(await targetBelongs(companyId, id))) return "That target is not this client's.";
    out.backlog_item_id = id;
  }
  if (p.taskId !== undefined) {
    const id = nul(p.taskId);
    if (id && !(await taskBelongs(companyId, id))) return "That card is not on this client's board.";
    out.task_id = id;
  }
  if (p.journalistPersonId !== undefined) {
    const id = nul(p.journalistPersonId);
    if (id && !(await journalistExists(id))) return "Pick a media contact.";
    out.journalist_person_id = id;
  }
  if (p.mediaAssetDocumentId !== undefined) {
    const id = nul(p.mediaAssetDocumentId);
    if (id && !(await documentBelongs(companyId, id))) return "That document is not this client's.";
    out.media_asset_document_id = id;
  }
  return out;
}

function fieldColumns(p: OutcomePatch, kind: "coverage" | "linkedin" | null): Record<string, unknown> | string {
  const out: Record<string, unknown> = {};
  if (p.title !== undefined) {
    const t = nul(p.title);
    if (!t) return "Give it a headline.";
    out.title = t;
  }
  if (p.channel !== undefined && kind !== "linkedin") {
    const c = nul(p.channel) ?? "earned";
    if (!isOneOf(COVERAGE_CHANNELS, c)) return "Invalid channel.";
    out.channel = c;
  }
  if (p.outlet !== undefined) out.outlet = nul(p.outlet);
  if (p.url !== undefined) {
    const u = normalizeUrl(p.url ?? null);
    if (u === undefined) return "Enter a valid http(s) link.";
    out.posted_url = u;
  }
  if (p.publishDate !== undefined) {
    const d = nul(p.publishDate);
    if (d && !DATE.test(d)) return "Date must be YYYY-MM-DD.";
    out.publish_date = d;
  }
  if (p.reach !== undefined) {
    if (p.reach === null || (p.reach as unknown) === "") out.reach = null;
    else {
      const n = Number(p.reach);
      if (!Number.isInteger(n) || n < 0) return "Reach must be a whole number.";
      out.reach = n;
    }
  }
  if (p.copyMd !== undefined) out.copy_md = nul(p.copyMd);
  return out;
}

export async function createOutcomeCore(companyId: string, programId: string, input: OutcomeInput, ctx: Ctx): Promise<Result & { id?: string }> {
  if (!(await programBelongs(companyId, programId))) return { ok: false, error: "Program not found." };
  const fields = fieldColumns(input, input.kind);
  if (typeof fields === "string") return { ok: false, error: fields };
  const links = await linkColumns(companyId, input);
  if (typeof links === "string") return { ok: false, error: links };
  const published = !!input.published;
  const row = {
    company_id: companyId,
    pr_program_id: programId,
    channel: input.kind === "linkedin" ? "linkedin" : (fields.channel as string | undefined) ?? "earned",
    status: published ? "published" : "drafted",
    published_at: published ? new Date().toISOString() : null,
    sort_order: 0,
    created_by: ctx.actor,
    ...fields,
    ...links,
  };
  if (!fields.title) return { ok: false, error: "Give it a headline." };
  const { data, error } = await companyOs.from(TABLE).insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TABLE, recordId: data.id, operation: "insert", actor: ctx.actor, newData: row });
  return { ok: true, id: data.id };
}

export async function updateOutcomeCore(companyId: string, outcomeId: string, patch: OutcomePatch, ctx: Ctx): Promise<Result> {
  const { data: existing } = await companyOs.from(TABLE).select("id, channel").eq("id", outcomeId).eq("company_id", companyId).maybeSingle();
  if (!existing) return { ok: false, error: "Not found." };
  const kind = (existing as { channel: string }).channel === "linkedin" ? "linkedin" : "coverage";
  const fields = fieldColumns(patch, kind);
  if (typeof fields === "string") return { ok: false, error: fields };
  const links = await linkColumns(companyId, patch);
  if (typeof links === "string") return { ok: false, error: links };
  const updates = { ...fields, ...links, updated_at: new Date().toISOString() };
  const { error } = await companyOs.from(TABLE).update(updates).eq("id", outcomeId).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TABLE, recordId: outcomeId, operation: "update", actor: ctx.actor, newData: updates });
  return { ok: true };
}

export async function publishOutcomeCore(companyId: string, outcomeId: string, published: boolean, ctx: Ctx): Promise<Result> {
  if (!(await outcomeRow(companyId, outcomeId))) return { ok: false, error: "Not found." };
  const updates = {
    published_at: published ? new Date().toISOString() : null,
    status: published ? "published" : "drafted",
    updated_at: new Date().toISOString(),
  };
  const { error } = await companyOs.from(TABLE).update(updates).eq("id", outcomeId).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TABLE, recordId: outcomeId, operation: "update", actor: ctx.actor, context: { action: "set_published", published } });
  return { ok: true };
}

// marketing_content has no archived_at; "skipped" is its remove-from-view.
export async function removeOutcomeCore(companyId: string, outcomeId: string, ctx: Ctx): Promise<Result> {
  if (!(await outcomeRow(companyId, outcomeId))) return { ok: false, error: "Not found." };
  const updates = { status: "skipped", published_at: null, updated_at: new Date().toISOString() };
  const { error } = await companyOs.from(TABLE).update(updates).eq("id", outcomeId).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TABLE, recordId: outcomeId, operation: "archive", actor: ctx.actor });
  return { ok: true };
}
