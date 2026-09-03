import { cache } from "react";
// Outcome readers: earned coverage and LinkedIn posts are marketing_content
// rows tagged to a program (docs/plans/2026-09-03-pr-hub-client-record.md,
// M6). Same discipline as lib/hub/program.ts: companyId in, never widen
// scope; the caller gates. published_at is the client-visibility flag.

import { companyOs } from "@/lib/supabase";
import { personName, type NamedPerson } from "@/lib/people-name";
import { COVERAGE_CHANNELS } from "@/lib/pr/enums";

export type OutcomeKind = "coverage" | "linkedin";

export type OutcomeRow = {
  id: string;
  kind: OutcomeKind;
  channel: string;
  title: string;
  outlet: string | null;
  url: string | null; // posted_url
  publishDate: string | null;
  publishedAt: string | null;
  reach: number | null;
  copyMd: string | null;
  taskId: string | null;
  taskTitle: string | null;
  backlogItemId: string | null;
  targetTitle: string | null;
  journalistId: string | null; // internal-only; the portal reader drops it
  journalistName: string | null;
  caseStudyId: string | null;
  mediaAssetDocumentId: string | null;
  mediaAssetName: string | null;
  createdAt: string;
};

type Embed<T> = T | T[] | null;
const one = <T,>(e: Embed<T> | undefined): T | null => (Array.isArray(e) ? e[0] ?? null : e ?? null);

type Row = {
  id: string;
  channel: string;
  title: string;
  outlet: string | null;
  posted_url: string | null;
  publish_date: string | null;
  published_at: string | null;
  reach: number | null;
  copy_md: string | null;
  task_id: string | null;
  backlog_item_id: string | null;
  journalist_person_id: string | null;
  case_study_id: string | null;
  media_asset_document_id: string | null;
  created_at: string;
  task: Embed<{ id: string; title: string }>;
  target: Embed<{ id: string; title: string }>;
  journalist: Embed<NamedPerson & { id: string }>;
  asset: Embed<{ id: string; filename: string }>;
};

export const OUTCOME_SELECT =
  "id, channel, title, outlet, posted_url, publish_date, published_at, reach, copy_md, task_id, backlog_item_id, journalist_person_id, case_study_id, media_asset_document_id, created_at, " +
  "task:tasks!marketing_content_task_id_fkey(id, title), " +
  "target:client_backlog_items!marketing_content_backlog_item_id_fkey(id, title), " +
  "journalist:people!marketing_content_journalist_person_id_fkey(id, display_name, preferred_name, full_name, email), " +
  "asset:program_documents!marketing_content_media_asset_document_id_fkey(id, filename)";

export function outcomeKind(channel: string): OutcomeKind {
  return channel === "linkedin" ? "linkedin" : "coverage";
}

export function mapOutcome(r: Row): OutcomeRow {
  const j = one(r.journalist);
  return {
    id: r.id,
    kind: outcomeKind(r.channel),
    channel: r.channel,
    title: r.title,
    outlet: r.outlet,
    url: r.posted_url,
    publishDate: r.publish_date,
    publishedAt: r.published_at,
    reach: r.reach,
    copyMd: r.copy_md,
    taskId: r.task_id,
    taskTitle: one(r.task)?.title ?? null,
    backlogItemId: r.backlog_item_id,
    targetTitle: one(r.target)?.title ?? null,
    journalistId: r.journalist_person_id,
    journalistName: j ? personName(j) : null,
    caseStudyId: r.case_study_id,
    mediaAssetDocumentId: r.media_asset_document_id,
    mediaAssetName: one(r.asset)?.filename ?? null,
    createdAt: r.created_at,
  };
}

// All PR outcomes for a program (coverage + LinkedIn), newest first. Rows
// marked status='skipped' are removed from view (soft delete on this table).
export async function listOutcomes(
  companyId: string,
  programId: string,
  opts?: { publishedOnly?: boolean },
): Promise<OutcomeRow[]> {
  let q = companyOs
    .from("marketing_content")
    .select(OUTCOME_SELECT)
    .eq("company_id", companyId)
    .eq("pr_program_id", programId)
    .in("channel", [...COVERAGE_CHANNELS, "linkedin"])
    .neq("status", "skipped")
    .order("publish_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (opts?.publishedOnly) q = q.not("published_at", "is", null);
  const { data } = await q;
  return ((data ?? []) as unknown as Row[]).map(mapOutcome);
}

export type Option = { id: string; title: string };

// Board cards on the program's boards, for the "earned by" link.
export async function listProgramTaskOptions(companyId: string, programId: string): Promise<Option[]> {
  const { data: boards } = await companyOs
    .from("boards")
    .select("id")
    .eq("client_company_id", companyId)
    .eq("pr_program_id", programId)
    .is("archived_at", null);
  const ids = ((boards ?? []) as { id: string }[]).map((b) => b.id);
  if (ids.length === 0) return [];
  const { data } = await companyOs
    .from("tasks")
    .select("id, title")
    .in("board_id", ids)
    .is("archived_at", null)
    .is("parent_task_id", null)
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []) as Option[];
}

export type MediaContactOption = { id: string; name: string; outlet: string | null };

// People with persona=media, with the outlet they are a journalist at.
async function listMediaContactsImpl(): Promise<MediaContactOption[]> {
  const { data } = await companyOs
    .from("people")
    .select("id, display_name, preferred_name, full_name, email, person_companies(role, companies(name))")
    .eq("persona", "media")
    .is("archived_at", null)
    .limit(500);
  const rows = (data ?? []) as unknown as Array<
    NamedPerson & { id: string; person_companies: Array<{ role: string; companies: Embed<{ name: string }> }> | null }
  >;
  return rows
    .map((p) => ({
      id: p.id,
      name: personName(p),
      outlet: one((p.person_companies ?? []).find((pc) => pc.role === "journalist")?.companies ?? null)?.name ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Per-request memo (React cache): the hub page and its tab loaders ask for
// this several times in one render; only the first call hits the database.
export const listMediaContacts = cache(listMediaContactsImpl);
