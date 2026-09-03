// Readers for the supporting PR tables: awards, news pipeline, case studies,
// and the touchpoint log. Company-scoped; the caller gates. published_at is
// the client-visibility flag on each.

import { companyOs } from "@/lib/supabase";
import { personName, type NamedPerson } from "@/lib/people-name";

type Embed<T> = T | T[] | null;
const one = <T,>(e: Embed<T> | undefined): T | null => (Array.isArray(e) ? e[0] ?? null : e ?? null);

// ── Awards ────────────────────────────────────────────────────────────────
export type AwardRow = {
  id: string;
  stage: string;
  awardName: string;
  category: string | null;
  website: string | null;
  entryClose: string | null;
  eventDate: string | null;
  submissionDocumentId: string | null;
  submissionDocumentName: string | null;
  costCents: number | null; // internal-only
  outcomeNote: string | null;
  quarterlyPlanId: string | null;
  publishedAt: string | null;
  createdAt: string;
};

const AWARD_SELECT =
  "id, stage, award_name, category, website, entry_close, event_date, submission_document_id, cost_cents, outcome_note, quarterly_plan_id, published_at, created_at, " +
  "doc:program_documents!pr_awards_submission_document_id_fkey(filename)";

export async function listAwards(companyId: string, programId: string, opts?: { publishedOnly?: boolean }): Promise<AwardRow[]> {
  let q = companyOs
    .from("pr_awards")
    .select(AWARD_SELECT)
    .eq("company_id", companyId)
    .eq("pr_program_id", programId)
    .is("archived_at", null)
    .order("entry_close", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (opts?.publishedOnly) q = q.not("published_at", "is", null);
  const { data } = await q;
  type Row = {
    id: string; stage: string; award_name: string; category: string | null; website: string | null; entry_close: string | null;
    event_date: string | null; submission_document_id: string | null; cost_cents: number | null; outcome_note: string | null;
    quarterly_plan_id: string | null; published_at: string | null; created_at: string; doc: Embed<{ filename: string }>;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    stage: r.stage,
    awardName: r.award_name,
    category: r.category,
    website: r.website,
    entryClose: r.entry_close,
    eventDate: r.event_date,
    submissionDocumentId: r.submission_document_id,
    submissionDocumentName: one(r.doc)?.filename ?? null,
    costCents: r.cost_cents,
    outcomeNote: r.outcome_note,
    quarterlyPlanId: r.quarterly_plan_id,
    publishedAt: r.published_at,
    createdAt: r.created_at,
  }));
}

// ── News pipeline ─────────────────────────────────────────────────────────
export type PipelineRow = {
  id: string;
  headline: string;
  description: string | null;
  status: string;
  targetQuarterPlanId: string | null;
  targetQuarterLabel: string | null;
  promotedBacklogItemId: string | null;
  promotedTargetTitle: string | null;
  lastReviewedOn: string | null;
  publishedAt: string | null;
  createdAt: string;
};

const PIPELINE_SELECT =
  "id, headline, description, status, target_quarter_plan_id, promoted_backlog_item_id, last_reviewed_on, published_at, created_at, " +
  "plan:pr_quarterly_plans!pr_news_pipeline_target_quarter_plan_id_fkey(quarter_label), " +
  "target:client_backlog_items!pr_news_pipeline_promoted_backlog_item_id_fkey(title)";

export async function listPipeline(companyId: string, programId: string, opts?: { publishedOnly?: boolean }): Promise<PipelineRow[]> {
  let q = companyOs
    .from("pr_news_pipeline")
    .select(PIPELINE_SELECT)
    .eq("company_id", companyId)
    .eq("pr_program_id", programId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (opts?.publishedOnly) q = q.not("published_at", "is", null);
  const { data } = await q;
  type Row = {
    id: string; headline: string; description: string | null; status: string; target_quarter_plan_id: string | null;
    promoted_backlog_item_id: string | null; last_reviewed_on: string | null; published_at: string | null; created_at: string;
    plan: Embed<{ quarter_label: string }>; target: Embed<{ title: string }>;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    headline: r.headline,
    description: r.description,
    status: r.status,
    targetQuarterPlanId: r.target_quarter_plan_id,
    targetQuarterLabel: one(r.plan)?.quarter_label ?? null,
    promotedBacklogItemId: r.promoted_backlog_item_id,
    promotedTargetTitle: one(r.target)?.title ?? null,
    lastReviewedOn: r.last_reviewed_on,
    publishedAt: r.published_at,
    createdAt: r.created_at,
  }));
}

