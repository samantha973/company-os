import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany360, getCompanyReferredBy } from "@/lib/admin/companies";
import { getPortalMembershipsForCompany } from "@/lib/admin/portal";
import {
  getAssignmentsForCompany,
  listActiveTeamMembers,
  listClientContacts,
} from "@/lib/admin/staff-assignments";
import { getInvoicesForCompany } from "@/lib/admin/invoices";
import { getMeetingsForCompany } from "@/lib/admin/meetings";
import { getSurveyResponsesForCompany } from "@/lib/admin/surveys";
import { getBoardBySlug, listBoardManageOptions } from "@/lib/boards/data";
import { listDocumentsForCompanies } from "@/lib/client-documents";
import { getCompanyHubTeam } from "@/lib/admin/company-hub";
import { listProgramSummaries, type ProgramSummary } from "@/lib/hub/program";
import { listAssignablePeople } from "@/lib/admin/people-options";
import { getPlanTab } from "@/lib/hub/plan";
import { suggestNextQuarter } from "@/lib/pr/quarters";
import { QuarterlyPlanPanel } from "@/components/hub/QuarterlyPlanPanel";
import { setupProgramWorkspace, updateProgramEngagement } from "./program-actions";
import { getCoverageTab } from "@/lib/hub/coverage-tab";
import { CoveragePanel } from "@/components/hub/CoveragePanel";
import { adminCreateOutcome, adminPublishOutcome, adminRemoveOutcome, adminUpdateOutcome } from "./outcome-actions";
import { getSupportingTab } from "@/lib/hub/supporting-tab";
import { AwardsPanel } from "@/components/hub/AwardsPanel";
import { PipelinePanel } from "@/components/hub/PipelinePanel";
import { CaseStudiesPanel } from "@/components/hub/CaseStudiesPanel";
import * as sup from "./supporting-actions";
import {
  adminArchiveTarget,
  adminCreatePlan,
  adminCreateTarget,
  adminCreateWorkstream,
  adminPublishPlan,
  adminUpdatePlan,
  adminUpdateTarget,
} from "./plan-actions";
import { getAdminUser } from "@/lib/admin-auth";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { PortalMemberControls } from "@/components/admin/PortalMemberControls";
import { CrmCommandBar } from "@/components/admin/CrmCommandBar";
import { AssignedStaffCard } from "@/components/admin/AssignedStaffCard";
import { CompanyDocuments, type ProgramOption } from "@/components/admin/CompanyDocuments";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { InvoicesPanel } from "@/components/hub/InvoicesPanel";
import { HubTeamPanel } from "@/components/hub/HubTeamPanel";
import { HubProgramsBand } from "@/components/hub/HubProgramsBand";
import { BoardView } from "@/app/admin/(dashboard)/boards/[slug]/BoardView";
import { setMeetingPublished, setMeetingProgram } from "@/app/admin/(dashboard)/revenue/meetings/actions";
import { companyOs } from "@/lib/supabase";
import { firstParam, mergeQuery, type SearchParamsObj } from "@/lib/admin/url";
import { CompanyDetailsCard } from "../CompanyDetailsCard";
import { CompanyDangerZone } from "../CompanyDangerZone";

export const dynamic = "force-dynamic";

