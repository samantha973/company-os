import type { ReactNode } from "react";
import { Badge, statusTone } from "@/components/admin/Badge";
import { humanize } from "@/lib/admin/format";

// The client's view of the program band: the same shape as the admin band
// (name + status, a row of facts, four tallies) with only client-safe fields.
// No health, fee, contract date, catch-ups or drive links here by design.

export function PortalProgramBand({
  name,
  status,
  accountLead,
  strategicLead,
  quarterLabel,
  quarterDates,
  scopeSwitch,
  scopeLabel,
  kpis,
}: {
  name: string;
  status: string;
  accountLead: string | null;
  strategicLead: string | null;
  quarterLabel: string | null;
  quarterDates: string | null;
  scopeSwitch?: ReactNode;
  scopeLabel: string;
  kpis: {
    coverage: number;
    posts: number;
    postTarget: number | null;
    targetsOnTrack: number;
    targetsTotal: number;
    hasPlan: boolean;
    awardsInFlight: number;
  };
}) {
  const behind = kpis.targetsTotal - kpis.targetsOnTrack;
  return (
    <div className="admin-hub-band">
      <section className="admin-card admin-section-card">
        <div className="admin-hub-band-top">
          <div className="admin-hub-band-title">
            <h2>{name}</h2>
            <Badge tone={statusTone(status)}>{humanize(status)}</Badge>
          </div>
          <div className="admin-hub-band-actions">{scopeSwitch}</div>
        </div>
        <div className="admin-hub-fields admin-hub-fields--5">
          <div className="admin-hub-field">
            <div className="admin-hub-field-label">Account lead</div>
            <div className="admin-hub-field-value">{accountLead ?? "—"}</div>
          </div>
          <div className="admin-hub-field">
            <div className="admin-hub-field-label">Strategic lead</div>
            <div className="admin-hub-field-value">{strategicLead ?? "—"}</div>
          </div>
          <div className="admin-hub-field">
            <div className="admin-hub-field-label">Current quarter</div>
            <div className="admin-hub-field-value">{quarterLabel ?? <span className="admin-editable-empty">No plan published</span>}</div>
          </div>
          <div className="admin-hub-field">
            <div className="admin-hub-field-label">Quarter dates</div>
            <div className="admin-hub-field-value">{quarterDates ?? "—"}</div>
          </div>
        </div>
      </section>

      <div className="admin-kpi-grid admin-hub-kpis">
        <div className="admin-kpi">
          <div className="admin-kpi-label">Coverage</div>
          <div className="admin-kpi-val">{kpis.coverage}</div>
          <div className="admin-kpi-note">published · {scopeLabel}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">LinkedIn posts</div>
          <div className="admin-kpi-val">
            {kpis.posts}
            {kpis.postTarget != null && <span className="admin-kpi-of"> of {kpis.postTarget}</span>}
          </div>
          <div className="admin-kpi-note">published · {scopeLabel}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Targets on track</div>
          <div className="admin-kpi-val">
            {kpis.hasPlan ? <>{kpis.targetsOnTrack} <span className="admin-kpi-of">of {kpis.targetsTotal}</span></> : <span className="admin-kpi-of">No plan yet</span>}
          </div>
          <div className={`admin-kpi-note${behind > 0 ? " admin-kpi-note--warn" : ""}`}>
            {kpis.hasPlan ? (behind > 0 ? `${behind} behind — see the plan` : "all on plan") : "published once the team signs it off"}
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Awards in flight</div>
          <div className="admin-kpi-val">{kpis.awardsInFlight}</div>
          <div className="admin-kpi-note">agreed, submitted or shortlisted · {scopeLabel}</div>
        </div>
      </div>
    </div>
  );
}
