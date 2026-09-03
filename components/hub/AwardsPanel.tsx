"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { EditableDate, EditableLink, EditableSelect, EditableText, EditableTextarea } from "@/components/admin/InlineEdit";
import type { AwardRow } from "@/lib/hub/supporting";
import type { AwardPatch, SupportingActions } from "@/lib/hub/supporting-actions";
import { AWARD_STAGES, AWARD_STAGE_LABEL, type AwardStage } from "@/lib/pr/enums";
import { formatCents, formatDate } from "@/lib/admin/format";

// Awards for one program, proposed through outcome. `actions` = editable
// (admin/team); omitted = the client's read-only render. Cost is internal and
// renders only when `showCost` (admin).

const STAGE_TONE: Record<AwardStage, BadgeTone> = {
  proposed: "neutral",
  agreed: "info",
  submitted: "info",
  shortlisted: "warn",
  won: "ok",
  lost: "neutral",
  withdrawn: "neutral",
};

export function AwardsPanel({
  programId,
  rows,
  documents = [],
  plans = [],
  showCost = false,
  actions,
}: {
  programId: string;
  rows: AwardRow[];
  documents?: Array<{ id: string; filename: string }>;
  plans?: Array<{ id: string; label: string }>;
  showCost?: boolean;
  actions?: Pick<SupportingActions, "createAward" | "updateAward" | "publishAward" | "archiveAward">;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ awardName: "", category: "", website: "", entryClose: "", eventDate: "" });

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
  const save = (id: string, field: keyof AwardPatch) => async (value: string) => {
    if (!actions) return { ok: false as const, error: "Read-only." };
    const patch: AwardPatch = field === "costCents" ? { costCents: value.trim() === "" ? null : Math.round(Number(value.replace(/[^0-9.]/g, "")) * 100) } : ({ [field]: value } as AwardPatch);
    const r = await actions.updateAward(id, patch);
    if (r.ok) router.refresh();
    return r;
  };
  const stageOptions = AWARD_STAGES.map((s) => ({ value: s, label: AWARD_STAGE_LABEL[s] }));

  return (
    <div className="admin-panel">
      {error && <div className="admin-editable-note admin-editable-note--err">{error}</div>}
      <div className="admin-table-wrap admin-table-wrap--flat">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Award</th>
              <th className="admin-th--sm">Stage</th>
              <th className="admin-th--sm">Entry closes</th>
              <th className="admin-th--sm">Event</th>
              {actions && <th className="admin-th--md">Entry doc</th>}
              {actions && showCost && <th className="admin-th--sm">Cost</th>}
              <th>Outcome</th>
              {actions && <th className="admin-th--md">Client hub</th>}
              {actions && <th className="admin-th--xs"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="admin-empty">No awards yet.</td></tr>
            )}
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="u-strong">{actions ? <EditableText value={a.awardName} onSave={save(a.id, "awardName")} ariaLabel="Award name" /> : a.awardName}</div>
                  <div className="admin-cell-muted u-sm">
                    {actions ? <EditableText value={a.category ?? ""} onSave={save(a.id, "category")} placeholder="category…" ariaLabel="Category" /> : a.category}
                    {actions ? <> · <EditableLink value={a.website ?? ""} onSave={save(a.id, "website")} placeholder="website…" ariaLabel="Website" /></> : a.website ? <> · <a href={a.website} target="_blank" rel="noopener noreferrer">site ↗</a></> : null}
                  </div>
                </td>
                <td>
                  {actions ? (
                    <EditableSelect value={a.stage} options={stageOptions} onSave={save(a.id, "stage")} ariaLabel="Stage" render={(v) => <Badge tone={STAGE_TONE[v as AwardStage] ?? "neutral"}>{AWARD_STAGE_LABEL[v as AwardStage] ?? v}</Badge>} />
                  ) : (
                    <Badge tone={STAGE_TONE[a.stage as AwardStage] ?? "neutral"}>{AWARD_STAGE_LABEL[a.stage as AwardStage] ?? a.stage}</Badge>
                  )}
                </td>
                <td className="u-nowrap">{actions ? <EditableDate value={a.entryClose ?? ""} onSave={save(a.id, "entryClose")} ariaLabel="Entry close" /> : formatDate(a.entryClose)}</td>
                <td className="u-nowrap">{actions ? <EditableDate value={a.eventDate ?? ""} onSave={save(a.id, "eventDate")} ariaLabel="Event date" /> : formatDate(a.eventDate)}</td>
                {actions && (
                  <td>
                    <EditableSelect value={a.submissionDocumentId ?? ""} options={documents.map((d) => ({ value: d.id, label: d.filename }))} onSave={save(a.id, "submissionDocumentId")} placeholder="—" ariaLabel="Submission document" render={(v) => documents.find((d) => d.id === v)?.filename ?? "—"} />
                  </td>
                )}
                {actions && showCost && (
                  <td><EditableText value={a.costCents != null ? String(a.costCents / 100) : ""} onSave={save(a.id, "costCents")} placeholder="—" ariaLabel="Cost" render={(v) => (v ? formatCents(Math.round(Number(v) * 100), "aud") : "—")} /></td>
                )}
                <td>{actions ? <EditableTextarea value={a.outcomeNote ?? ""} onSave={save(a.id, "outcomeNote")} placeholder="outcome…" ariaLabel="Outcome" rows={2} /> : a.outcomeNote ?? <span className="admin-cell-muted">—</span>}</td>
                {actions && (
                  <td>
                    <span className="u-row">
                      <Badge tone={a.publishedAt ? "ok" : "neutral"}>{a.publishedAt ? "Published" : "Draft"}</Badge>
                      <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={() => run(() => actions.publishAward(a.id, !a.publishedAt))}>{a.publishedAt ? "Unpublish" : "Publish"}</button>
                    </span>
                  </td>
                )}
                {actions && <td><button type="button" className="admin-btn admin-btn--sm" title="Archive" disabled={pending} onClick={() => run(() => actions.archiveAward(a.id))}>×</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actions && (
        <section className="admin-card admin-section-card">
          <h3 className="admin-card-title u-mb-3">Propose an award</h3>
          <div className="admin-form-row">
            <label className="admin-field"><span className="admin-cell-muted">Award</span><input className="admin-input" value={draft.awardName} onChange={(e) => setDraft({ ...draft, awardName: e.target.value })} /></label>
            <label className="admin-field"><span className="admin-cell-muted">Category</span><input className="admin-input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></label>
            <label className="admin-field"><span className="admin-cell-muted">Website</span><input className="admin-input" placeholder="https://…" value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} /></label>
            <label className="admin-field"><span className="admin-cell-muted">Entry closes</span><input className="admin-input" type="date" value={draft.entryClose} onChange={(e) => setDraft({ ...draft, entryClose: e.target.value })} /></label>
            <label className="admin-field"><span className="admin-cell-muted">Event</span><input className="admin-input" type="date" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} /></label>
            <button type="button" className="admin-btn admin-btn--primary" disabled={pending || !draft.awardName.trim()} onClick={() => run(() => actions.createAward(programId, { ...draft, quarterlyPlanId: plans[0]?.id ?? null }), () => setDraft({ awardName: "", category: "", website: "", entryClose: "", eventDate: "" }))}>Add</button>
          </div>
        </section>
      )}
    </div>
  );
}
