import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { companyOs } from "@/lib/supabase";
import { listAssignablePeople } from "@/lib/admin/people-options";
import {
  getActorClientCompanies,
  getHubOverviewForActor,
  getHubPlansForActor,
  getPlanTabForActor,
  getCoverageTabForActor,
  getSupportingTabForActor,
  getClientBoardViewForActor,
  getClientDocumentsForActor,
  getClientMeetingsForActor,
  getClientInvoicesForActor,
  getClientTeamForActor,
  getActorEmail,
  companyHasPrograms,
} from "@/lib/team/clients";
import { isBoardMemberForActor } from "@/lib/team/boards";
import { ALL_TIME, resolvePlanScope, scopeAwards, scopeCards, scopeCaseStudies, scopeLabel, scopeOutcomes, scopeParam, scopePipeline } from "@/lib/hub/scope";
import { scopeProgramSummary } from "@/lib/hub/scoped-band";
import { suggestNextQuarter } from "@/lib/pr/quarters";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { PageHead } from "@/components/admin/PageHead";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { PlanScopeSwitch } from "@/components/hub/PlanScopeSwitch";
import { HubProgramsBand } from "@/components/hub/HubProgramsBand";
import { QuarterlyPlanPanel } from "@/components/hub/QuarterlyPlanPanel";
import { CoveragePanel } from "@/components/hub/CoveragePanel";
import { AwardsPanel } from "@/components/hub/AwardsPanel";
import { PipelinePanel } from "@/components/hub/PipelinePanel";
import { CaseStudiesPanel } from "@/components/hub/CaseStudiesPanel";
import { MeetingsPanel, type ProgramOption } from "@/components/hub/MeetingsPanel";
import { InvoicesPanel } from "@/components/hub/InvoicesPanel";
import { HubTeamPanel } from "@/components/hub/HubTeamPanel";
import { ClientBoardView } from "@/components/hub/ClientBoardView";
import { ClientDocumentsList } from "./ClientDocumentsList";
import { MyCardsStrip, type MyStripCard } from "./MyCardsStrip";
import { teamSetupProgramWorkspace, teamUpdateProgramEngagement } from "./program-actions";
import {
  teamArchiveAward, teamArchiveCaseStudy, teamArchivePipeline, teamCreateAward, teamCreateCaseStudy,
  teamCreatePipeline, teamLogTouchpoint, teamPromotePipeline, teamPublishAward, teamPublishCaseStudy,
  teamPublishPipeline, teamUpdateAward, teamUpdateCaseStudy, teamUpdatePipeline,
} from "./supporting-actions";
import { teamArchiveTarget, teamCreatePlan, teamCreateTarget, teamCreateWorkstream, teamPublishPlan, teamUpdatePlan, teamUpdateTarget } from "./plan/actions";
import { teamCreateOutcome, teamPublishOutcome, teamRemoveOutcome, teamUpdateOutcome } from "./coverage/actions";
import { publishMeeting, setMeetingProgram } from "./meetings/actions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "Client Hub" };

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

function Lock() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="admin-icon-inline">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

