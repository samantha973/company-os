import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getPlanTabForActor } from "@/lib/team/clients";
import { suggestNextQuarter } from "@/lib/pr/quarters";
import { QuarterlyPlanPanel } from "@/components/hub/QuarterlyPlanPanel";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import {
  teamArchiveTarget,
  teamCreatePlan,
  teamCreateTarget,
  teamCreateWorkstream,
  teamPublishPlan,
  teamUpdatePlan,
  teamUpdateTarget,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "90-Day Plan" };

// The 90-Day Plan tab: the quarter's objectives and targets by workstream,
// editable by the account team. ?plan= switches quarters.
export default async function TeamClientPlanTab({
  params,
  searchParams,
}: {
  params: { companyId: string };
  searchParams: SearchParamsObj;
}) {
  const actor = await requireTeamMember();
  const data = await getPlanTabForActor(actor, params.companyId, firstParam(searchParams.plan));
  if (!data) notFound();
  const { program, tab, meetings } = data;
  const companyId = params.companyId;
  const latestEnd = tab.plans[0]?.ends_on ?? null;

  return (
    <QuarterlyPlanPanel
      programId={program.id}
      plans={tab.plans}
      selected={tab.selected}
      targets={tab.targets}
      groups={tab.groups}
      meetings={meetings.map((m) => ({ id: m.id, title: m.title, date: m.meetingDate }))}
      meetingHrefBase={`/team/clients/${companyId}/meetings`}
      planHrefBase={`/team/clients/${companyId}/plan?plan=`}
      suggestNext={suggestNextQuarter(latestEnd)}
      actions={{
        createPlan: teamCreatePlan.bind(null, companyId),
        updatePlan: teamUpdatePlan.bind(null, companyId),
        publishPlan: teamPublishPlan.bind(null, companyId),
        createTarget: teamCreateTarget.bind(null, companyId),
        updateTarget: teamUpdateTarget.bind(null, companyId),
        archiveTarget: teamArchiveTarget.bind(null, companyId),
        createWorkstream: teamCreateWorkstream.bind(null, companyId),
      }}
    />
  );
}