const CLIENT_STAGES = new Set(["customer", "evangelist"]);

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParamsObj;
}) {
  const data = await getCompany360(params.id);
  if (!data) notFound();

  const { company, deals, people, affiliate: companyAffiliate } = data;
  const name = company.name || "(no name)";
  const isClient = CLIENT_STAGES.has((company.lifecycle_stage || "").toLowerCase());

  const viewParam = firstParam(searchParams.view);
  const view = viewParam === "hub" ? "hub" : viewParam === "internal" ? "internal" : isClient ? "hub" : "internal";

  // Context-aware back-link: reflect where the user came from (Client Hubs,
  // Clients, or the Companies list) rather than always "Companies".
  const from = firstParam(searchParams.from);
  const back =
    from === "client-hubs"
      ? { href: "/admin/client-hubs", label: "← Client Hubs" }
      : from === "clients"
        ? { href: "/admin/revenue/clients", label: "← Clients" }
        : { href: "/admin/revenue/companies", label: "← Companies" };

  const dealValueCents = deals.reduce((s, d) => s + (d.amount_usd_cents ?? d.amount_cents ?? 0), 0);
  const affiliateContacts = people.filter((p) => p.affiliateActive);
  const showAffiliateCard = !!companyAffiliate?.active || affiliateContacts.length > 0;

  // ── Internal tabs ────────────────────────────────────────────────
  async function internalTabs(): Promise<TabDef[]> {
    const [portalMemberships, assignments, assignableTeamMembers, clientContacts, referredBy, surveys] =
      await Promise.all([
      getPortalMembershipsForCompany(company.id),
      getAssignmentsForCompany(company.id),
      listActiveTeamMembers(),
      listClientContacts(company.id),
      getCompanyReferredBy(company.id),
      getSurveyResponsesForCompany(company.id),
    ]);
    const activeMemberCount = [...portalMemberships.values()].filter((m) => m.status === "active").length;

    return [
      {
        key: "details",
        label: "Details",
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <CompanyDetailsCard
              company={{
                id: company.id,
                name: company.name,
                website_url: company.website_url,
                industry_normalized: company.industry_normalized,
                size_band: company.size_band,
                country: company.country,
                priority: company.priority,
                notes: company.notes,
                created_at: company.created_at,
              }}
              referredBy={referredBy}
            />
            {showAffiliateCard && (
              <div className="admin-card admin-section-card">
                <h2 className="admin-card-title">Referral &amp; affiliates</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {companyAffiliate?.active && (
                    <div>
                      <div className="admin-cell-muted" style={{ fontSize: 12, marginBottom: 4 }}>This company is an affiliate</div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {companyAffiliate.code && <Badge tone="ok">{companyAffiliate.code}</Badge>}
                        <span className="admin-cell-strong">{formatCents(companyAffiliate.realizedCents, "usd")} earned</span>
                        {companyAffiliate.unpaidCents > 0 && (
                          <span className="admin-cell-muted">· {formatCents(companyAffiliate.unpaidCents, "usd")} unpaid</span>
                        )}
                      </div>
                    </div>
                  )}
                  {affiliateContacts.length > 0 && (
                    <div>
                      <div className="admin-cell-muted" style={{ fontSize: 12, marginBottom: 4 }}>Affiliate contacts</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {affiliateContacts.map((p) => (
                          <Link key={p.id} href={`/admin/contacts/${p.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {p.full_name || p.email}
                            {p.affiliateCode && <Badge tone="ok">{p.affiliateCode}</Badge>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="admin-card admin-section-card">
              <CompanyDangerZone companyId={company.id} companyName={name} />
            </div>
          </div>
        ),
      },
      {
        key: "people",
        label: "People & access",
        count: activeMemberCount,
        content:
          people.length === 0 ? (
            <Empty text="No linked people yet. Link a contact from the CRM to invite them to the portal." />
          ) : (
            <div className="admin-list">
              {people.map((p) => {
                const membership = portalMemberships.get(p.id);
                return (
                  <div className="admin-list-row" key={p.id}>
                    <div className="admin-list-main">
                      <div className="admin-list-title">
                        <Link href={`/admin/contacts/${p.id}`}>{p.full_name || p.email}</Link>
                      </div>
                      <div className="admin-list-sub">{p.email}</div>
                    </div>
                    <div className="admin-list-aside">
                      <PortalMemberControls
                        personId={p.id}
                        companyId={company.id}
                        active={membership?.status === "active"}
                        role={membership?.role}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ),
      },
      {
        key: "staffing",
        label: "Staffing",
        count: assignments.length,
        content: (
          <AssignedStaffCard
            companyId={company.id}
            assignments={assignments}
            teamMembers={assignableTeamMembers}
            clientContacts={clientContacts}
          />
        ),
      },
      {
        key: "surveys",
        label: "Surveys",
        count: surveys.length,
        content:
          surveys.length === 0 ? (
            <Empty text="No survey responses from this company's people yet." />
          ) : (
            <div className="admin-list">
              {surveys.map((s) => (
                <div className="admin-list-row" key={s.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">{s.surveyName}</div>
                    <div className="admin-list-sub">{s.respondentName}</div>
                  </div>
                  <div className="admin-list-aside">
                    <Badge tone="neutral">{formatDate(s.submittedAt)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ),
      },
    ];
  }

  // ── Client Hub tabs + top band data ──────────────────────────────
  // The hub is organized around the client's PR Program: the engagement band,
  // then 90-Day Plan / Work Board / Coverage / Awards / Pipeline / Case
  // Studies / Documents / Meetings / Invoices / Team. One program per client.
  async function hubData(): Promise<{
    tabs: TabDef[];
    programs: ProgramSummary[];
    people: Awaited<ReturnType<typeof listAssignablePeople>>;
    touchpoints: Awaited<ReturnType<typeof getSupportingTab>> extends infer T ? (T extends { touchpoints: infer U } ? U : never) : never;
  }> {
    // Wave 1: every query here depends only on the company id, and every
    // dataset is fetched exactly once.
    const [programSummaries, boardRowsRes, boardOptions, admin, meetings, invoices, team, documents, people] =
      await Promise.all([
        listProgramSummaries(company.id),
        companyOs
          .from("boards")
          .select("id, slug, pr_program_id")
          .eq("client_company_id", company.id)
          .eq("status", "active")
          .is("archived_at", null)
          .order("sort_order", { ascending: true }),
        listBoardManageOptions(),
        getAdminUser(),
        getMeetingsForCompany(company.id),
        getInvoicesForCompany(company.id),
        getCompanyHubTeam(company.id),
        listDocumentsForCompanies([company.id]),
        listAssignablePeople(),
      ]);

    const programRowsFull = programSummaries;
    const hubBoards = (boardRowsRes.data ?? []) as Array<{ id: string; slug: string; pr_program_id: string | null }>;
    // The program's own board first; else the first active board.
    const firstProgramId = programRowsFull[0]?.id ?? null;
    const boardSlug = (hubBoards.find((b) => b.pr_program_id === firstProgramId) ?? hubBoards[0])?.slug ?? null;
    const hubMeetings = meetings;
    const hubDocuments = documents;

    // Wave 2: the only fetches that depend on wave 1 (board slug, the admin's
    // email).
    const [boardDetail, viewerRow] = await Promise.all([
      boardSlug ? getBoardBySlug(boardSlug) : Promise.resolve(null),
      // The admin's own person row, so cards freshly assigned to them wear "New".
      admin
        ? companyOs.from("people").select("id").eq("email", admin.email).is("archived_at", null).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const viewerPersonId = (viewerRow.data as { id: string } | null)?.id ?? null;

    const programOptions: ProgramOption[] = programRowsFull.map((p) => ({ id: p.id, name: p.name }));

    // The 90-Day Plan tab: one program per client, so the first program's
    // plans. ?plan= switches quarters.
    const planProgram = programRowsFull[0] ?? null;
    const planTab = planProgram ? await getPlanTab(company.id, planProgram.id, { planId: firstParam(searchParams.plan) }) : null;
    const planTabs: TabDef[] =
      planProgram && planTab
        ? [
            {
              key: "plan",
              label: "90-Day Plan",
              count: planTab.targets.length || undefined,
              content: (
                <QuarterlyPlanPanel
                  programId={planProgram.id}
                  plans={planTab.plans}
                  selected={planTab.selected}
                  targets={planTab.targets}
                  groups={planTab.groups}
                  meetings={meetings.map((m) => ({ id: m.id, title: m.title, date: m.meetingDate }))}
                  meetingHref={(id) => `/admin/revenue/meetings/${id}`}
                  planHref={(planId) => `/admin/revenue/companies/${company.id}?view=hub&plan=${planId}`}
                  suggestNext={suggestNextQuarter(planTab.plans[0]?.ends_on ?? null)}
                  actions={{
                    createPlan: adminCreatePlan.bind(null, company.id),
                    updatePlan: adminUpdatePlan.bind(null, company.id),
                    publishPlan: adminPublishPlan.bind(null, company.id),
                    createTarget: adminCreateTarget.bind(null, company.id),
                    updateTarget: adminUpdateTarget.bind(null, company.id),
                    archiveTarget: adminArchiveTarget.bind(null, company.id),
                    createWorkstream: adminCreateWorkstream.bind(null, company.id),
                  }}
                />
              ),
            },
          ]
        : [];
    const hubInvoices = invoices.map((r) => ({
      id: r.id,
      docNumber: r.doc_number,
      txnDate: r.txn_date,
      dueDate: r.due_date,
      currency: r.currency,
      amountCents: r.amount_cents,
      balanceCents: r.balance_cents,
      status: r.status,
    }));

    const companyWideTabs: TabDef[] = [
      {
        key: "board",
        label: "Work Board",
        content: boardDetail ? (
          <BoardView detail={boardDetail} canManage teamOptions={boardOptions.team} clientOptions={boardOptions.clients} programOptions={boardOptions.programs} viewerPersonId={viewerPersonId} />
        ) : (
          <section className="admin-card admin-section-card">
            <Empty text="No Work Board yet. Use “Set up Work Board” on the program above — it seeds the PR columns." />
          </section>
        ),
      },
    ];

    const coverageTab = planProgram ? await getCoverageTab(company.id) : null;
    const coverageKind = firstParam(searchParams.kind) === "linkedin" ? "linkedin" : "coverage";
    const coverageTabs: TabDef[] = coverageTab
      ? [
          {
            key: "coverage",
            label: "Coverage",
            count: coverageTab.rows.length || undefined,
            content: (
              <CoveragePanel
                programId={coverageTab.program.id}
                rows={coverageTab.rows}
                kind={coverageKind}
                kindHref={(k) => `/admin/revenue/companies/${company.id}?view=hub&tab=coverage&kind=${k}`}
                targets={coverageTab.targets}
                tasks={coverageTab.tasks}
                journalists={coverageTab.journalists}
                documents={coverageTab.documents}
                actions={{
                  create: adminCreateOutcome.bind(null, company.id),
                  update: adminUpdateOutcome.bind(null, company.id),
                  publish: adminPublishOutcome.bind(null, company.id),
                  remove: adminRemoveOutcome.bind(null, company.id),
                }}
              />
            ),
          },
        ]
      : [];

    const supporting = planProgram ? await getSupportingTab(company.id) : null;
    const supportingTabs: TabDef[] = supporting
      ? [
          {
            key: "awards",
            label: "Awards",
            count: supporting.awards.length || undefined,
            content: (
              <AwardsPanel
                programId={supporting.program.id}
                rows={supporting.awards}
                documents={supporting.documents}
                plans={supporting.plans}
                showCost
                actions={{
                  createAward: sup.adminCreateAward.bind(null, company.id),
                  updateAward: sup.adminUpdateAward.bind(null, company.id),
                  publishAward: sup.adminPublishAward.bind(null, company.id),
                  archiveAward: sup.adminArchiveAward.bind(null, company.id),
                }}
              />
            ),
          },
          {
            key: "pipeline",
            label: "Pipeline",
            count: supporting.pipeline.filter((p) => p.status !== "promoted").length || undefined,
            content: (
              <PipelinePanel
                programId={supporting.program.id}
                rows={supporting.pipeline}
                plans={supporting.plans}
                groups={supporting.groups}
                actions={{
                  createPipeline: sup.adminCreatePipeline.bind(null, company.id),
                  updatePipeline: sup.adminUpdatePipeline.bind(null, company.id),
                  publishPipeline: sup.adminPublishPipeline.bind(null, company.id),
                  archivePipeline: sup.adminArchivePipeline.bind(null, company.id),
                  promotePipeline: sup.adminPromotePipeline.bind(null, company.id),
                }}
              />
            ),
          },
          {
            key: "case-studies",
            label: "Case Studies",
            count: supporting.caseStudies.length || undefined,
            content: (
              <CaseStudiesPanel
                programId={supporting.program.id}
                rows={supporting.caseStudies}
                customers={supporting.customers}
                actions={{
                  createCaseStudy: sup.adminCreateCaseStudy.bind(null, company.id),
                  updateCaseStudy: sup.adminUpdateCaseStudy.bind(null, company.id),
                  publishCaseStudy: sup.adminPublishCaseStudy.bind(null, company.id),
                  archiveCaseStudy: sup.adminArchiveCaseStudy.bind(null, company.id),
                }}
              />
            ),
          },
        ]
      : [];

    const tabs: TabDef[] = [
      ...planTabs,
      ...companyWideTabs,
      ...coverageTabs,
      ...supportingTabs,
      {
        key: "documents",
        label: "Documents",
        count: hubDocuments.length,
        content: (
          <section className="admin-card admin-section-card">
            <CompanyDocuments companyId={company.id} documents={hubDocuments} programs={programOptions} />
          </section>
        ),
      },
      {
        key: "meetings",
        label: "Meetings",
        count: hubMeetings.length,
        content: (
          <section className="admin-card admin-section-card">
            <MeetingsPanel meetings={hubMeetings} publishAction={setMeetingPublished} programAction={setMeetingProgram} programOptions={programOptions} />
          </section>
        ),
      },
      {
        key: "invoices",
        label: "Invoices",
        count: hubInvoices.length,
        content: (
          <section className="admin-card admin-section-card">
            <InvoicesPanel invoices={hubInvoices} />
          </section>
        ),
      },
      { key: "team", label: "Team", content: <HubTeamPanel team={team} /> },
    ];

    return { tabs, programs: programSummaries, people, touchpoints: supporting?.touchpoints ?? [] };
  }

  const hub = view === "hub" ? await hubData() : null;
  const tabs = hub ? hub.tabs : await internalTabs();

  return (
    <div>
      <PageHead
        eyebrow={<Link href={back.href}>{back.label}</Link>}
        title={name}
        sub={company.website_url || undefined}
        action={
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {company.archived_at && <Badge tone="neutral">Archived</Badge>}
              {isClient ? <Badge tone="ok">Client</Badge> : company.lifecycle_stage && <Badge tone="neutral">{humanize(company.lifecycle_stage)}</Badge>}
              {company.priority && <Badge>{humanize(company.priority)}</Badge>}
            </span>
            <CrmCommandBar
              kind="company"
              id={company.id}
              name={name}
              archived={!!company.archived_at}
              assumeCompanyId={company.id}
              affiliate={{ active: !!companyAffiliate?.active, code: companyAffiliate?.code ?? null }}
            />
          </div>
        }
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="admin-viewtoggle">
          <Link href={`/admin/revenue/companies/${company.id}${mergeQuery(searchParams, { view: "internal" })}`} className={view === "internal" ? "is-active" : ""}>
            Internal
          </Link>
          <Link href={`/admin/revenue/companies/${company.id}${mergeQuery(searchParams, { view: "hub" })}`} className={view === "hub" ? "is-active" : ""}>
            Client Hub
          </Link>
        </div>
        <span className="admin-cell-muted" style={{ fontSize: 13 }}>
          {deals.length} {deals.length === 1 ? "deal" : "deals"}
          {dealValueCents ? ` · ${formatCents(dealValueCents, "usd")} total` : ""} ·{" "}
          <Link href={`/admin/revenue/deals?company=${company.id}`}>Open in CRM →</Link>
        </span>
      </div>

      {hub && (
        <HubProgramsBand
          programs={hub.programs}
          audience="admin"
          programHref={(programId) => `/admin/revenue/companies/${company.id}/programs/${programId}`}
          people={hub.people}
          touchpoints={hub.touchpoints}
          actions={{
            update: updateProgramEngagement.bind(null, company.id),
            setupWorkspace: setupProgramWorkspace.bind(null, company.id),
            logTouchpoint: sup.adminLogTouchpoint.bind(null, company.id),
          }}
        />
      )}

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
      </div>
    </div>
  );
}
