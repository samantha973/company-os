import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getSupportingTabForActor } from "@/lib/team/clients";
import { AwardsPanel } from "@/components/hub/AwardsPanel";
import { teamArchiveAward, teamCreateAward, teamPublishAward, teamUpdateAward } from "../supporting-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Awards" };

export default async function TeamClientAwardsTab({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  const data = await getSupportingTabForActor(actor, params.companyId);
  if (!data) notFound();
  const c = params.companyId;
  return (
    <AwardsPanel
      programId={data.program.id}
      rows={data.awards}
      documents={data.documents}
      plans={data.plans}
      actions={{
        createAward: teamCreateAward.bind(null, c),
        updateAward: teamUpdateAward.bind(null, c),
        publishAward: teamPublishAward.bind(null, c),
        archiveAward: teamArchiveAward.bind(null, c),
      }}
    />
  );
}
