import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getCoverageTabForActor } from "@/lib/team/clients";
import { CoveragePanel } from "@/components/hub/CoveragePanel";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { teamCreateOutcome, teamPublishOutcome, teamRemoveOutcome, teamUpdateOutcome } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Client Coverage" };

// The Coverage tab: earned coverage and LinkedIn posts for the program,
// editable by the account team and linked to the plan targets they count
// toward. Published rows are what the client sees.
export default async function TeamClientCoverageTab({
  params,
  searchParams,
}: {
  params: { companyId: string };
  searchParams: SearchParamsObj;
}) {
  const actor = await requireTeamMember();
  const data = await getCoverageTabForActor(actor, params.companyId);
  if (!data) notFound();
  const kind = firstParam(searchParams.kind) === "linkedin" ? "linkedin" : "coverage";
  const companyId = params.companyId;

  return (
    <CoveragePanel
      programId={data.program.id}
      rows={data.rows}
      kind={kind}
      kindHrefBase={`/team/clients/${companyId}/coverage?kind=`}
      targets={data.targets}
      tasks={data.tasks}
      journalists={data.journalists}
      documents={data.documents}
      actions={{
        create: teamCreateOutcome.bind(null, companyId),
        update: teamUpdateOutcome.bind(null, companyId),
        publish: teamPublishOutcome.bind(null, companyId),
        remove: teamRemoveOutcome.bind(null, companyId),
      }}
    />
  );
}
