import { Badge } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { NEW_ASSIGNMENT_DAYS, PRIORITY_LABEL, PRIORITY_TONE, initials } from "@/lib/boards/types";
import { PR_TASK_TYPE_LABEL, type PrTaskType } from "@/lib/pr/enums";
import {
  STAGE_WON,
  STAGE_LEAD,
  STAGE_NEUTRAL,
  STAGE_PROPOSAL,
  STAGE_DISCOVERY,
  STAGE_CONTRACT,
} from "@/lib/admin/stageColors";
import type { ClientBoardColumn, ClientBoardCard } from "@/lib/boards/client-view";

// Only the columns + cards are rendered here, so accept any board shape that
// carries them (the full ClientBoardView, or the portal's narrower board data).
type BoardData = { columns: ClientBoardColumn[]; cards: ClientBoardCard[] };

// Read-only kanban of a PR program's Work Board. The portal passes only
// non-internal cards (the loader's default); the team hub passes internal
// ones too, which render with a lock chip so staff can see what the client
// does not. `viewerPersonId` marks the viewer's own cards.
const NONDONE_ACCENTS = [STAGE_NEUTRAL, STAGE_LEAD, STAGE_PROPOSAL, STAGE_DISCOVERY, STAGE_CONTRACT];

function Lock() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden style={{ verticalAlign: "-1px" }}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function ClientBoardView({
  board,
  viewerPersonId,
  fallbackAssignee = "Account team",
}: {
  board: BoardData;
  viewerPersonId?: string | null;
  fallbackAssignee?: string;
}) {
  let nd = 0;
  const accents = board.columns.map((c) => (c.isDone ? STAGE_WON : NONDONE_ACCENTS[nd++ % NONDONE_ACCENTS.length]));

  return (
    <div className="sap-kanban">
      {board.columns.map((col, i) => {
        const colCards = board.cards.filter((c) => c.columnId === col.id);
        return (
          <div className="sap-col" key={col.id}>
            <div className="sap-col-head">
              <span className="sap-col-dot" style={{ background: accents[i] }} />
              <span className="sap-col-label">{col.name}</span>
              <span className="sap-col-count">{colCards.length}</span>
            </div>
            <div className="sap-col-body">
              {colCards.map((c) => {
                const isNew = !c.done && Date.now() - new Date(c.createdAt).getTime() < NEW_ASSIGNMENT_DAYS * 86400000;
                const who = c.assigneeName ?? fallbackAssignee;
                const mine = !!viewerPersonId && c.assigneeId === viewerPersonId;
                return (
                  <div
                    className="sap-card sap-card--static"
                    key={c.id}
                    style={c.internal ? { boxShadow: "inset 3px 0 0 var(--admin-err-ink)" } : undefined}
                  >
                    <div className="sap-card-meta">
                      {c.internal && (
                        <Badge tone="neutral">
                          <Lock /> Internal
                        </Badge>
                      )}
                      {c.prType && <Badge tone="info">{PR_TASK_TYPE_LABEL[c.prType as PrTaskType] ?? c.prType}</Badge>}
                      {isNew && <Badge tone="info">New</Badge>}
                      {mine && <Badge tone="ok">Mine</Badge>}
                    </div>
                    <div className="sap-card-title">{c.title}</div>
                    {c.statusNote && (
                      <div className="sap-card-sub" style={{ fontStyle: "italic", marginTop: 2 }}>{c.statusNote}</div>
                    )}
                    <div className="sap-card-meta">
                      <span className="sap-card-assignee">
                        <span className="sap-avatar">{initials(who)}</span>
                        {who}
                      </span>
                      <Badge tone={PRIORITY_TONE[c.priority]}>{PRIORITY_LABEL[c.priority]}</Badge>
                      {c.dueDate && (
                        <span className="sap-card-sub" style={{ marginLeft: "auto" }}>
                          {formatDate(c.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {colCards.length === 0 && <div className="sap-col-empty">No cards</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
