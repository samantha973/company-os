import type { ProgramSummary } from "@/lib/hub/program";
import type { PersonOption } from "@/lib/admin/people-options";
import type { TouchpointRow } from "@/lib/hub/supporting";
import { ProgramCard, type ProgramCardActions } from "@/components/hub/ProgramCard";

// The hub home's top band, shared by the admin company 360 (Client Hub view)
// and the team client hub Overview: one ProgramCard per PR Program. Pass
// `actions` to make the engagement record editable in place.

export function HubProgramsBand({
  programs,
  audience,
  people,
  touchpoints = [],
  actions,
  scopeSwitch,
  scopeLabel,
}: {
  programs: ProgramSummary[];
  audience: "admin" | "team";
  people?: PersonOption[];
  touchpoints?: TouchpointRow[];
  actions?: ProgramCardActions;
  scopeSwitch?: React.ReactNode;
  scopeLabel?: string;
}) {
  if (programs.length === 0) {
    return (
      <div className="admin-card admin-section-card u-mb-5">
        <div className="admin-empty">No PR Program yet. Created from the client portal or by the account team.</div>
      </div>
    );
  }
  return (
    <>
      {programs.map((p) => (
        <ProgramCard key={p.id} program={p} audience={audience} people={people} touchpoints={touchpoints} actions={actions} scopeSwitch={scopeSwitch} scopeLabel={scopeLabel} />
      ))}
    </>
  );
}