// ── Case studies ──────────────────────────────────────────────────────────
export type CaseStudyRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  customerPersonId: string | null; // internal-only
  customerName: string | null; // internal-only
  customerCompanyId: string | null;
  customerCompanyName: string | null;
  usedIn: Array<{ id: string; title: string; outlet: string | null; publishDate: string | null }>;
  publishedAt: string | null;
  createdAt: string;
};

const CASE_SELECT =
  "id, title, description, status, customer_person_id, customer_company_id, published_at, created_at, " +
  "person:people!pr_case_studies_customer_person_id_fkey(id, display_name, preferred_name, full_name, email), " +
  "company:companies!pr_case_studies_customer_company_id_fkey(name), " +
  "used:marketing_content!marketing_content_case_study_id_fkey(id, title, outlet, publish_date, published_at)";

export async function listCaseStudies(companyId: string, programId: string, opts?: { publishedOnly?: boolean }): Promise<CaseStudyRow[]> {
  let q = companyOs
    .from("pr_case_studies")
    .select(CASE_SELECT)
    .eq("company_id", companyId)
    .eq("pr_program_id", programId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (opts?.publishedOnly) q = q.not("published_at", "is", null);
  const { data } = await q;
  type Row = {
    id: string; title: string; description: string | null; status: string; customer_person_id: string | null;
    customer_company_id: string | null; published_at: string | null; created_at: string;
    person: Embed<NamedPerson & { id: string }>; company: Embed<{ name: string }>;
    used: Array<{ id: string; title: string; outlet: string | null; publish_date: string | null; published_at: string | null }> | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const p = one(r.person);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      customerPersonId: r.customer_person_id,
      customerName: p ? personName(p) : null,
      customerCompanyId: r.customer_company_id,
      customerCompanyName: one(r.company)?.name ?? null,
      usedIn: (r.used ?? [])
        .filter((u) => (opts?.publishedOnly ? !!u.published_at : true))
        .map((u) => ({ id: u.id, title: u.title, outlet: u.outlet, publishDate: u.publish_date })),
      publishedAt: r.published_at,
      createdAt: r.created_at,
    };
  });
}

// ── Touchpoints (interactions, internal-only) ─────────────────────────────
export type TouchpointRow = { id: string; kind: string; subject: string | null; body: string | null; occurredAt: string };

export async function listTouchpoints(companyId: string, programId: string, limit = 10): Promise<TouchpointRow[]> {
  const { data } = await companyOs
    .from("interactions")
    .select("id, kind, subject, body, occurred_at")
    .eq("company_id", companyId)
    .eq("subject_type", "pr_program")
    .eq("subject_id", programId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Array<{ id: string; kind: string; subject: string | null; body: string | null; occurred_at: string }>).map((r) => ({
    id: r.id,
    kind: r.kind,
    subject: r.subject,
    body: r.body,
    occurredAt: r.occurred_at,
  }));
}

// Customer picker for case studies: people the client company knows (its
// contacts) plus anyone already on a case study. Kept small on purpose.
export type PersonPick = { id: string; name: string };
export async function listCustomerPicks(companyId: string): Promise<PersonPick[]> {
  const { data } = await companyOs
    .from("person_companies")
    .select("people:people!person_id(id, display_name, preferred_name, full_name, email)")
    .eq("company_id", companyId);
  const rows = (data ?? []) as unknown as Array<{ people: Embed<NamedPerson & { id: string }> }>;
  const out = new Map<string, string>();
  for (const r of rows) {
    const p = one(r.people);
    if (p) out.set(p.id, personName(p));
  }
  return [...out.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
