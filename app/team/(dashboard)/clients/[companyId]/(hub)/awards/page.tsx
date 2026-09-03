import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getSupportingTabForActor } from "@/lib/team/clients";
import { resolvePlanScope, scopeAwards } from "@/lib/hub/scope";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { AwardsPanel } from "@/components/hub/AwardsPanel";
import { teamArchiveAward, teamCreateAward, teamPublishAward, teamUpdateAward } from "../supporting-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Awards" };

export default async function TeamClientAwardsTab({ params, searchParams }: { params: { companyId: string }; searchParams: SearchParamsObj }) {
  const actor = await requireTeamMember();
  const data = await getSupportingTabForActor(actor, params.companyId);
  if (!data) notFound();
  const c = params.companyId;
  const scope = resolvePlanScope(data.planRows, firstParam(searchParams.plan));
  return (
    <AwardsPanel
      programId={data.program.id}
      rows={scopeAwards(data.awards, scope)}
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
