import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { contributorCompanyScope } from "@/lib/portal/roles";
import { listPortalProgramSummaries, listHubBoardsForActor, getBoardViewForActor } from "@/lib/portal/program-hub";
import { getPlanTabForActor } from "@/lib/portal/plan";
import { listOutcomesForActor } from "@/lib/portal/outcomes";
import { listAwardsForActor, listCaseStudiesForActor } from "@/lib/portal/supporting";
import { getMeetingsForActor } from "@/lib/portal/meetings";
import { listDocumentsForActor } from "@/lib/portal/documents";
import { getInvoicesForActor } from "@/lib/portal/invoices";
import { PageHead } from "@/components/admin/PageHead";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { PlanScopeSwitch } from "@/components/hub/PlanScopeSwitch";
import { QuarterlyPlanPanel } from "@/components/hub/QuarterlyPlanPanel";
import { ClientBoardView } from "@/components/hub/ClientBoardView";
import { CoveragePanel } from "@/components/hub/CoveragePanel";
import { AwardsPanel } from "@/components/hub/AwardsPanel";
import { CaseStudiesPanel } from "@/components/hub/CaseStudiesPanel";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { PortalProgramBand } from "@/components/portal/PortalProgramBand";
import { PortalInvoices } from "@/components/portal/PortalInvoices";
import { DocumentsView } from "./documents/DocumentsView";
import { targetOnTrack } from "@/lib/hub/plan";
import type { OutcomeRow } from "@/lib/hub/outcomes";
import { ALL_TIME, AWARD_IN_FLIGHT, resolvePlanScope, scopeAwards, scopeCards, scopeCaseStudies, scopeLabel, scopeOutcomes, scopeParam } from "@/lib/hub/scope";
import { quarterFor } from "@/lib/pr/quarters";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { formatDate } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "The Hub" };

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

