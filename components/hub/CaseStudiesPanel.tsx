"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { EditableSelect, EditableText, EditableTextarea } from "@/components/admin/InlineEdit";
import type { CaseStudyRow } from "@/lib/hub/supporting";
import type { CaseStudyPatch, SupportingActions } from "@/lib/hub/supporting-actions";
import { CASE_STUDY_STATUSES, CASE_STUDY_STATUS_LABEL, type CaseStudyStatus } from "@/lib/pr/enums";
import { formatDate } from "@/lib/admin/format";

// Customer stories the client can offer to media. The customer contact is a
// people row and is internal (renders only with `actions`); the client sees
// the story, its status and where it has been used.

const STATUS_TONE: Record<CaseStudyStatus, BadgeTone> = { proposed: "neutral", in_progress: "info", approved: "ok", used: "ok" };

export function CaseStudiesPanel({
  programId,
  rows,
  customers = [],
  actions,
}: {
  programId: string;
  rows: CaseStudyRow[];
  customers?: Array<{ id: string; name: string }>;
  actions?: Pick<SupportingActions, "createCaseStudy" | "updateCaseStudy" | "publishCaseStudy" | "archiveCaseStudy">;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", description: "" });

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
  const save = (id: string, field: keyof CaseStudyPatch) => async (value: string) => {
    if (!actions) return { ok: false as const, error: "Read-only." };
    const r = await actions.updateCaseStudy(id, { [field]: value } as CaseStudyPatch);
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
              <th>Story</th>
              {actions && <th style={{ width: 180 }}>Customer contact</th>}
              <th style={{ width: 120 }}>Status</th>
              <th>Used in</th>
              {actions && <th style={{ width: 150 }}>Client hub</th>}
              {actions && <th style={{ width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="admin-empty">No case studies yet.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{actions ? <EditableText value={c.title} onSave={save(c.id, "title")} ariaLabel="Title" /> : c.title}</div>
                  <div className="admin-cell-muted" style={{ fontSize: 12 }}>{actions ? <EditableTextarea value={c.description ?? ""} onSave={save(c.id, "description")} placeholder="the story in a paragraph…" ariaLabel="Description" rows={2} collapsedHeight={40} /> : c.description}</div>
                  {c.customerCompanyName && <div className="admin-cell-muted" style={{ fontSize: 12 }}>{c.customerCompanyName}</div>}
                </td>
                {actions && (
                  <td>
                    <EditableSelect value={c.customerPersonId ?? ""} options={customers.map((p) => ({ value: p.id, label: p.name }))} onSave={save(c.id, "customerPersonId")} placeholder="—" ariaLabel="Customer contact" render={(v) => customers.find((p) => p.id === v)?.name ?? c.customerName ?? "—"} />
                  </td>
                )}
                <td>
                  {actions ? (
                    <EditableSelect value={c.status} options={CASE_STUDY_STATUSES.map((s) => ({ value: s, label: CASE_STUDY_STATUS_LABEL[s] }))} onSave={save(c.id, "status")} ariaLabel="Status" render={(v) => <Badge tone={STATUS_TONE[v as CaseStudyStatus] ?? "neutral"}>{CASE_STUDY_STATUS_LABEL[v as CaseStudyStatus] ?? v}</Badge>} />
                  ) : (
                    <Badge tone={STATUS_TONE[c.status as CaseStudyStatus] ?? "neutral"}>{CASE_STUDY_STATUS_LABEL[c.status as CaseStudyStatus] ?? c.status}</Badge>
                  )}
                </td>
                <td>
                  {c.usedIn.length === 0 ? (
                    <span className="admin-cell-muted">Not used yet</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {c.usedIn.map((u) => (
                        <li key={u.id}>{u.outlet ? `${u.outlet} — ` : ""}{u.title}{u.publishDate ? ` (${formatDate(u.publishDate)})` : ""}</li>
                      ))}
                    </ul>
                  )}
                </td>
                {actions && (
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Badge tone={c.publishedAt ? "ok" : "neutral"}>{c.publishedAt ? "Published" : "Draft"}</Badge>
                      <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={() => run(() => actions.publishCaseStudy(c.id, !c.publishedAt))}>{c.publishedAt ? "Unpublish" : "Publish"}</button>
                    </span>
                  </td>
                )}
                {actions && <td><button type="button" className="admin-btn admin-btn--sm" title="Archive" disabled={pending} onClick={() => run(() => actions.archiveCaseStudy(c.id))}>×</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actions && (
        <section className="admin-card admin-section-card">
          <h3 className="admin-card-title" style={{ marginBottom: 10 }}>Propose a story</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 10, alignItems: "end" }}>
            <label className="admin-field"><span className="admin-cell-muted">Title</span><input className="admin-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            <label className="admin-field"><span className="admin-cell-muted">The story</span><input className="admin-input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <button type="button" className="admin-btn admin-btn--primary" disabled={pending || !draft.title.trim()} onClick={() => run(() => actions.createCaseStudy(programId, draft), () => setDraft({ title: "", description: "" }))}>Add</button>
          </div>
        </section>
      )}
    </div>
  );
}
