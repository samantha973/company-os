import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getSupportingTabForActor } from "@/lib/team/clients";
import { resolvePlanScope, scopePipeline } from "@/lib/hub/scope";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { PipelinePanel } from "@/components/hub/PipelinePanel";
import { teamArchivePipeline, teamCreatePipeline, teamPromotePipeline, teamPublishPipeline, teamUpdatePipeline } from "../supporting-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "News pipeline" };

export default async function TeamClientPipelineTab({ params, searchParams }: { params: { companyId: string }; searchParams: SearchParamsObj }) {
  const actor = await requireTeamMember();
  const data = await getSupportingTabForActor(actor, params.companyId);
  if (!data) notFound();
  const c = params.companyId;
  const scope = resolvePlanScope(data.planRows, firstParam(searchParams.plan));
  return (
    <PipelinePanel
      programId={data.program.id}
      rows={scopePipeline(data.pipeline, scope)}
      plans={data.plans}
      groups={data.groups}
      actions={{
        createPipeline: teamCreatePipeline.bind(null, c),
        updatePipeline: teamUpdatePipeline.bind(null, c),
        publishPipeline: teamPublishPipeline.bind(null, c),
        archivePipeline: teamArchivePipeline.bind(null, c),
        promotePipeline: teamPromotePipeline.bind(null, c),
      }}
    />
  );
}
