import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalMember } from "@/lib/portal-auth";
import { getProgramForActor, getPlanBriefForActor } from "@/lib/portal/pr-programs";
import {
  listHubBoardsForActor,
  getBoardViewForActor,
  type PortalBoardView,
} from "@/lib/portal/program-hub";
import { getBacklogForActor, getGroupsForActor } from "@/lib/portal/backlog";
import { getMeetingsForActor } from "@/lib/portal/meetings";
import { isPortalAdmin, canContribute } from "@/lib/portal/roles";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { ClientBoardView } from "@/components/hub/ClientBoardView";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { BacklogPortalView } from "../../roadmap/BacklogPortalView";
import { formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { BriefViewer } from "./BriefViewer";
import { ProgramDocuments } from "./ProgramDocuments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PR Program",
  description: "Your PR program's overview, roadmap, work board, documents, and meetings.",
};

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

// The client-facing PR Program workspace: one program's roadmap, work board,
// documents, plan brief, and meetings, mirroring the admin program view with
// client-safe fields only.
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

  const [allItems, allGroups, allMeetings, allBoards] = await Promise.all([
    getBacklogForActor(actor),
    getGroupsForActor(actor),
    getMeetingsForActor(actor),
    listHubBoardsForActor(actor),
  ]);

  // Roadmap: this program's items, under its own sections plus any
  // company-wide section a program item still sits in (same rule as the hub).
  const roadmapItems = allItems.filter((i) => i.pr_program_id === program.id);
  const usedKeys = new Set(roadmapItems.map((i) => i.group_key));
  const roadmapGroups = allGroups.filter(
    (g) => g.pr_program_id === program.id || (g.pr_program_id === null && usedKeys.has(g.key)),
  );
  const canPrioritize = isPortalAdmin(actor, program.companyId);
  const canPropose = canContribute(actor, program.companyId);

  // Work board(s): the program's boards; ?board= picks one when several exist.
  const programBoards = allBoards.filter((b) => b.prProgramId === program.id);
  const boardSlug = firstParam(searchParams.board);
  const selectedBoard = programBoards.find((b) => b.slug === boardSlug) ?? programBoards[0] ?? null;
  const boardView: PortalBoardView | null = selectedBoard
    ? await getBoardViewForActor(actor, selectedBoard.id)
    : null;

  // Meetings: this program's tagged meetings. Visibility is the lib's own
  // rule (same as the hub): getMeetingsForActor returns published meetings,
  // plus drafts of companies the actor manages, so client managers see this
  // program's drafts here too and other members stay published-only.
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
      key: "overview",
      label: "Overview",
      content:
        program.plans.length > 0 ? (
          <section className="admin-card admin-section-card" style={{ maxWidth: 900 }}>
            <h2 className="admin-card-title" style={{ marginBottom: 12 }}>Plan</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {program.plans.map((pl) => (
                <div key={pl.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <strong>{pl.title}</strong>
                    <Badge>{pl.method === "chat" ? "Guided plan" : "Documents"}</Badge>
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
            <Empty text="No plan for this program yet. Edge8 adds one as the program is scoped." />
          </section>
        ),
    },
    {
      key: "roadmap",
      label: "Roadmap",
      count: roadmapItems.length,
      content:
        roadmapItems.length === 0 && roadmapGroups.length === 0 ? (
          <section className="admin-card admin-section-card">
            <Empty text="No roadmap items in this program yet. Edge8 adds them as the program is scoped." />
          </section>
        ) : (
          <BacklogPortalView
            items={roadmapItems}
            groups={roadmapGroups}
            companyId={program.companyId}
            canPrioritize={canPrioritize}
            canPropose={canPropose}
            programId={program.id}
          />
        ),
    },
    {
      key: "board",
      label: "Work Board",
      content: boardView ? (
        <>
          {programBoards.length > 1 && (
            <div className="admin-viewtoggle" style={{ marginBottom: 14 }}>
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
          <Empty text="No work board for this program yet." />
        </section>
      ),
    },
    {
      key: "documents",
      label: "Documents",
      count: program.documents.length,
      content: (
        <section className="admin-card admin-section-card" style={{ maxWidth: 900 }}>
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
        <section className="admin-card admin-section-card" style={{ maxWidth: 900 }}>
          <MeetingsPanel meetings={meetings} detailBasePath="/portal/meetings" />
        </section>
      ),
    },
  ];

  return (
    <div className="admin-content">
      <PageHead
        eyebrow={<Link href="/portal/hub">← PR Programs</Link>}
        title={program.name}
        sub={`Created ${formatDate(program.createdAt)}`}
        action={<Badge tone={statusTone(program.status)}>{humanize(program.status)}</Badge>}
      />
      <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
    </div>
  );
}
