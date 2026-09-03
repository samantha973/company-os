// Client-facing awards and case studies: company-scoped through portalRead,
// PUBLISHED rows only. CLIENT-SAFE HARD LINE: award cost and the customer
// contact never leave this module. The news pipeline is not a client surface
// (promoted ideas appear as plan targets).

import type { PortalActor } from "@/lib/portal-auth";
import { portalRead } from "@/lib/portal/data";
import type { AwardRow, CaseStudyRow } from "@/lib/hub/supporting";

export async function hasPublishedAwards(actor: PortalActor): Promise<boolean> {
  if (actor.companyScope.length === 0) return false;
  const { data } = await portalRead(actor, "pr_awards", "id").not("published_at", "is", null).is("archived_at", null).limit(1);
  return (data ?? []).length > 0;
}

export async function hasPublishedCaseStudies(actor: PortalActor): Promise<boolean> {
  if (actor.companyScope.length === 0) return false;
  const { data } = await portalRead(actor, "pr_case_studies", "id").not("published_at", "is", null).is("archived_at", null).limit(1);
  return (data ?? []).length > 0;
}

export async function listAwardsForActor(actor: PortalActor): Promise<AwardRow[]> {
  if (actor.companyScope.length === 0) return [];
  const { data } = await portalRead(actor, "pr_awards", "id, stage, award_name, category, website, entry_close, event_date, outcome_note, quarterly_plan_id, published_at, created_at")
    .not("published_at", "is", null)
    .is("archived_at", null)
    .order("entry_close", { ascending: true, nullsFirst: false });
  type Row = { id: string; stage: string; award_name: string; category: string | null; website: string | null; entry_close: string | null; event_date: string | null; outcome_note: string | null; quarterly_plan_id: string | null; published_at: string | null; created_at: string };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    stage: r.stage,
    awardName: r.award_name,
    category: r.category,
    website: r.website,
    entryClose: r.entry_close,
    eventDate: r.event_date,
    submissionDocumentId: null,
    submissionDocumentName: null,
    costCents: null,
    outcomeNote: r.outcome_note,
    quarterlyPlanId: r.quarterly_plan_id,
    publishedAt: r.published_at,
    createdAt: r.created_at,
  }));
}

export async function listCaseStudiesForActor(actor: PortalActor): Promise<CaseStudyRow[]> {
  if (actor.companyScope.length === 0) return [];
  const { data } = await portalRead(
    actor,
    "pr_case_studies",
    "id, title, description, status, customer_company_id, published_at, created_at, company:companies!pr_case_studies_customer_company_id_fkey(name), used:marketing_content!marketing_content_case_study_id_fkey(id, title, outlet, publish_date, published_at)",
  )
    .not("published_at", "is", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  type Row = {
    id: string; title: string; description: string | null; status: string; customer_company_id: string | null; published_at: string | null; created_at: string;
    company: { name: string } | { name: string }[] | null;
    used: Array<{ id: string; title: string; outlet: string | null; publish_date: string | null; published_at: string | null }> | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    customerPersonId: null,
    customerName: null,
    customerCompanyId: r.customer_company_id,
    customerCompanyName: (Array.isArray(r.company) ? r.company[0] : r.company)?.name ?? null,
    usedIn: (r.used ?? []).filter((u) => !!u.published_at).map((u) => ({ id: u.id, title: u.title, outlet: u.outlet, publishDate: u.publish_date })),
    publishedAt: r.published_at,
    createdAt: r.created_at,
  }));
}