// The Hub: the client's mirror of the admin Client Hub. The program band on
// top (client-safe fields, four tallies), then the same tabs the team works
// in — 90-Day Plan, Work Board, Coverage, Awards, Case Studies, Documents,
// Meetings, Invoices. Every read is company-scoped and published-only by
// construction; the All time / quarter switch uses the same rule as admin.
export default async function PortalHubPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const actor = await requirePortalMember();
  const planParam = firstParam(searchParams.plan);
  const [programs, plan, allOutcomes, allAwards, allCases, meetings, boards, documents, invoices] = await Promise.all([
    listPortalProgramSummaries(actor),
    getPlanTabForActor(actor, planParam === ALL_TIME ? null : planParam),
    listOutcomesForActor(actor),
    listAwardsForActor(actor),
    listCaseStudiesForActor(actor),
    getMeetingsForActor(actor),
    listHubBoardsForActor(actor),
    listDocumentsForActor(actor),
    getInvoicesForActor(actor),
  ]);
  const canCreate = contributorCompanyScope(actor).length > 0;
  const program = programs[0] ?? null;

  if (!program) {
    return (
      <div>
        <PageHead eyebrow="Client hub" title="The Hub" />
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title u-mb-2">No PR programme yet</h2>
          <p className="admin-page-sub u-m-0">This is where your plan, activity and coverage will live once the programme starts.</p>
          {canCreate && (
            <div className="u-mt-4">
              <Link href="/portal/programs/add" className="admin-btn admin-btn--primary">Add PR Program</Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const scope = resolvePlanScope(plan?.plans ?? [], planParam);
  const label = scopeLabel(scope);
  const scopeValue = scopeParam(scope);
  const outcomes = scopeOutcomes(allOutcomes.map((o) => ({ ...o, createdAt: o.publishDate ?? "" })), scope);
  const awards = scopeAwards(allAwards, scope);
  const caseStudies = scopeCaseStudies(allCases, scope);
  const coverage = outcomes.filter((o) => o.kind === "coverage");
  const posts = outcomes.filter((o) => o.kind === "linkedin");
  const targets = plan?.targets ?? [];
  const postTarget = scope.mode === "plan" ? plan?.targets.find((t) => t.group_key === "linkedin-authority")?.quantity_target ?? null : null;

  const programBoard = boards.find((b) => b.prProgramId === program.id) ?? boards[0] ?? null;
  const fullBoard = programBoard ? await getBoardViewForActor(actor, programBoard.id) : null;
  const board = fullBoard ? { ...fullBoard, cards: scopeCards(fullBoard.cards, scope) } : null;
  const columnName = new Map((board?.columns ?? []).map((c) => [c.id, c.name]));
  const waitingCards = (board?.cards ?? []).filter((c) => !c.done && /waiting/i.test(columnName.get(c.columnId ?? "") ?? ""));

  // The read-only coverage panel takes the full row shape; client-safe fields
  // only are populated, the internal ones are null by construction.
  const coverageRows: OutcomeRow[] = outcomes.map((o) => ({
    id: o.id,
    kind: o.kind,
    channel: o.channel,
    title: o.title,
    outlet: o.outlet,
    url: o.url,
    publishDate: o.publishDate,
    publishedAt: o.publishDate,
    reach: o.reach,
    copyMd: o.copyMd,
    taskId: null,
    taskTitle: null,
    backlogItemId: null,
    targetTitle: o.targetTitle,
    journalistId: null,
    journalistName: null,
    caseStudyId: null,
    mediaAssetDocumentId: null,
    mediaAssetName: null,
    createdAt: o.publishDate ?? "",
  }));
  const coverageKind = firstParam(searchParams.kind) === "linkedin" ? "linkedin" : "coverage";
  const companies = actor.memberships
    .filter((m): m is typeof m & { companyId: string } => !!m.companyId)
    .map((m) => ({ companyId: m.companyId, companyName: m.companyName ?? "Your company" }));
  const q = `plan=${encodeURIComponent(scopeValue)}`;

  const tabs: TabDef[] = [
    {
      key: "plan",
      label: "90-Day Plan",
      count: targets.length || undefined,
      content: plan ? (
        <QuarterlyPlanPanel
          programId={plan.programId}
          plans={plan.plans}
          selected={plan.selected}
          targets={plan.targets}
          groups={plan.groups}
          planHrefBase={`/portal?tab=plan&plan=`}
          suggestNext={quarterFor(new Date())}
        />
      ) : (
        <section className="admin-card admin-section-card"><Empty text="Your 90-day plan will appear here once it is published." /></section>
      ),
    },
    {
      key: "board",
      label: "Work Board",
      count: board ? board.cards.filter((c) => !c.done).length || undefined : undefined,
      content: board ? <ClientBoardView board={board} viewerPersonId={actor.personId} /> : <section className="admin-card admin-section-card"><Empty text="No activity board yet." /></section>,
    },
    {
      key: "coverage",
      label: "Coverage",
      count: coverageRows.length || undefined,
      content: (
        <section className="admin-card admin-section-card">
          <CoveragePanel programId={program.id} rows={coverageRows} kind={coverageKind} kindHrefBase={`/portal?tab=coverage&${q}&kind=`} />
        </section>
      ),
    },
    {
      key: "awards",
      label: "Awards",
      count: awards.length || undefined,
      content: <section className="admin-card admin-section-card"><AwardsPanel programId={program.id} rows={awards} /></section>,
    },
    {
      key: "case-studies",
      label: "Case Studies",
      count: caseStudies.length || undefined,
      content: <section className="admin-card admin-section-card"><CaseStudiesPanel programId={program.id} rows={caseStudies} /></section>,
    },
    {
      key: "documents",
      label: "Documents",
      count: documents.length || undefined,
      content: (
        <section className="admin-card admin-section-card">
          <DocumentsView documents={documents} companies={companies} actorEmail={actor.email} />
        </section>
      ),
    },
    {
      key: "meetings",
      label: "Meetings",
      count: meetings.length || undefined,
      content: (
        <section className="admin-card admin-section-card">
          <MeetingsPanel meetings={meetings} detailBasePath="/portal/meetings" />
        </section>
      ),
    },
    ...(invoices.length > 0
      ? [
          {
            key: "invoices",
            label: "Invoices",
            count: invoices.length,
            content: <section className="admin-card admin-section-card"><PortalInvoices invoices={invoices} /></section>,
          } satisfies TabDef,
        ]
      : []),
  ];

  const current = scope.mode === "plan" ? scope.plan : plan?.selected ?? null;

  return (
    <div>
      <PageHead eyebrow="Client hub" title="The Hub" sub={current ? `${current.quarter_label} · ${formatDate(current.starts_on)} – ${formatDate(current.ends_on)}` : "Your PR programme"} />

      <PortalProgramBand
        name={program.name}
        status={program.status}
        accountLead={program.accountLead}
        strategicLead={program.strategicLead}
        quarterLabel={current?.quarter_label ?? null}
        quarterDates={current ? `${formatDate(current.starts_on)} – ${formatDate(current.ends_on)}` : null}
        scopeSwitch={plan ? <PlanScopeSwitch plans={plan.plans.map((p) => ({ id: p.id, label: p.quarter_label }))} value={scopeValue} /> : undefined}
        scopeLabel={label}
        kpis={{
          coverage: coverage.length,
          posts: posts.length,
          postTarget,
          targetsOnTrack: targets.filter(targetOnTrack).length,
          targetsTotal: targets.length,
          hasPlan: !!plan?.selected,
          awardsInFlight: awards.filter((a) => AWARD_IN_FLIGHT.has(a.stage)).length,
        }}
      />

      {waitingCards.length > 0 && (
        <section className="admin-card admin-section-card admin-card--attention u-mb-4">
          <h2 className="admin-card-title u-mb-3">Waiting on you</h2>
          <div className="admin-list">
            {waitingCards.map((c) => (
              <div className="admin-list-row" key={c.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">{c.title}</div>
                  {c.dueDate && <div className="admin-list-sub">Needed by {formatDate(c.dueDate)}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
      </div>
    </div>
  );
}
