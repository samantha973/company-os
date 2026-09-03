"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { EditableSelect, EditableText, EditableTextarea } from "@/components/admin/InlineEdit";
import type { PipelineRow } from "@/lib/hub/supporting";
import type { PipelinePatch, SupportingActions } from "@/lib/hub/supporting-actions";
import { PIPELINE_STATUSES, PIPELINE_STATUS_LABEL, type PipelineStatus } from "@/lib/pr/enums";
import { formatDate } from "@/lib/admin/format";

// News ideas logged against a program before they become plan targets.
// Promote = create the target under a workstream in a plan. Internal-first:
// the client sees only published rows (rarely needed — promoted ideas show
// up as plan targets).

const STATUS_TONE: Record<PipelineStatus, BadgeTone> = { logged: "neutral", candidate: "info", promoted: "ok", parked: "neutral" };

export function PipelinePanel({
  programId,
  rows,
  plans,
  groups,
  actions,
}: {
  programId: string;
  rows: PipelineRow[];
  plans: Array<{ id: string; label: string }>;
  groups: Array<{ key: string; title: string }>;
  actions?: Pick<SupportingActions, "createPipeline" | "updatePipeline" | "publishPipeline" | "archivePipeline" | "promotePipeline">;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ headline: "", description: "" });
  const [promote, setPromote] = useState<{ id: string; planId: string; groupKey: string; qty: string } | null>(null);

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
  const save = (id: string, field: keyof PipelinePatch) => async (value: string) => {
    if (!actions) return { ok: false as const, error: "Read-only." };
    const r = await actions.updatePipeline(id, { [field]: value } as PipelinePatch);
    if (r.ok) router.refresh();
    return r;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div className="admin-editable-note admin-editable-note--err">{error}</div>}
      <div className="admin-table-wrap" style={{ boxShadow: "none" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Idea</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 160 }}>Aimed at</th>
              <th style={{ width: 110 }}>Reviewed</th>
              {actions && <th style={{ width: 220 }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="admin-empty">No ideas logged yet.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{actions ? <EditableText value={p.headline} onSave={save(p.id, "headline")} ariaLabel="Headline" /> : p.headline}</div>
                  <div className="admin-cell-muted" style={{ fontSize: 12 }}>{actions ? <EditableTextarea value={p.description ?? ""} onSave={save(p.id, "description")} placeholder="what the story is…" ariaLabel="Description" rows={2} /> : p.description}</div>
                </td>
                <td>
                  {actions ? (
                    <EditableSelect value={p.status} options={PIPELINE_STATUSES.map((s) => ({ value: s, label: PIPELINE_STATUS_LABEL[s] }))} onSave={save(p.id, "status")} ariaLabel="Status" render={(v) => <Badge tone={STATUS_TONE[v as PipelineStatus] ?? "neutral"}>{PIPELINE_STATUS_LABEL[v as PipelineStatus] ?? v}</Badge>} />
                  ) : (
                    <Badge tone={STATUS_TONE[p.status as PipelineStatus] ?? "neutral"}>{PIPELINE_STATUS_LABEL[p.status as PipelineStatus] ?? p.status}</Badge>
                  )}
                </td>
                <td>
                  {p.promotedTargetTitle ? (
                    <span className="admin-cell-muted">Target: {p.promotedTargetTitle}</span>
                  ) : actions ? (
                    <EditableSelect value={p.targetQuarterPlanId ?? ""} options={plans.map((x) => ({ value: x.id, label: x.label }))} onSave={save(p.id, "targetQuarterPlanId")} placeholder="pick a quarter…" ariaLabel="Target quarter" render={(v) => plans.find((x) => x.id === v)?.label ?? "—"} />
                  ) : (
                    p.targetQuarterLabel ?? "—"
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{formatDate(p.lastReviewedOn)}</td>
                {actions && (
                  <td>
                    {promote?.id === p.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <select className="admin-select" value={promote.planId} onChange={(e) => setPromote({ ...promote, planId: e.target.value })}>
                          {plans.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                        <select className="admin-select" value={promote.groupKey} onChange={(e) => setPromote({ ...promote, groupKey: e.target.value })}>
                          {groups.map((g) => <option key={g.key} value={g.key}>{g.title}</option>)}
                        </select>
                        <input className="admin-input" style={{ width: 70 }} type="number" min={0} placeholder="count" value={promote.qty} onChange={(e) => setPromote({ ...promote, qty: e.target.value })} />
                        <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" disabled={pending || !promote.planId || !promote.groupKey} onClick={() => run(() => actions.promotePipeline(p.id, { planId: promote.planId, groupKey: promote.groupKey, quantityTarget: promote.qty === "" ? null : Number(promote.qty) }), () => setPromote(null))}>Promote</button>
                        <button type="button" className="admin-btn admin-btn--sm" onClick={() => setPromote(null)}>Cancel</button>
                      </div>
                    ) : (
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        {!p.promotedBacklogItemId && plans.length > 0 && groups.length > 0 && (
                          <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={() => setPromote({ id: p.id, planId: p.targetQuarterPlanId ?? plans[0].id, groupKey: groups[0].key, qty: "" })}>Promote to plan</button>
                        )}
                        <button type="button" className="admin-btn admin-btn--sm" title="Archive" disabled={pending} onClick={() => run(() => actions.archivePipeline(p.id))}>×</button>
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actions && (
        <section className="admin-card admin-section-card">
          <h3 className="admin-card-title" style={{ marginBottom: 10 }}>Log a news idea</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 10, alignItems: "end" }}>
            <label className="admin-field"><span className="admin-cell-muted">Headline</span><input className="admin-input" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} /></label>
            <label className="admin-field"><span className="admin-cell-muted">What the story is</span><input className="admin-input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <button type="button" className="admin-btn admin-btn--primary" disabled={pending || !draft.headline.trim()} onClick={() => run(() => actions.createPipeline(programId, draft), () => setDraft({ headline: "", description: "" }))}>Log</button>
          </div>
        </section>
      )}
    </div>
  );
}
