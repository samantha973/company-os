"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/admin/Badge";
import { EditableDate, EditableLink, EditableSelect, EditableText, EditableTextarea } from "@/components/admin/InlineEdit";
import type { OutcomeActions, OutcomePatch } from "@/lib/hub/outcome-actions";
import type { OutcomeRow, Option, MediaContactOption } from "@/lib/hub/outcomes";
import { COVERAGE_CHANNELS, COVERAGE_CHANNEL_LABEL } from "@/lib/pr/enums";
import { formatDate } from "@/lib/admin/format";

// Coverage and LinkedIn posts for one program. Pass `actions` for the
// editable admin/team render; omit them for the client's read-only render.
// The journalist column is internal and only renders when `actions` is set
// (the portal reader never carries it anyway).

export type CoverageTargetOption = { id: string; title: string; groupTitle: string };
export type DocumentOption = { id: string; filename: string };

function fmtReach(n: number | null): string {
  return n == null ? "" : n.toLocaleString("en-GB");
}

export function CoveragePanel({
  programId,
  rows,
  kind,
  kindHrefBase,
  targets = [],
  tasks = [],
  journalists = [],
  documents = [],
  actions,
}: {
  programId: string;
  rows: OutcomeRow[];
  kind: "coverage" | "linkedin";
  kindHrefBase: string; // prefix ending in "kind=" (client components cannot take callbacks from server pages)
  targets?: CoverageTargetOption[];
  tasks?: Option[];
  journalists?: MediaContactOption[];
  documents?: DocumentOption[];
  actions?: OutcomeActions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", outlet: "", url: "", channel: "earned", publishDate: "", reach: "", backlogItemId: "", copyMd: "" });

  const visible = rows.filter((r) => r.kind === kind);
  const counts = { coverage: rows.filter((r) => r.kind === "coverage").length, linkedin: rows.filter((r) => r.kind === "linkedin").length };

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

  const save = (id: string, field: keyof OutcomePatch) => async (value: string) => {
    if (!actions) return { ok: false as const, error: "Read-only." };
    const patch: OutcomePatch = field === "reach" ? { reach: value.trim() === "" ? null : Number(value) } : ({ [field]: value } as OutcomePatch);
    const r = await actions.update(id, patch);
    if (r.ok) router.refresh();
    return r;
  };

  const targetOptions = targets.map((t) => ({ value: t.id, label: `${t.groupTitle} · ${t.title}` }));
  const targetLabel = (id: string) => targets.find((t) => t.id === id)?.title ?? "—";
  const taskOptions = tasks.map((t) => ({ value: t.id, label: t.title }));
  const journalistOptions = journalists.map((j) => ({ value: j.id, label: j.outlet ? `${j.name} · ${j.outlet}` : j.name }));
  const docOptions = documents.map((d) => ({ value: d.id, label: d.filename }));
  const channelOptions = COVERAGE_CHANNELS.map((c) => ({ value: c, label: COVERAGE_CHANNEL_LABEL[c] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["coverage", "linkedin"] as const).map((k) => (
            <Link key={k} href={`${kindHrefBase}${k}`} className="admin-chip" style={kind === k ? { borderColor: "var(--admin-accent)", color: "var(--admin-accent)", fontWeight: 600 } : undefined}>
              {k === "coverage" ? "Coverage" : "LinkedIn posts"} · {counts[k]}
            </Link>
          ))}
        </div>
        {actions && (
          <span className="admin-cell-muted" style={{ fontSize: 12 }}>
            Only published rows appear in the client hub and count toward targets.
          </span>
        )}
      </div>
      {error && <div className="admin-editable-note admin-editable-note--err">{error}</div>}

      <div className="admin-table-wrap" style={{ boxShadow: "none" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Date</th>
              {kind === "coverage" ? <th style={{ width: 170 }}>Outlet</th> : null}
              <th>{kind === "coverage" ? "Headline" : "Post"}</th>
              {kind === "coverage" && <th style={{ width: 110 }}>Format</th>}
              <th style={{ width: 100, textAlign: "right" }}>Reach</th>
              <th style={{ width: 200 }}>Counts toward</th>
              {actions && kind === "coverage" && <th style={{ width: 170 }}>Journalist</th>}
              {actions && <th style={{ width: 170 }}>Earned by</th>}
              {actions && kind === "coverage" && <th style={{ width: 150 }}>Clip</th>}
              {actions && <th style={{ width: 150 }}>Client hub</th>}
              {actions && <th style={{ width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={12} className="admin-empty">No {kind === "coverage" ? "coverage" : "LinkedIn posts"} recorded yet.</td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {actions ? <EditableDate value={r.publishDate ?? ""} onSave={save(r.id, "publishDate")} ariaLabel="Publish date" /> : formatDate(r.publishDate)}
                </td>
                {kind === "coverage" && (
                  <td>{actions ? <EditableText value={r.outlet ?? ""} onSave={save(r.id, "outlet")} placeholder="Outlet…" ariaLabel="Outlet" /> : r.outlet}</td>
                )}
                <td>
                  {actions ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {kind === "coverage" ? (
                        <EditableText value={r.title} onSave={save(r.id, "title")} ariaLabel="Headline" />
                      ) : (
                        <EditableTextarea value={r.copyMd ?? r.title} onSave={save(r.id, "copyMd")} ariaLabel="Post copy" rows={3} collapsedHeight={48} />
                      )}
                      <EditableLink value={r.url ?? ""} onSave={save(r.id, "url")} placeholder="Add link…" ariaLabel="Link" />
                    </div>
                  ) : r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer">{kind === "coverage" ? r.title : r.copyMd ?? r.title}</a>
                  ) : (
                    kind === "coverage" ? r.title : r.copyMd ?? r.title
                  )}
                </td>
                {kind === "coverage" && (
                  <td>
                    {actions ? (
                      <EditableSelect value={r.channel} options={channelOptions} onSave={save(r.id, "channel")} ariaLabel="Format" render={(v) => COVERAGE_CHANNEL_LABEL[v as keyof typeof COVERAGE_CHANNEL_LABEL] ?? v} />
                    ) : (
                      COVERAGE_CHANNEL_LABEL[r.channel as keyof typeof COVERAGE_CHANNEL_LABEL] ?? r.channel
                    )}
                  </td>
                )}
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {actions ? <EditableText value={r.reach != null ? String(r.reach) : ""} onSave={save(r.id, "reach")} placeholder="—" ariaLabel="Reach" type="number" render={(v) => fmtReach(v ? Number(v) : null)} /> : fmtReach(r.reach)}
                </td>
                <td>
                  {actions ? (
                    <EditableSelect value={r.backlogItemId ?? ""} options={targetOptions} onSave={save(r.id, "backlogItemId")} placeholder="Link a target…" ariaLabel="Plan target" render={targetLabel} />
                  ) : (
                    r.targetTitle ?? <span className="admin-cell-muted">—</span>
                  )}
                </td>
                {actions && kind === "coverage" && (
                  <td>
                    <EditableSelect value={r.journalistId ?? ""} options={journalistOptions} onSave={save(r.id, "journalistPersonId")} placeholder="—" ariaLabel="Journalist" render={(v) => journalists.find((j) => j.id === v)?.name ?? "—"} />
                  </td>
                )}
                {actions && (
                  <td>
                    <EditableSelect value={r.taskId ?? ""} options={taskOptions} onSave={save(r.id, "taskId")} placeholder="—" ariaLabel="Board card" render={(v) => tasks.find((t) => t.id === v)?.title ?? "—"} />
                  </td>
                )}
                {actions && kind === "coverage" && (
                  <td>
                    <EditableSelect value={r.mediaAssetDocumentId ?? ""} options={docOptions} onSave={save(r.id, "mediaAssetDocumentId")} placeholder="—" ariaLabel="Media clip" render={(v) => documents.find((d) => d.id === v)?.filename ?? "—"} />
                  </td>
                )}
                {actions && (
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Badge tone={r.publishedAt ? "ok" : "neutral"}>{r.publishedAt ? "Published" : "Draft"}</Badge>
                      <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={() => run(() => actions.publish(r.id, !r.publishedAt))}>
                        {r.publishedAt ? "Unpublish" : "Publish"}
                      </button>
                    </span>
                  </td>
                )}
                {actions && (
                  <td>
                    <button type="button" className="admin-btn admin-btn--sm" title="Remove" disabled={pending} onClick={() => run(() => actions.remove(r.id))}>×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actions && (
        <section className="admin-card admin-section-card">
          <h3 className="admin-card-title" style={{ marginBottom: 10 }}>{kind === "coverage" ? "Record coverage" : "Record a LinkedIn post"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: kind === "coverage" ? "1fr 2fr 1fr" : "3fr 1fr", gap: 10 }}>
            {kind === "coverage" && (
              <label className="admin-field"><span className="admin-cell-muted">Outlet</span><input className="admin-input" value={draft.outlet} onChange={(e) => setDraft({ ...draft, outlet: e.target.value })} /></label>
            )}
            <label className="admin-field">
              <span className="admin-cell-muted">{kind === "coverage" ? "Headline" : "Post copy"}</span>
              {kind === "coverage" ? (
                <input className="admin-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              ) : (
                <textarea className="admin-textarea" rows={3} value={draft.copyMd} onChange={(e) => setDraft({ ...draft, copyMd: e.target.value })} />
              )}
            </label>
            <label className="admin-field"><span className="admin-cell-muted">Link</span><input className="admin-input" placeholder="https://…" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} /></label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: kind === "coverage" ? "1fr 1fr 1fr 2fr auto" : "1fr 1fr 2fr auto", gap: 10, alignItems: "end", marginTop: 10 }}>
            <label className="admin-field"><span className="admin-cell-muted">Date</span><input className="admin-input" type="date" value={draft.publishDate} onChange={(e) => setDraft({ ...draft, publishDate: e.target.value })} /></label>
            {kind === "coverage" && (
              <label className="admin-field">
                <span className="admin-cell-muted">Format</span>
                <select className="admin-select" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })}>
                  {channelOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
            )}
            <label className="admin-field"><span className="admin-cell-muted">Reach</span><input className="admin-input" type="number" min={0} value={draft.reach} onChange={(e) => setDraft({ ...draft, reach: e.target.value })} /></label>
            <label className="admin-field">
              <span className="admin-cell-muted">Counts toward</span>
              <select className="admin-select" value={draft.backlogItemId} onChange={(e) => setDraft({ ...draft, backlogItemId: e.target.value })}>
                <option value="">— no target —</option>
                {targetOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={pending || (kind === "coverage" ? !draft.title.trim() : !draft.copyMd.trim())}
              onClick={() =>
                run(
                  () =>
                    actions.create(programId, {
                      kind,
                      title: kind === "coverage" ? draft.title : draft.copyMd.trim().slice(0, 120),
                      copyMd: kind === "linkedin" ? draft.copyMd : null,
                      outlet: kind === "coverage" ? draft.outlet : null,
                      url: draft.url || null,
                      channel: draft.channel,
                      publishDate: draft.publishDate || null,
                      reach: draft.reach === "" ? null : Number(draft.reach),
                      backlogItemId: draft.backlogItemId || null,
                      published: true,
                    }),
                  () => setDraft({ ...draft, title: "", outlet: "", url: "", reach: "", copyMd: "" }),
                )
              }
            >
              Add &amp; publish
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
