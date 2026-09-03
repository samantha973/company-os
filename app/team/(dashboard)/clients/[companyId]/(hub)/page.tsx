import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getHubOverviewForActor } from "@/lib/team/clients";
import { listAssignablePeople } from "@/lib/admin/people-options";
import { HubProgramsBand } from "@/components/hub/HubProgramsBand";
import { teamSetupProgramWorkspace, teamUpdateProgramEngagement } from "./program-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Client Overview" };

// The hub Overview: the PR Program band (engagement record + live tallies),
// editable in place by the account team. The fee is admin-only and never
// renders here.
export default async function TeamClientHubOverview({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  const [overview, people] = await Promise.all([
    getHubOverviewForActor(actor, params.companyId),
    listAssignablePeople(),
  ]);
  if (!overview) notFound();

  return (
    <HubProgramsBand
      programs={overview.programs}
      audience="team"
      programHref={(programId) => `/team/clients/${params.companyId}/programs/${programId}`}
      people={people}
      actions={{
        update: teamUpdateProgramEngagement.bind(null, params.companyId),
        setupWorkspace: teamSetupProgramWorkspace.bind(null, params.companyId),
      }}
    />
  );
}
