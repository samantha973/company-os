import type { ProgramSummary } from "@/lib/hub/program";
import type { PersonOption } from "@/lib/admin/people-options";
import { ProgramCard, type ProgramCardActions } from "@/components/hub/ProgramCard";

// The hub home's top band, shared by the admin company 360 (Client Hub view)
// and the team client hub Overview: one ProgramCard per PR Program. Pass
// `actions` to make the engagement record editable in place.

export function HubProgramsBand({
  programs,
  audience,
  programHref,
  people,
  actions,
}: {
  programs: ProgramSummary[];
  audience: "admin" | "team";
  programHref: (programId: string) => string;
  people?: PersonOption[];
  actions?: ProgramCardActions;
}) {
  if (programs.length === 0) {
    return (
      <div className="admin-card admin-section-card" style={{ marginBottom: 20 }}>
        <div className="admin-empty">No PR Program yet. Created from the client portal or by the account team.</div>
      </div>
    );
  }
  return (
    <>
      {programs.map((p) => (
        <ProgramCard key={p.id} program={p} audience={audience} href={programHref(p.id)} people={people} actions={actions} />
      ))}
    </>
  );
}
