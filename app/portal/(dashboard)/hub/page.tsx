import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { contributorCompanyScope } from "@/lib/portal/roles";
import { listPortalProgramSummaries, listHubBoardsForActor, getBoardViewForActor } from "@/lib/portal/program-hub";
import { getPlanTabForActor } from "@/lib/portal/plan";
import { listOutcomesForActor } from "@/lib/portal/outcomes";
import { getMeetingsForActor } from "@/lib/portal/meetings";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge, statusTone } from "@/components/admin/Badge";
import { targetDone, targetOnTrack } from "@/lib/hub/plan";
import { COVERAGE_CHANNEL_LABEL, VARIANCE_REASON_LABEL, type VarianceReason } from "@/lib/pr/enums";
import { formatDate, humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "Your PR programme" };

function fmtReach(n: number | null): string {
  return n == null ? "" : n.toLocaleString("en-GB");
}

// The client hub overview: what we agreed (the published plan), what's
// waiting on the client, what we're working on, and what we've secured.
// Every read is scoped and published-only by construction.
export default async function PortalHubPage() {
  const actor = await requirePortalMember();
  const [programs, plan, outcomes, meetings, boards] = await Promise.all([
    listPortalProgramSummaries(actor),
    getPlanTabForActor(actor),
    listOutcomesForActor(actor),
    getMeetingsForActor(actor),
    listHubBoardsForActor(actor),
  ]);
  const canCreate = contributorCompanyScope(actor).length > 0;
  const program = programs[0] ?? null;

  if (!program) {
    return (
      <div className="admin-content">
        <PageHead eyebrow="Client hub" title="Your PR programme" />
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title" style={{ marginBottom: 8 }}>No PR programme yet</h2>
          <p className="admin-page-sub" style={{ margin: 0 }}>This is where your plan, activity and coverage will live once the programme starts.</p>
          {canCreate && (
            <div style={{ marginTop: 16 }}>
              <Link href="/portal/programs/add" className="admin-btn admin-btn--primary">Add PR Program</Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const programBoard = boards.find((b) => b.prProgramId === program.id) ?? boards[0] ?? null;
  const board = programBoard ? await getBoardViewForActor(actor, programBoard.id) : null;
  const columnName = new Map((board?.columns ?? []).map((c) => [c.id, c.name]));
  const openCards = (board?.cards ?? []).filter((c) => !c.done);
  const waitingCards = openCards.filter((c) => /waiting/i.test(columnName.get(c.columnId ?? "") ?? ""));

  const coverage = outcomes.filter((o) => o.kind === "coverage");
  const posts = outcomes.filter((o) => o.kind === "linkedin");
  const inQuarter = (d: string | null) => !!plan?.selected && !!d && d >= plan.selected.starts_on && d <= plan.selected.ends_on;
  const coverageThisQuarter = plan?.selected ? coverage.filter((o) => inQuarter(o.publishDate)).length : coverage.length;
  const postsThisQuarter = plan?.selected ? posts.filter((o) => inQuarter(o.publishDate)).length : posts.length;
  const postTarget = plan?.targets.find((t) => t.group_key === "linkedin-authority")?.quantity_target ?? null;
  const targets = plan?.targets ?? [];
  const onTrack = targets.filter(targetOnTrack).length;
  const reach = coverage.reduce((s, o) => s + (o.reach ?? 0), 0);
  const publishedMeetings = meetings.filter((m) => m.publishedAt).slice(0, 3);

  return (
    <div className="admin-content">
      <PageHead
        eyebrow="Client hub"
        title={program.name}
        sub={plan?.selected ? `${plan.selected.quarter_label} · ${formatDate(plan.selected.starts_on)} – ${formatDate(plan.selected.ends_on)}` : "Your PR programme"}
        action={<Badge tone={statusTone(program.status)}>{humanize(program.status)}</Badge>}
      />

      <div className="mp-kpi-grid" style={{ marginBottom: 16 }}>
        <MetricCard label={plan?.selected ? "Coverage this quarter" : "Coverage"} value={coverageThisQuarter} sub={reach > 0 ? `est. reach ${fmtReach(reach)}` : `${coverage.length} total`} href="/portal/coverage" />
        <MetricCard label="LinkedIn posts" value={postTarget ? <>{postsThisQuarter} <span className="admin-cell-muted" style={{ fontSize: 15, fontWeight: 500 }}>of {postTarget}</span></> : postsThisQuarter} sub={plan?.selected ? "this quarter" : "published"} href="/portal/coverage?kind=linkedin" />
        <MetricCard
          label="Plan targets"
          value={plan ? <>{onTrack} <span className="admin-cell-muted" style={{ fontSize: 15, fontWeight: 500 }}>of {targets.length} on track</span></> : "—"}
          sub={plan ? (targets.length - onTrack > 0 ? `${targets.length - onTrack} behind — see below` : "all on plan") : "plan not published yet"}
          href={plan ? "/portal/plan" : undefined}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {waitingCards.length > 0 && (
            <section className="admin-card admin-section-card admin-card--attention">
              <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Waiting on you</h2>
              <div className="admin-list">
                {waitingCards.map((c) => (
                  <div className="admin-list-row" key={c.id}>
                    <div className="admin-list-main">
                      <div className="admin-list-title">{c.title}</div>
                      {c.dueDate && <div className="admin-list-sub">Needed by {formatDate(c.dueDate)}</div>}
                    </div>
                    <div className="admin-list-aside">
                      <Link className="admin-btn admin-btn--sm" href={`/portal/programs/${program.id}?tab=board`}>Open</Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="admin-card admin-section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h2 className="admin-card-title" style={{ margin: 0 }}>{plan?.selected ? `${plan.selected.quarter_label} plan` : "90-Day Plan"}</h2>
              {plan && <Link href="/portal/plan" className="admin-cell-muted" style={{ fontSize: 12 }}>Full plan →</Link>}
            </div>
            {!plan?.selected ? (
              <div className="admin-empty">Your 90-day plan will appear here once it is published.</div>
            ) : (
              <>
                {(plan.selected.business_objective || plan.selected.comms_objective) && (
                  <p className="admin-page-sub" style={{ margin: "0 0 12px" }}>
                    <b style={{ color: "var(--admin-ink)" }}>Objective:</b> {plan.selected.comms_objective ?? plan.selected.business_objective}
                    {plan.selected.signoff_date && ` Signed off ${formatDate(plan.selected.signoff_date)}.`}
                  </p>
                )}
                <div className="admin-table-wrap" style={{ boxShadow: "none" }}>
                  <table className="admin-table">
                    <thead><tr><th>Target</th><th style={{ width: 150 }}>Progress</th><th>Where it stands</th></tr></thead>
                    <tbody>
                      {targets.map((t) => {
                        const q = t.quantity_target ?? 0;
                        const done = t.progress.outcome_count;
                        const pct = q > 0 ? Math.min(100, Math.round((done / q) * 100)) : targetDone(t) ? 100 : 0;
                        return (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 600 }}>{t.title}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div className="board-progress" style={{ flex: 1 }}><div className="board-progress-fill" style={{ width: `${pct}%` }} /></div>
                                <span className="admin-cell-muted" style={{ fontVariantNumeric: "tabular-nums" }}>{q > 0 ? `${done} / ${q}` : done || ""}</span>
                              </div>
                            </td>
                            <td>
                              {t.variance_reason || t.variance_note ? (
                                <span>
                                  {t.variance_reason && <strong style={{ color: "var(--admin-warn-ink)" }}>{VARIANCE_REASON_LABEL[t.variance_reason as VarianceReason] ?? humanize(t.variance_reason)}. </strong>}
                                  {t.variance_note}
                                </span>
                              ) : targetDone(t) ? (
                                <span style={{ color: "var(--admin-ok-ink)", fontWeight: 600 }}>Done</span>
                              ) : (
                                <span className="admin-cell-muted">On track</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {targets.length === 0 && <tr><td colSpan={3} className="admin-empty">No targets published yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="admin-card admin-section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 className="admin-card-title" style={{ margin: 0 }}>Latest coverage</h2>
              {coverage.length > 0 && <Link href="/portal/coverage" className="admin-cell-muted" style={{ fontSize: 12 }}>All {coverage.length} →</Link>}
            </div>
            {coverage.length === 0 ? (
              <div className="admin-empty">Nothing published yet.</div>
            ) : (
              <div className="admin-list">
                {coverage.slice(0, 3).map((o) => (
                  <div className="admin-list-row" key={o.id}>
                    <div className="admin-list-main">
                      <div className="admin-list-title">{o.outlet ?? COVERAGE_CHANNEL_LABEL[o.channel as keyof typeof COVERAGE_CHANNEL_LABEL] ?? o.channel}</div>
                      <div className="admin-list-sub">{o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer">{o.title}</a> : o.title}</div>
                      <div className="admin-list-sub">{[COVERAGE_CHANNEL_LABEL[o.channel as keyof typeof COVERAGE_CHANNEL_LABEL] ?? o.channel, o.reach ? `reach ${fmtReach(o.reach)}` : null].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="admin-list-aside"><span className="admin-cell-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(o.publishDate)}</span></div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-card admin-section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 className="admin-card-title" style={{ margin: 0 }}>What we&apos;re working on</h2>
              {board && <Link href={`/portal/programs/${program.id}?tab=board`} className="admin-cell-muted" style={{ fontSize: 12 }}>Activity →</Link>}
            </div>
            {openCards.length === 0 ? (
              <div className="admin-empty">Nothing in motion right now.</div>
            ) : (
              <div className="admin-list">
                {openCards.slice(0, 4).map((c) => (
                  <div className="admin-list-row" key={c.id}>
                    <div className="admin-list-main">
                      <div className="admin-list-title">{c.title}</div>
                      <div className="admin-list-sub">{columnName.get(c.columnId ?? "") ?? ""}{c.dueDate ? ` · ${formatDate(c.dueDate)}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-card admin-section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 className="admin-card-title" style={{ margin: 0 }}>Meetings</h2>
              {publishedMeetings.length > 0 && <Link href={`/portal/programs/${program.id}?tab=meetings`} className="admin-cell-muted" style={{ fontSize: 12 }}>All →</Link>}
            </div>
            {publishedMeetings.length === 0 ? (
              <div className="admin-empty">No meeting notes published yet.</div>
            ) : (
              <div className="admin-list">
                {publishedMeetings.map((m) => (
                  <Link key={m.id} href={`/portal/meetings/${m.id}`} className="admin-list-row" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="admin-list-main">
                      <div className="admin-list-title">{m.title ?? "Meeting"}</div>
                      <div className="admin-list-sub">{m.summary ? "Summary" : "Notes"}</div>
                    </div>
                    <div className="admin-list-aside"><span className="admin-cell-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(m.meetingDate)}</span></div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
