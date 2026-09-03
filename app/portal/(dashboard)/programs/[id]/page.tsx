import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalMember } from "@/lib/portal-auth";
import { getProgramForActor, getPlanBriefForActor } from "@/lib/portal/pr-programs";
import {
  listHubBoardsForActor,
  getBoardViewForActor,
  type PortalBoardView,
} from "@/lib/portal/program-hub";
import { getMeetingsForActor } from "@/lib/portal/meetings";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { ClientBoardView } from "@/components/hub/ClientBoardView";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { BriefViewer } from "./BriefViewer";
import { ProgramDocuments } from "./ProgramDocuments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PR Program",
  description: "Your PR program's activity, documents, and meetings.",
};

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

// The client-facing PR Program workspace: the activity board, documents, plan
// briefs, and meetings — client-safe fields only. The 90-day plan and coverage
// have their own pages (/portal/plan, /portal/coverage).
export default async function PrProgramDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParamsObj;
}) {
  const actor = await requirePortalMember();
  // IDOR gate first: the program must belong to the actor's companyScope.
  const program = await getProgramForActor(actor, params.id);
  if (!program) notFound();

  const [allMeetings, allBoards] = await Promise.all([getMeetingsForActor(actor), listHubBoardsForActor(actor)]);

  // Work board(s): the program's boards; ?board= picks one when several exist.
  const programBoards = allBoards.filter((b) => b.prProgramId === program.id);
  const boardSlug = firstParam(searchParams.board);
  const selectedBoard = programBoards.find((b) => b.slug === boardSlug) ?? programBoards[0] ?? null;
  const boardView: PortalBoardView | null = selectedBoard
    ? await getBoardViewForActor(actor, selectedBoard.id)
    : null;

  // Meetings: this program's tagged meetings. Visibility is the lib's own
  // rule: published meetings, plus drafts of companies the actor manages.
  const meetings = allMeetings.filter((m) => m.prProgramId === program.id);

  // Plan briefs (guided 5Ds plans with saved HTML).
  const briefs = new Map<string, string>();
  await Promise.all(
    program.plans
      .filter((p) => p.method === "chat" && p.hasBrief)
      .map(async (p) => {
        const html = await getPlanBriefForActor(actor, p.id);
        if (html) briefs.set(p.id, html);
      }),
  );

  const tabs: TabDef[] = [
    {
      key: "board",
      label: "Activity",
      content: boardView ? (
        <>
          {programBoards.length > 1 && (
            <div className="admin-viewtoggle u-mb-4">
              {programBoards.map((b) => (
                <Link
                  key={b.id}
                  href={`/portal/programs/${program.id}?tab=board&board=${b.slug}`}
                  className={selectedBoard?.id === b.id ? "is-active" : ""}
                >
                  {b.name}
                </Link>
              ))}
            </div>
          )}
          <ClientBoardView board={boardView} viewerPersonId={actor.personId} />
        </>
      ) : (
        <section className="admin-card admin-section-card">
          <Empty text="No activity board for this program yet." />
        </section>
      ),
    },
    {
      key: "overview",
      label: "Plan briefs",
      content:
        program.plans.length > 0 ? (
          <section className="admin-card admin-section-card u-max-narrow">
            <h2 className="admin-card-title u-mb-3">Plan briefs</h2>
            <div className="admin-panel">
              {program.plans.map((pl) => (
                <div key={pl.id}>
                  <div className="u-row u-mb-2">
                    <strong>{pl.title}</strong>
                    <Badge>{pl.method === "chat" ? "Guided plan" : pl.method === "linkedin_strategy" ? "LinkedIn strategy" : "Documents"}</Badge>
                    <span className="admin-cell-muted">{formatDate(pl.createdAt)}</span>
                  </div>
                  {pl.method === "chat" && briefs.has(pl.id) ? (
                    <BriefViewer html={briefs.get(pl.id)!} title={pl.title} />
                  ) : pl.method === "chat" ? (
                    <div className="admin-cell-muted">This plan has no saved brief.</div>
                  ) : (
                    <div className="admin-cell-muted">See the Documents tab.</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="admin-card admin-section-card">
            <Empty text="No plan brief for this program yet. Your 90-day plan lives under 90-Day Plan." />
          </section>
        ),
    },
    {
      key: "documents",
      label: "Documents",
      count: program.documents.length,
      content: (
        <section className="admin-card admin-section-card u-max-narrow">
          {program.documents.length === 0 ? (
            <Empty text="No documents uploaded." />
          ) : (
            <ProgramDocuments documents={program.documents} actorEmail={actor.email} />
          )}
        </section>
      ),
    },
    {
      key: "meetings",
      label: "Meetings",
      count: meetings.length,
      content: (
        <section className="admin-card admin-section-card u-max-narrow">
          <MeetingsPanel meetings={meetings} detailBasePath="/portal/meetings" />
        </section>
      ),
    },
  ];

  return (
    <div className="admin-content">
      <PageHead
        eyebrow={<Link href="/portal/hub">← Overview</Link>}
        title={program.name}
        sub={`Created ${formatDate(program.createdAt)}`}
        action={<Badge tone={statusTone(program.status)}>{humanize(program.status)}</Badge>}
      />
      <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
    </div>
  );
}
