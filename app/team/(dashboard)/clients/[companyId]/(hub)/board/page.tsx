import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getClientBoardViewForActor, getActorClientCompanies, getHubOverviewForActor, getHubPlansForActor } from "@/lib/team/clients";
import { isBoardMemberForActor } from "@/lib/team/boards";
import { resolvePlanScope, scopeCards } from "@/lib/hub/scope";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { MyCardsStrip, type MyStripCard } from "./MyCardsStrip";
import { ClientBoardView } from "@/components/hub/ClientBoardView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "Work Board" };

// The Work Board tab: the program's board with the PR column ladder. The
// team sees every card; locked (internal) cards wear a lock chip and never
// reach the client hub. Editing happens on the full board at /team/boards.

function Lock() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="admin-icon-inline">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export default async function TeamClientBoardTab({ params, searchParams }: { params: { companyId: string }; searchParams: SearchParamsObj }) {
  const actor = await requireTeamMember();
  // Assignment gate first: an unassigned actor gets a 404 even to learn
  // whether a board exists.
  const companies = await getActorClientCompanies(actor);
  if (!companies.some((c) => c.id === params.companyId)) notFound();

  const [overview, plans] = await Promise.all([getHubOverviewForActor(actor, params.companyId), getHubPlansForActor(actor, params.companyId)]);
  const program = overview?.programs[0] ?? null;
  const fullBoard = program
    ? await getClientBoardViewForActor(actor, params.companyId, { programId: program.id, includeInternal: true })
    : await getClientBoardViewForActor(actor, params.companyId, { includeInternal: true });
  // The plan scope: cards that were live during the chosen quarter.
  const scope = resolvePlanScope(plans, firstParam(searchParams.plan));
  const board = fullBoard ? { ...fullBoard, cards: scopeCards(fullBoard.cards, scope) } : null;

  if (!board) {
    return (
      <div className="admin-card admin-section-card">
        <p className="admin-page-sub u-m-0">
          No Work Board yet. Set one up from the Overview tab (it seeds the PR columns: Planned → Pitching → In progress → Waiting → Delivered).
        </p>
      </div>
    );
  }

  // Board members get quick move controls on their own open cards; everyone
  // else keeps the read-only view. moveCard re-checks membership server-side,
  // so this gate is UI only.
  const isMember = await isBoardMemberForActor(actor, board.boardId);
  const myCards: MyStripCard[] = isMember
    ? board.cards
        .filter((c) => !c.done && c.assigneeId === actor.personId)
        .map((c) => ({ id: c.id, title: c.title, priority: c.priority, dueDate: c.dueDate, columnId: c.columnId }))
    : [];
  const lockedCount = board.cards.filter((c) => c.internal).length;

  return (
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
  );
}
