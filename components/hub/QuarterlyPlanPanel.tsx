"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { EditableDate, EditableSelect, EditableText, EditableTextarea } from "@/components/admin/InlineEdit";
import type { PlanActions } from "@/lib/hub/plan-actions";
import type { PlanTarget, QuarterlyPlan } from "@/lib/hub/plan";
import { targetDone, targetOnTrack } from "@/lib/hub/plan";
import type { RoadmapGroup } from "@/lib/client-backlog";
import { BACKLOG_STATUSES } from "@/lib/client-backlog";
import { VARIANCE_REASONS, VARIANCE_REASON_LABEL, type VarianceReason } from "@/lib/pr/enums";
import type { QuarterSpec } from "@/lib/pr/quarters";
import { formatDate, humanize } from "@/lib/admin/format";

// The 90-Day Plan: one quarter's objectives and its targets by workstream,
// with progress from linked outcomes and a variance reason + note on
// anything that slipped. Pass `actions` for the editable (admin/team) render;
// omit them for the client's read-only render. The panel never carries
// anything the client may not see — the loader decides which plans arrive.

export type MeetingOption = { id: string; title: string | null; date: string | null };

const STATUS_TONE: Record<string, BadgeTone> = {
  proposed: "neutral",
  accepted: "info",
  active: "info",
  shipped: "ok",
  parked: "neutral",
};

function statusLabel(t: PlanTarget): { label: string; tone: BadgeTone } {
  if (targetDone(t)) return { label: "Done", tone: "ok" };
  if (t.variance_reason) return { label: "At risk", tone: "warn" };
  if (t.status === "parked") return { label: "Parked", tone: "neutral" };
  if (t.progress.outcome_count > 0 || t.progress.task_count > 0) return { label: "In progress", tone: "info" };
  return { label: humanize(t.status), tone: STATUS_TONE[t.status] ?? "neutral" };
}

function Progress({ t }: { t: PlanTarget }) {
  const target = t.quantity_target ?? 0;
  const done = t.progress.outcome_count;
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : targetDone(t) ? 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="board-progress" style={{ flex: 1 }}>
        <div className="board-progress-fill" style={{ width: `${pct}%`, background: targetDone(t) ? "var(--admin-ok-ink)" : undefined }} />
      </div>
      <span className="admin-cell-muted" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", minWidth: 40 }}>
        {target > 0 ? `${done} / ${target}` : done > 0 ? `${done}` : "—"}
      </span>
    </div>
  );
}

