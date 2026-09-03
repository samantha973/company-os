"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { EditableDate, EditableLink, EditableSelect, EditableText } from "@/components/admin/InlineEdit";
import type { ProgramSummary } from "@/lib/hub/program";
import type { ProgramEngagementPatch } from "@/lib/hub/program-actions";
import type { Result } from "@/lib/admin/mutations";
import type { PersonOption } from "@/lib/admin/people-options";
import type { TouchpointInput } from "@/lib/hub/supporting-actions";
import type { TouchpointRow } from "@/lib/hub/supporting";
import { LogTouchpoint } from "@/components/hub/LogTouchpoint";
import { PROGRAM_HEALTH, PROGRAM_HEALTH_LABEL, PROGRAM_STATUSES, type ProgramHealth, type ProgramStatus } from "@/lib/pr/enums";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";

// One PR Program on the hub band: the engagement record (leads, health,
// contract, drive folders) then the derived tallies. Admin and team surfaces
// pass `actions` so the record edits in place; the fee renders for admin
// only. The portal never renders this card — it has its own client-safe
// shape in lib/portal/program-hub.ts.

export type ProgramCardActions = {
  update: (programId: string, patch: ProgramEngagementPatch) => Promise<Result>;
  setupWorkspace: (programId: string) => Promise<Result & { boardSlug?: string }>;
  logTouchpoint?: (programId: string, input: TouchpointInput) => Promise<Result>;
};

const STATUS_TONE: Record<ProgramStatus, BadgeTone> = { draft: "neutral", active: "ok", paused: "warn", complete: "info" };
const HEALTH_TONE: Record<ProgramHealth, BadgeTone> = { green: "ok", amber: "warn", red: "err" };

function Lock() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-label="internal only" style={{ verticalAlign: "-1px" }}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function Field({ label, internal, children }: { label: string; internal?: boolean; children: React.ReactNode }) {
  return (
    <div className="admin-hub-field">
      <div className="admin-hub-field-label">
        {label}
        {internal && <Lock />}
      </div>
      <div className="admin-hub-field-value">{children}</div>
    </div>
  );
}