// The Team client hub: the same page an admin sees at /admin/clients/[id] and
// a client sees at /portal, scoped to this team member's assigned clients and
// editable through their own actor-gated actions. Band on top, then the tabs:
// 90-Day Plan / Work Board / Coverage / Awards / Pipeline / Case Studies /
// Documents / Meetings / Invoices / Team. The All time / quarter switch drives
// the band tallies and every tab, exactly as on the other two surfaces.
export default async function TeamClientHubPage({ params, searchParams }: { params: { companyId: string }; searchParams: SearchParamsObj }) {
  const actor = await requireTeamMember();
  const companyId = params.companyId;
  const hubBase = `/team/clients/${companyId}`;
  const planParam = firstParam(searchParams.plan);

  // Assignment gate: an unassigned actor 404s before any data is read.
  const companies = await getActorClientCompanies(actor);
  const company = companies.find((c) => c.id === companyId);
  if (!company) notFound();

  const [overview, plans, planData, coverage, supporting, people, documents, meetings, invoices, team, actorEmail, hasPrograms, programRowsRes] =
    await Promise.all([
      getHubOverviewForActor(actor, companyId),
      getHubPlansForActor(actor, companyId),
      getPlanTabForActor(actor, companyId, planParam === ALL_TIME ? null : planParam),
      getCoverageTabForActor(actor, companyId),
      getSupportingTabForActor(actor, companyId),
      listAssignablePeople(),
      getClientDocumentsForActor(actor, companyId),
      getClientMeetingsForActor(actor, companyId),
      getClientInvoicesForActor(actor, companyId),
      getClientTeamForActor(actor, companyId),
      getActorEmail(actor),
      companyHasPrograms(companyId),
      companyOs.from("pr_programs").select("id, name").eq("company_id", companyId).order("created_at", { ascending: false }),
    ]);

  const program = overview?.programs[0] ?? null;
  const scope = resolvePlanScope(plans, planParam);
  const scopeValue = scopeParam(scope);
  const label = scopeLabel(scope);
  const scopeSwitch =
    plans.length > 0 ? (
      <PlanScopeSwitch plans={plans.map((p) => ({ id: p.id, label: p.quarter_label, draft: !p.published_at }))} value={scopeValue} />
    ) : null;

  // Band tallies follow the chosen range.
  const bandPrograms = (overview?.programs ?? []).map((p, i) =>
    i === 0 && coverage && supporting ? scopeProgramSummary(p, scope, { outcomes: coverage.rows, awards: supporting.awards, plan: planData?.tab ?? null }) : p,
  );

  const programOptions = ((programRowsRes.data ?? []) as ProgramOption[]);
  const shownMeetings = hasPrograms && meetings ? meetings.filter((m) => !m.prProgramId) : (meetings ?? []);
  const shownDocs = hasPrograms && documents ? documents.filter((d) => !d.programId) : (documents ?? []);
  const planQuery = planParam ? `plan=${encodeURIComponent(planParam)}&` : "";

  // Work Board: the program's board with internal cards, scoped to the range.
  const fullBoard = program
    ? await getClientBoardViewForActor(actor, companyId, { programId: program.id, includeInternal: true })
    : await getClientBoardViewForActor(actor, companyId, { includeInternal: true });
  const board = fullBoard ? { ...fullBoard, cards: scopeCards(fullBoard.cards, scope) } : null;
  const isMember = board ? await isBoardMemberForActor(actor, board.boardId) : false;
  const myCards: MyStripCard[] = board && isMember
    ? board.cards.filter((c) => !c.done && c.assigneeId === actor.personId).map((c) => ({ id: c.id, title: c.title, priority: c.priority, dueDate: c.dueDate, columnId: c.columnId }))
    : [];
  const lockedCount = board ? board.cards.filter((c) => c.internal).length : 0;

  const tabs: TabDef[] = [
    ...(planData
      ? [
          {
            key: "plan",
            label: "90-Day Plan",
            count: planData.tab.targets.length || undefined,
            content: (
              <QuarterlyPlanPanel
                programId={planData.program.id}
                plans={planData.tab.plans}
                selected={planData.tab.selected}
                targets={planData.tab.targets}
                groups={planData.tab.groups}
                meetings={planData.meetings.map((m) => ({ id: m.id, title: m.title, date: m.meetingDate }))}
                meetingHrefBase={`${hubBase}?tab=meetings`}
                planHrefBase={`${hubBase}?tab=plan&plan=`}
                suggestNext={suggestNextQuarter(planData.tab.plans[0]?.ends_on ?? null)}
                actions={{
                  createPlan: teamCreatePlan.bind(null, companyId),
                  updatePlan: teamUpdatePlan.bind(null, companyId),
                  publishPlan: teamPublishPlan.bind(null, companyId),
                  createTarget: teamCreateTarget.bind(null, companyId),
                  updateTarget: teamUpdateTarget.bind(null, companyId),
                  archiveTarget: teamArchiveTarget.bind(null, companyId),
                  createWorkstream: teamCreateWorkstream.bind(null, companyId),
                }}
              />
            ),
          } satisfies TabDef,
        ]
      : []),
    {
      key: "board",
      label: "Work Board",
      content: board ? (
        <>
          <div className="u-row u-wrap u-between u-mb-4">
            <p className="admin-page-sub u-m-0">
              {board.boardName}.{" "}
              {isMember ? (
                <>Work the full board at <Link href={`/team/boards/${board.boardSlug}`}>Work Boards</Link>.</>
              ) : (
                <>You are not a member of this board, so the view is read-only.</>
              )}
            </p>
            <span className="admin-cell-muted u-sm u-row u-gap-1">
              <Lock /> {lockedCount} locked {lockedCount === 1 ? "card" : "cards"} — locked cards never appear in the client hub
            </span>
          </div>
          {isMember && <MyCardsStrip cards={myCards} columns={board.columns} boardSlug={board.boardSlug} />}
          <ClientBoardView board={board} viewerPersonId={actor.personId} />
        </>
      ) : (
        <section className="admin-card admin-section-card">
          <Empty text="No Work Board yet. Use “Set up Work Board” on the program band above — it seeds the PR columns." />
        </section>
      ),
    },
    ...(coverage
      ? [
          {
            key: "coverage",
            label: "Coverage",
            count: scopeOutcomes(coverage.rows, scope).length || undefined,
            content: (
              <CoveragePanel
                programId={coverage.program.id}
                rows={scopeOutcomes(coverage.rows, scope)}
                kind={firstParam(searchParams.kind) === "linkedin" ? "linkedin" : "coverage"}
                kindHrefBase={`${hubBase}?tab=coverage&${planQuery}kind=`}
                targets={coverage.targets}
                tasks={coverage.tasks}
                journalists={coverage.journalists}
                documents={coverage.documents}
                actions={{
                  create: teamCreateOutcome.bind(null, companyId),
                  update: teamUpdateOutcome.bind(null, companyId),
                  publish: teamPublishOutcome.bind(null, companyId),
                  remove: teamRemoveOutcome.bind(null, companyId),
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
            count: scopeAwards(supporting.awards, scope).length || undefined,
            content: (
              <AwardsPanel
                programId={supporting.program.id}
                rows={scopeAwards(supporting.awards, scope)}
                documents={supporting.documents}
                plans={supporting.plans}
                actions={{
                  createAward: teamCreateAward.bind(null, companyId),
                  updateAward: teamUpdateAward.bind(null, companyId),
                  publishAward: teamPublishAward.bind(null, companyId),
                  archiveAward: teamArchiveAward.bind(null, companyId),
                }}
              />
            ),
          } satisfies TabDef,
          {
            key: "pipeline",
            label: "Pipeline",
            count: scopePipeline(supporting.pipeline, scope).filter((p) => p.status !== "promoted").length || undefined,
            content: (
              <PipelinePanel
                programId={supporting.program.id}
                rows={scopePipeline(supporting.pipeline, scope)}
                plans={supporting.plans}
                groups={supporting.groups}
                actions={{
                  createPipeline: teamCreatePipeline.bind(null, companyId),
                  updatePipeline: teamUpdatePipeline.bind(null, companyId),
                  publishPipeline: teamPublishPipeline.bind(null, companyId),
                  archivePipeline: teamArchivePipeline.bind(null, companyId),
                  promotePipeline: teamPromotePipeline.bind(null, companyId),
                }}
              />
            ),
          } satisfies TabDef,
          {
            key: "case-studies",
            label: "Case Studies",
            count: scopeCaseStudies(supporting.caseStudies, scope).length || undefined,
            content: (
              <CaseStudiesPanel
                programId={supporting.program.id}
                rows={scopeCaseStudies(supporting.caseStudies, scope)}
                customers={supporting.customers}
                actions={{
                  createCaseStudy: teamCreateCaseStudy.bind(null, companyId),
                  updateCaseStudy: teamUpdateCaseStudy.bind(null, companyId),
                  publishCaseStudy: teamPublishCaseStudy.bind(null, companyId),
                  archiveCaseStudy: teamArchiveCaseStudy.bind(null, companyId),
                }}
              />
            ),
          } satisfies TabDef,
        ]
      : []),
    {
      key: "documents",
      label: "Documents",
      count: shownDocs.length || undefined,
      content: (
        <section className="admin-card admin-section-card">
          <ClientDocumentsList documents={shownDocs} companyId={companyId} actorEmail={actorEmail} />
        </section>
      ),
    },
    {
      key: "meetings",
      label: "Meetings",
      count: shownMeetings.length || undefined,
      content: (
        <section className="admin-card admin-section-card">
          <MeetingsPanel meetings={shownMeetings} publishAction={publishMeeting} programAction={setMeetingProgram} programOptions={programOptions} />
        </section>
      ),
    },
    ...(invoices && invoices.length > 0
      ? [
          {
            key: "invoices",
            label: "Invoices",
            count: invoices.length,
            content: (
              <section className="admin-card admin-section-card">
                <InvoicesPanel invoices={invoices} />
              </section>
            ),
          } satisfies TabDef,
        ]
      : []),
    ...(team ? [{ key: "team", label: "Team", content: <HubTeamPanel team={team} /> } satisfies TabDef] : []),
  ];

  return (
    <div>
      <PageHead
        eyebrow={<Link href="/team/clients">← My Clients</Link>}
        title={company.name}
        sub={company.roleTitle ? `Your role: ${company.roleTitle}` : "Client hub"}
      />

      <HubProgramsBand
        programs={bandPrograms}
        audience="team"
        people={people}
        touchpoints={supporting?.touchpoints ?? []}
        scopeSwitch={scopeSwitch}
        scopeLabel={label}
        actions={{
          update: teamUpdateProgramEngagement.bind(null, companyId),
          setupWorkspace: teamSetupProgramWorkspace.bind(null, companyId),
          logTouchpoint: teamLogTouchpoint.bind(null, companyId),
        }}
      />

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
      </div>
    </div>
  );
}
