import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import type { ProgramStatus, ProgramSummary } from "@/lib/hub/program";

// The hub home's top band, shared by the admin company 360 (Client Hub view)
// and the team client hub Overview: the PR Programs card grid. Read-only; each
// card links into the surface's own program view via programHref.

const PROGRAM_STATUS_TONE: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "ok",
  complete: "info",
};

export function HubProgramsBand({
  programs,
  programHref,
}: {
  programs: ProgramSummary[];
  programHref: (programId: string) => string;
}) {
  return (
    <>
      <div className="hub-band-head">
        <h2 className="admin-card-title">PR Programs</h2>
      </div>
      {programs.length === 0 ? (
        <div className="admin-card admin-section-card" style={{ marginBottom: 20 }}>
          <div className="admin-empty">No PR Programs yet. Created from the client portal or by Edge8.</div>
        </div>
      ) : (
        <div className="mp-kpi-grid hub-programs-grid">
          {programs.map((p) => {
            const pct = p.roadmapTotal > 0 ? Math.round((p.roadmapDone / p.roadmapTotal) * 100) : 0;
            return (
              <Link
                key={p.id}
                href={programHref(p.id)}
                className="admin-card admin-section-card hub-program-card"
              >
                <div className="hub-program-head">
                  <span className="admin-cell-strong" style={{ fontSize: 15 }}>{p.name}</span>
                  <Badge tone={PROGRAM_STATUS_TONE[p.status]}>{p.status}</Badge>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div className="admin-cell-muted hub-program-progressrow">
                    <span>
                      {p.roadmapTotal === 0
                        ? "No roadmap items yet"
                        : `Roadmap ${p.roadmapDone}/${p.roadmapTotal} done`}
                    </span>
                    {p.roadmapTotal > 0 && <span>{pct}%</span>}
                  </div>
                  <div className="board-progress">
                    <div className="board-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="admin-cell-muted" style={{ marginTop: 12, fontSize: 12 }}>
                  {p.boardCount} {p.boardCount === 1 ? "board" : "boards"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
