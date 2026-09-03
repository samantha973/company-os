import Link from "next/link";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { getAdminUser } from "@/lib/admin-auth";
import { getInvoicesForCompany } from "@/lib/admin/invoices";
import { getMeetingsForCompany } from "@/lib/admin/meetings";
import { getBoardBySlug, listBoardManageOptions } from "@/lib/boards/data";
import { listDocumentsForCompanies } from "@/lib/client-documents";
import { getCompanyHubTeam } from "@/lib/admin/company-hub";
import { listProgramSummaries } from "@/lib/hub/program";
import { listAssignablePeople } from "@/lib/admin/people-options";
import { getPlanTab } from "@/lib/hub/plan";
import { getCoverageTab } from "@/lib/hub/coverage-tab";
import { getSupportingTab } from "@/lib/hub/supporting-tab";
import { suggestNextQuarter } from "@/lib/pr/quarters";
import { humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { CompanyDocuments, type ProgramOption } from "@/components/admin/CompanyDocuments";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { InvoicesPanel } from "@/components/hub/InvoicesPanel";
import { HubTeamPanel } from "@/components/hub/HubTeamPanel";
import { HubProgramsBand } from "@/components/hub/HubProgramsBand";
import { QuarterlyPlanPanel } from "@/components/hub/QuarterlyPlanPanel";
import { CoveragePanel } from "@/components/hub/CoveragePanel";
import { AwardsPanel } from "@/components/hub/AwardsPanel";
import { PipelinePanel } from "@/components/hub/PipelinePanel";
import { CaseStudiesPanel } from "@/components/hub/CaseStudiesPanel";
import { BoardView } from "@/app/admin/(dashboard)/boards/[slug]/BoardView";
import { setMeetingPublished, setMeetingProgram } from "@/app/admin/(dashboard)/revenue/meetings/actions";
import { setupProgramWorkspace, updateProgramEngagement } from "@/app/admin/(dashboard)/revenue/companies/[id]/program-actions";
import {
  adminArchiveTarget,
  adminCreatePlan,
  adminCreateTarget,
  adminCreateWorkstream,
  adminPublishPlan,
  adminUpdatePlan,
  adminUpdateTarget,
} from "@/app/admin/(dashboard)/revenue/companies/[id]/plan-actions";
import { adminCreateOutcome, adminPublishOutcome, adminRemoveOutcome, adminUpdateOutcome } from "@/app/admin/(dashboard)/revenue/companies/[id]/outcome-actions";
import * as sup from "@/app/admin/(dashboard)/revenue/companies/[id]/supporting-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Client Hub" };

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

// The Client Hub: one client's PR program, organised Plan → Effort → Outcome.
// The engagement band on top, then 90-Day Plan / Work Board / Coverage /
// Awards / Pipeline / Case Studies / Documents / Meetings / Invoices / Team.
// The company's CRM record lives at /admin/revenue/companies/[id].
export default async function ClientHubPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParamsObj;
}) {
  const { data: companyRow } = await companyOs
    .from("companies")
    .select("id, name, website_url, lifecycle_stage, priority, archived_at")
    .eq("id", params.id)
    .maybeSingle();
  const company = companyRow as {
    id: string;
    name: string | null;
    website_url: string | null;
    lifecycle_stage: string | null;
    priority: string | null;
    archived_at: string | null;
  } | null;
  if (!company) notFound();
  const name = company.name || "(no name)";
  const hubBase = `/admin/clients/${company.id}`;

  // Wave 1: everything that depends only on the company id.
  const [programs, boardRowsRes, boardOptions, admin, meetings, invoices, team, documents, people] = await Promise.all([
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

  const program = programs[0] ?? null;
  const hubBoards = (boardRowsRes.data ?? []) as Array<{ id: string; slug: string; pr_program_id: string | null }>;
  const boardSlug = (hubBoards.find((b) => b.pr_program_id === program?.id) ?? hubBoards[0])?.slug ?? null;

  // Wave 2: the reads that depend on wave 1.
  const [boardDetail, viewerRow, planTab, coverageTab, supporting] = await Promise.all([
    boardSlug ? getBoardBySlug(boardSlug) : Promise.resolve(null),
    admin
      ? companyOs.from("people").select("id").eq("email", admin.email).is("archived_at", null).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    program ? getPlanTab(company.id, program.id, { planId: firstParam(searchParams.plan) }) : Promise.resolve(null),
    program ? getCoverageTab(company.id) : Promise.resolve(null),
    program ? getSupportingTab(company.id) : Promise.resolve(null),
  ]);
  const viewerPersonId = (viewerRow.data as { id: string } | null)?.id ?? null;
  const programOptions: ProgramOption[] = programs.map((p) => ({ id: p.id, name: p.name }));
  const coverageKind = firstParam(searchParams.kind) === "linkedin" ? "linkedin" : "coverage";
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

  const tabs: TabDef[] = [
    ...(program && planTab
      ? [
          {
            key: "plan",
            label: "90-Day Plan",
            count: planTab.targets.length || undefined,
            content: (
              <QuarterlyPlanPanel
                programId={program.id}
                plans={planTab.plans}
                selected={planTab.selected}
                targets={planTab.targets}
                groups={planTab.groups}
                meetings={meetings.map((m) => ({ id: m.id, title: m.title, date: m.meetingDate }))}
                meetingHrefBase="/admin/revenue/meetings/"
                planHrefBase={`${hubBase}?tab=plan&plan=`}
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
          } satisfies TabDef,
        ]
      : []),
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
    ...(coverageTab
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
                kindHrefBase={`${hubBase}?tab=coverage&kind=`}
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
          } satisfies TabDef,
        ]
      : []),
    ...(supporting
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
          } satisfies TabDef,
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
          } satisfies TabDef,
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
          } satisfies TabDef,
        ]
      : []),
    {
      key: "documents",
      label: "Documents",
      count: documents.length,
      content: (
        <section className="admin-card admin-section-card">
          <CompanyDocuments companyId={company.id} documents={documents} programs={programOptions} />
        </section>
      ),
    },
    {
      key: "meetings",
      label: "Meetings",
      count: meetings.length,
      content: (
        <section className="admin-card admin-section-card">
          <MeetingsPanel meetings={meetings} publishAction={setMeetingPublished} programAction={setMeetingProgram} programOptions={programOptions} />
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

  return (
    <div>
      <PageHead
        eyebrow={<Link href="/admin/client-hubs">← Client Hubs</Link>}
        title={name}
        sub={company.website_url || undefined}
        action={
          <div className="u-row u-wrap">
            {company.archived_at && <Badge tone="neutral">Archived</Badge>}
            {company.priority && <Badge>{humanize(company.priority)} priority</Badge>}
            <Link href={`/admin/revenue/companies/${company.id}`} className="admin-btn admin-btn--sm">Company record →</Link>
          </div>
        }
      />

      <HubProgramsBand
        programs={programs}
        audience="admin"
        programHref={(programId) => `/admin/revenue/companies/${company.id}/programs/${programId}`}
        people={people}
        touchpoints={supporting?.touchpoints ?? []}
        actions={{
          update: updateProgramEngagement.bind(null, company.id),
          setupWorkspace: setupProgramWorkspace.bind(null, company.id),
          logTouchpoint: sup.adminLogTouchpoint.bind(null, company.id),
        }}
      />

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
      </div>
    </div>
  );
}
