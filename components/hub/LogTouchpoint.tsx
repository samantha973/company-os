"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TouchpointInput } from "@/lib/hub/supporting-actions";
import type { TouchpointRow } from "@/lib/hub/supporting";
import { TOUCHPOINT_KINDS, TOUCHPOINT_KIND_LABEL, type TouchpointKind } from "@/lib/pr/enums";
import { formatDate } from "@/lib/admin/format";

// "Log catch-up" on the program band: a client-relationship touchpoint
// (lunch, call, gift…) written to interactions. Internal-only; drives the
// band's last-formal-catch-up. Recent entries listed underneath.

export function LogTouchpoint({
  programId,
  recent,
  action,
}: {
  programId: string;
  recent: TouchpointRow[];
  action: (programId: string, input: TouchpointInput) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ kind: "catchup", occurredOn: new Date().toISOString().slice(0, 10), subject: "", body: "" });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="admin-btn admin-btn--sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Log catch-up"}
        </button>
        {recent.length > 0 && (
          <span className="admin-cell-muted" style={{ fontSize: 12 }}>
            Recent: {recent.slice(0, 3).map((t) => `${TOUCHPOINT_KIND_LABEL[t.kind as TouchpointKind] ?? t.kind} ${formatDate(t.occurredAt)}`).join(" · ")}
          </span>
        )}
      </div>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "140px 150px 1fr auto", gap: 10, alignItems: "end", marginTop: 10 }}>
          <label className="admin-field">
            <span className="admin-cell-muted">Kind</span>
            <select className="admin-select" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              {TOUCHPOINT_KINDS.map((k) => <option key={k} value={k}>{TOUCHPOINT_KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="admin-field"><span className="admin-cell-muted">When</span><input className="admin-input" type="date" value={draft.occurredOn} onChange={(e) => setDraft({ ...draft, occurredOn: e.target.value })} /></label>
          <label className="admin-field"><span className="admin-cell-muted">Note</span><input className="admin-input" placeholder="who, what came up…" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await action(programId, { kind: draft.kind, occurredOn: draft.occurredOn, body: draft.body, subject: draft.subject || null });
                if (!r.ok) setError(r.error);
                else {
                  setOpen(false);
                  setDraft({ ...draft, body: "" });
                  router.refresh();
                }
              })
            }
          >
            Save
          </button>
          {error && <div className="admin-editable-note admin-editable-note--err" style={{ gridColumn: "1 / -1" }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