export function QuarterlyPlanPanel({
  programId,
  plans,
  selected,
  targets,
  groups,
  meetings = [],
  meetingHrefBase,
  planHrefBase,
  suggestNext,
  actions,
}: {
  programId: string;
  plans: QuarterlyPlan[];
  selected: QuarterlyPlan | null;
  targets: PlanTarget[];
  groups: RoadmapGroup[];
  meetings?: MeetingOption[];
  // Prefix strings, not functions: this is a client component and server pages
  // cannot hand it callbacks. meetingHrefBase ending in "/" gets the id appended.
  meetingHrefBase?: string;
  planHrefBase: string;
  suggestNext: QuarterSpec;
  actions?: PlanActions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(plans.length === 0);
  const [newPlan, setNewPlan] = useState({ quarter_label: suggestNext.label, starts_on: suggestNext.startsOn, ends_on: suggestNext.endsOn, planning_meeting_id: "" });
  const [newTarget, setNewTarget] = useState({ group_key: groups[0]?.key ?? "", title: "", quantity_target: "" });
  const [newWorkstream, setNewWorkstream] = useState("");

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else {
        after?.();
        router.refresh();
      }
    });

  const savePlan = (field: keyof NonNullable<Parameters<PlanActions["updatePlan"]>[1]>) => async (value: string) => {
    if (!actions || !selected) return { ok: false as const, error: "Read-only." };
    const r = await actions.updatePlan(selected.id, { [field]: value } as Parameters<PlanActions["updatePlan"]>[1]);
    if (r.ok) router.refresh();
    return r;
  };
  const saveTarget = (id: string, field: string) => async (value: string) => {
    if (!actions) return { ok: false as const, error: "Read-only." };
    const patch = field === "quantity_target" ? { quantity_target: value.trim() === "" ? null : Number(value) } : { [field]: value };
    const r = await actions.updateTarget(id, patch as Parameters<PlanActions["updateTarget"]>[1]);
    if (r.ok) router.refresh();
    return r;
  };

  const meetingOf = (id: string | null) => meetings.find((m) => m.id === id) ?? null;
  const meetingLabel = (m: MeetingOption) => `${m.title ?? "Meeting"}${m.date ? ` · ${formatDate(m.date)}` : ""}`;
  const groupTitle = (key: string) => groups.find((g) => g.key === key)?.title ?? humanize(key);

  const orderedGroups = [...groups].sort((a, b) => a.sort_order - b.sort_order);
  const byGroup = orderedGroups.map((g) => ({ g, items: targets.filter((t) => t.group_key === g.key) })).filter((x) => x.items.length > 0);
  const orphans = targets.filter((t) => !groups.some((g) => g.key === t.group_key));

  const onTrack = targets.filter(targetOnTrack).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <div className="admin-editable-note admin-editable-note--err">{error}</div>}

      {/* Plan switcher + new-quarter form */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {plans.map((p) => (
            <Link key={p.id} href={`${planHrefBase}${p.id}`} className={`admin-chip${selected?.id === p.id ? " is-active" : ""}`} style={selected?.id === p.id ? { borderColor: "var(--admin-accent)", color: "var(--admin-accent)", fontWeight: 600 } : undefined}>
              {p.quarter_label}
              {!p.published_at && <span className="admin-cell-muted"> · draft</span>}
            </Link>
          ))}
          {plans.length === 0 && <span className="admin-cell-muted">No 90-day plan yet.</span>}
        </div>
        {actions && (
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancel" : "New quarter"}
          </button>
        )}
      </div>

      {actions && showNew && (
        <section className="admin-card admin-section-card">
          <h3 className="admin-card-title" style={{ marginBottom: 10 }}>Start a quarter</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
            <label className="admin-field"><span className="admin-cell-muted">Quarter</span><input className="admin-input" value={newPlan.quarter_label} onChange={(e) => setNewPlan({ ...newPlan, quarter_label: e.target.value })} /></label>
            <label className="admin-field"><span className="admin-cell-muted">Starts</span><input className="admin-input" type="date" value={newPlan.starts_on} onChange={(e) => setNewPlan({ ...newPlan, starts_on: e.target.value })} /></label>
            <label className="admin-field"><span className="admin-cell-muted">Ends</span><input className="admin-input" type="date" value={newPlan.ends_on} onChange={(e) => setNewPlan({ ...newPlan, ends_on: e.target.value })} /></label>
            <label className="admin-field">
              <span className="admin-cell-muted">Keyed off meeting</span>
              <select className="admin-select" value={newPlan.planning_meeting_id} onChange={(e) => setNewPlan({ ...newPlan, planning_meeting_id: e.target.value })}>
                <option value="">— none yet —</option>
                {meetings.map((m) => <option key={m.id} value={m.id}>{meetingLabel(m)}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={pending}
              onClick={() =>
                run(
                  () => actions.createPlan(programId, { ...newPlan, planning_meeting_id: newPlan.planning_meeting_id || null }),
                  () => setShowNew(false),
                )
              }
            >
              Create plan
            </button>
          </div>
        </section>
      )}

      {selected && (
        <>
          {/* Header */}
          <section className="admin-card admin-section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h3 className="admin-card-title" style={{ margin: 0 }}>
                    {actions ? <EditableText value={selected.quarter_label} onSave={savePlan("quarter_label")} ariaLabel="Quarter label" /> : selected.quarter_label}
                  </h3>
                  <span className="admin-cell-muted">
                    {actions ? (
                      <>
                        <EditableDate value={selected.starts_on} onSave={savePlan("starts_on")} ariaLabel="Quarter start" /> – <EditableDate value={selected.ends_on} onSave={savePlan("ends_on")} ariaLabel="Quarter end" />
                      </>
                    ) : (
                      `${formatDate(selected.starts_on)} – ${formatDate(selected.ends_on)}`
                    )}
                  </span>
                  {selected.published_at ? <Badge tone="ok">Published {formatDate(selected.published_at)}</Badge> : <Badge tone="neutral">Draft</Badge>}
                  <span className="admin-cell-muted">{onTrack} of {targets.length} targets on track</span>
                </div>
                <div className="admin-cell-muted" style={{ marginTop: 6, fontSize: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span>Keyed off</span>
                  {actions ? (
                    <EditableSelect
                      value={selected.planning_meeting_id ?? ""}
                      options={meetings.map((m) => ({ value: m.id, label: meetingLabel(m) }))}
                      onSave={savePlan("planning_meeting_id")}
                      placeholder="pick the planning meeting…"
                      ariaLabel="Planning meeting"
                      render={(v) => { const m = meetingOf(v); return m ? meetingLabel(m) : "—"; }}
                    />
                  ) : (
                    <span>{meetingOf(selected.planning_meeting_id) ? meetingLabel(meetingOf(selected.planning_meeting_id) as MeetingOption) : "—"}</span>
                  )}
                  {selected.planning_meeting_id && meetingHrefBase && <Link href={meetingHrefBase.endsWith("/") ? `${meetingHrefBase}${selected.planning_meeting_id}` : meetingHrefBase}>Open meeting →</Link>}
                  <span>·</span>
                  <span>Signed off</span>
                  {actions ? <EditableDate value={selected.signoff_date ?? ""} onSave={savePlan("signoff_date")} placeholder="not yet" ariaLabel="Sign-off date" /> : <span>{selected.signoff_date ? formatDate(selected.signoff_date) : "not yet"}</span>}
                </div>
              </div>
              {actions && (
                <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={() => run(() => actions.publishPlan(selected.id, !selected.published_at))}>
                  {selected.published_at ? "Unpublish" : "Publish to client"}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginTop: 16 }}>
              <div style={{ border: "1px solid var(--admin-line-soft, #F0F1F3)", borderRadius: 8, padding: "12px 14px", background: "var(--admin-surface-2, #F5F6F8)" }}>
                <div className="mp-kpi-label" style={{ marginBottom: 6 }}>Business objective</div>
                {actions ? (
                  <EditableTextarea value={selected.business_objective ?? ""} onSave={savePlan("business_objective")} placeholder="What does the business need this quarter?" ariaLabel="Business objective" rows={3} />
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{selected.business_objective ?? <span className="admin-cell-muted">—</span>}</div>
                )}
              </div>
              <div style={{ border: "1px solid var(--admin-line-soft, #F0F1F3)", borderRadius: 8, padding: "12px 14px", background: "var(--admin-surface-2, #F5F6F8)" }}>
                <div className="mp-kpi-label" style={{ marginBottom: 6 }}>Comms objective</div>
                {actions ? (
                  <EditableTextarea value={selected.comms_objective ?? ""} onSave={savePlan("comms_objective")} placeholder="What will comms deliver to serve it?" ariaLabel="Comms objective" rows={3} />
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{selected.comms_objective ?? <span className="admin-cell-muted">—</span>}</div>
                )}
              </div>
            </div>
          </section>

          {/* Targets */}
          <section className="admin-card admin-section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 className="admin-card-title" style={{ margin: 0 }}>Targets</h3>
            </div>
            {targets.length === 0 ? (
              <div className="admin-empty">No targets yet{actions ? " — add the first one below." : "."}</div>
            ) : (
              <div className="admin-table-wrap" style={{ boxShadow: "none" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: 170 }}>Workstream</th>
                      <th>Target</th>
                      <th style={{ width: 200 }}>Progress</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th>{actions ? "Variance" : "Where it stands"}</th>
                      {actions && <th style={{ width: 40 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...byGroup, ...(orphans.length ? [{ g: null, items: orphans }] : [])].map(({ g, items }) =>
                      items.map((t) => {
                        const s = statusLabel(t);
                        return (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 600 }}>
                              {actions ? (
                                <EditableSelect value={t.group_key} options={orderedGroups.map((x) => ({ value: x.key, label: x.title }))} onSave={saveTarget(t.id, "group_key")} ariaLabel="Workstream" render={groupTitle} />
                              ) : (
                                g?.title ?? groupTitle(t.group_key)
                              )}
                            </td>
                            <td>
                              {actions ? <EditableText value={t.title} onSave={saveTarget(t.id, "title")} ariaLabel="Target" /> : t.title}
                              {actions && (
                                <div className="admin-cell-muted" style={{ fontSize: 12, marginTop: 2 }}>
                                  Count to <EditableText value={t.quantity_target != null ? String(t.quantity_target) : ""} onSave={saveTarget(t.id, "quantity_target")} placeholder="set a number" ariaLabel="Quantity target" type="number" />
                                </div>
                              )}
                            </td>
                            <td><Progress t={t} /></td>
                            <td>
                              {actions ? (
                                <EditableSelect value={t.status} options={BACKLOG_STATUSES.map((x) => ({ value: x, label: humanize(x) }))} onSave={saveTarget(t.id, "status")} ariaLabel="Status" render={() => <Badge tone={s.tone}>{s.label}</Badge>} />
                              ) : (
                                <Badge tone={s.tone}>{s.label}</Badge>
                              )}
                            </td>
                            <td>
                              {actions ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <EditableSelect
                                    value={t.variance_reason ?? ""}
                                    options={VARIANCE_REASONS.map((r) => ({ value: r, label: VARIANCE_REASON_LABEL[r] }))}
                                    onSave={saveTarget(t.id, "variance_reason")}
                                    placeholder="on plan"
                                    ariaLabel="Variance reason"
                                    render={(v) => <span style={{ fontWeight: 600, color: "var(--admin-warn-ink)" }}>{VARIANCE_REASON_LABEL[v as VarianceReason] ?? v}</span>}
                                  />
                                  <EditableTextarea value={t.variance_note ?? ""} onSave={saveTarget(t.id, "variance_note")} placeholder="what the client should know…" ariaLabel="Variance note" rows={2} />
                                </div>
                              ) : t.variance_reason || t.variance_note ? (
                                <span>
                                  {t.variance_reason && <strong style={{ color: "var(--admin-warn-ink)" }}>{VARIANCE_REASON_LABEL[t.variance_reason as VarianceReason] ?? humanize(t.variance_reason)}. </strong>}
                                  {t.variance_note}
                                </span>
                              ) : (
                                <span className="admin-cell-muted">—</span>
                              )}
                            </td>
                            {actions && (
                              <td>
                                <button type="button" className="admin-btn admin-btn--sm" title="Archive target" disabled={pending} onClick={() => run(() => actions.archiveTarget(t.id))}>×</button>
                              </td>
                            )}
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {actions && (
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 110px auto", gap: 10, alignItems: "end", marginTop: 14 }}>
                <label className="admin-field">
                  <span className="admin-cell-muted">Workstream</span>
                  <select className="admin-select" value={newTarget.group_key} onChange={(e) => setNewTarget({ ...newTarget, group_key: e.target.value })}>
                    {orderedGroups.map((g) => <option key={g.key} value={g.key}>{g.title}</option>)}
                  </select>
                </label>
                <label className="admin-field"><span className="admin-cell-muted">Target</span><input className="admin-input" placeholder="e.g. 3 CEO bylines in trade press" value={newTarget.title} onChange={(e) => setNewTarget({ ...newTarget, title: e.target.value })} /></label>
                <label className="admin-field"><span className="admin-cell-muted">Count</span><input className="admin-input" type="number" min={0} placeholder="3" value={newTarget.quantity_target} onChange={(e) => setNewTarget({ ...newTarget, quantity_target: e.target.value })} /></label>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={pending || !newTarget.title.trim() || !newTarget.group_key}
                  onClick={() =>
                    run(
                      () => actions.createTarget(selected.id, { group_key: newTarget.group_key, title: newTarget.title, quantity_target: newTarget.quantity_target === "" ? null : Number(newTarget.quantity_target) }),
                      () => setNewTarget({ ...newTarget, title: "", quantity_target: "" }),
                    )
                  }
                >
                  Add target
                </button>
              </div>
            )}
            {actions && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }} className="admin-cell-muted">
                <span style={{ fontSize: 12 }}>Need another workstream?</span>
                <input className="admin-input" style={{ maxWidth: 220 }} placeholder="e.g. Podcasts" value={newWorkstream} onChange={(e) => setNewWorkstream(e.target.value)} />
                <button type="button" className="admin-btn admin-btn--sm" disabled={pending || !newWorkstream.trim()} onClick={() => run(() => actions.createWorkstream(programId, newWorkstream), () => setNewWorkstream(""))}>Add</button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