export function ProgramCard({
  program,
  audience,
  href,
  people = [],
  touchpoints = [],
  actions,
}: {
  program: ProgramSummary;
  audience: "admin" | "team";
  href: string;
  people?: PersonOption[];
  touchpoints?: TouchpointRow[];
  actions?: ProgramCardActions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [setupError, setSetupError] = useState<string | null>(null);
  const isAdmin = audience === "admin";
  const p = program;

  const save = (field: keyof ProgramEngagementPatch) => async (value: string) => {
    if (!actions) return { ok: false as const, error: "Read-only." };
    const patch: ProgramEngagementPatch =
      field === "engagement_fee_cents"
        ? { engagement_fee_cents: value.trim() === "" ? null : Math.round(Number(value.replace(/[^0-9.]/g, "")) * 100) }
        : ({ [field]: value } as ProgramEngagementPatch);
    const r = await actions.update(p.id, patch);
    if (r.ok) router.refresh();
    return r;
  };

  const peopleOptions = people.map((x) => ({ value: x.id, label: x.name }));
  const personLabel = (id: string) => people.find((x) => x.id === id)?.name ?? "—";
  const plan = p.currentPlan;
  const feeDollars = p.engagementFeeCents != null ? String(p.engagementFeeCents / 100) : "";
  const behind = plan ? plan.targetsTotal - plan.targetsOnTrack : 0;

  return (
    <div className="admin-hub-band admin-hub-inline">
      <section className="admin-card admin-section-card">
        <div className="admin-hub-band-top">
          <div className="admin-hub-band-title">
            <h2>
              <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{p.name}</Link>
            </h2>
            {actions ? (
              <EditableSelect
                value={p.status}
                options={PROGRAM_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
                onSave={save("status")}
                ariaLabel="Program status"
                render={(v) => <Badge tone={STATUS_TONE[v as ProgramStatus] ?? "neutral"}>{humanize(v)}</Badge>}
              />
            ) : (
              <Badge tone={STATUS_TONE[p.status]}>{humanize(p.status)}</Badge>
            )}
            {actions ? (
              <EditableSelect
                value={p.health ?? ""}
                options={PROGRAM_HEALTH.map((h) => ({ value: h, label: PROGRAM_HEALTH_LABEL[h] }))}
                onSave={save("account_health")}
                placeholder="Set health…"
                ariaLabel="Account health"
                render={(v) => <Badge tone={HEALTH_TONE[v as ProgramHealth] ?? "neutral"} dot>{PROGRAM_HEALTH_LABEL[v as ProgramHealth] ?? v}</Badge>}
              />
            ) : (
              p.health && <Badge tone={HEALTH_TONE[p.health]} dot>{PROGRAM_HEALTH_LABEL[p.health]}</Badge>
            )}
            <span className="admin-hub-band-lock"><Lock /> internal</span>
          </div>
          <div className="admin-hub-band-actions">
            {actions && p.boardCount === 0 && (
              <button
                type="button"
                className="admin-btn admin-btn--sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setSetupError(null);
                    const r = await actions.setupWorkspace(p.id);
                    if (!r.ok) setSetupError(r.error);
                    else router.refresh();
                  })
                }
              >
                {pending ? "Setting up…" : "Set up Work Board"}
              </button>
            )}
            <Link href={href}>Open program →</Link>
          </div>
        </div>
        {setupError && <div className="admin-editable-note admin-editable-note--err" style={{ marginBottom: 10 }}>{setupError}</div>}

        <div className={`admin-hub-fields${isAdmin ? "" : " admin-hub-fields--5"}`}>
          <Field label="Account lead">
            {actions ? <EditableSelect value={p.accountLead?.id ?? ""} options={peopleOptions} onSave={save("account_lead_id")} placeholder="Assign…" ariaLabel="Account lead" render={personLabel} /> : p.accountLead?.name ?? "—"}
          </Field>
          <Field label="Strategic lead">
            {actions ? <EditableSelect value={p.strategicLead?.id ?? ""} options={peopleOptions} onSave={save("strategic_lead_id")} placeholder="Assign…" ariaLabel="Strategic lead" render={personLabel} /> : p.strategicLead?.name ?? "—"}
          </Field>
          <Field label="Contract review">
            {actions ? <EditableDate value={p.contractReview ?? ""} onSave={save("contract_review")} ariaLabel="Contract review date" /> : formatDate(p.contractReview)}
          </Field>
          {isAdmin && (
            <Field label="Fee" internal>
              {actions ? (
                <EditableText value={feeDollars} onSave={save("engagement_fee_cents")} placeholder="Set fee…" ariaLabel="Monthly fee" render={(v) => (v ? `${formatCents(Math.round(Number(v) * 100), "aud")} / mo` : "—")} />
              ) : (
                formatCents(p.engagementFeeCents, "aud")
              )}
            </Field>
          )}
          <Field label="Last catch-up" internal>
            {p.stats.lastFormalCatchup ? formatDate(p.stats.lastFormalCatchup) : <span className="admin-editable-empty">None logged</span>}
          </Field>
          <Field label="Client drive">
            {actions ? <EditableLink value={p.clientDriveFolder ?? ""} onSave={save("client_drive_folder")} placeholder="Add link…" ariaLabel="Client drive folder" /> : p.clientDriveFolder ? <a href={p.clientDriveFolder} target="_blank" rel="noopener noreferrer">Open ↗</a> : "—"}
          </Field>
        </div>

        {actions?.logTouchpoint && (
          <div className="admin-hub-band-foot">
            <LogTouchpoint programId={p.id} recent={touchpoints} action={actions.logTouchpoint} />
          </div>
        )}
      </section>

      <div className="admin-kpi-grid admin-hub-kpis">
        <div className="admin-kpi">
          <div className="admin-kpi-label">Coverage</div>
          <div className="admin-kpi-val">{p.stats.coverageCount}</div>
          <div className="admin-kpi-note">published pieces</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">LinkedIn posts</div>
          <div className="admin-kpi-val">{p.stats.linkedinPostCount}</div>
          <div className="admin-kpi-note">published</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Targets on track</div>
          <div className="admin-kpi-val">
            {plan ? <>{plan.targetsOnTrack} <span className="admin-hub-kpi-of">of {plan.targetsTotal}</span></> : <span className="admin-hub-kpi-of">No plan yet</span>}
          </div>
          <div className={`admin-kpi-note${behind > 0 ? " admin-hub-kpi-note--warn" : ""}`}>
            {plan
              ? behind > 0
                ? `${behind} with a variance`
                : `${plan.quarterLabel}${plan.publishedAt ? "" : " · draft"}`
              : "Start one on the 90-Day Plan tab"}
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Awards in flight</div>
          <div className="admin-kpi-val">{p.stats.awardsInFlight}</div>
          <div className="admin-kpi-note">agreed, submitted or shortlisted</div>
        </div>
      </div>
    </div>
  );
}
