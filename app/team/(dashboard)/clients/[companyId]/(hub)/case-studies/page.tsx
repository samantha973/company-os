import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getSupportingTabForActor } from "@/lib/team/clients";
import { resolvePlanScope, scopeCaseStudies } from "@/lib/hub/scope";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { CaseStudiesPanel } from "@/components/hub/CaseStudiesPanel";
import { teamArchiveCaseStudy, teamCreateCaseStudy, teamPublishCaseStudy, teamUpdateCaseStudy } from "../supporting-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Case studies" };

export default async function TeamClientCaseStudiesTab({ params, searchParams }: { params: { companyId: string }; searchParams: SearchParamsObj }) {
  const actor = await requireTeamMember();
  const data = await getSupportingTabForActor(actor, params.companyId);
  if (!data) notFound();
  const c = params.companyId;
  const scope = resolvePlanScope(data.planRows, firstParam(searchParams.plan));
  return (
    <CaseStudiesPanel
      programId={data.program.id}
      rows={scopeCaseStudies(data.caseStudies, scope)}
      customers={data.customers}
      actions={{
        createCaseStudy: teamCreateCaseStudy.bind(null, c),
        updateCaseStudy: teamUpdateCaseStudy.bind(null, c),
        publishCaseStudy: teamPublishCaseStudy.bind(null, c),
        archiveCaseStudy: teamArchiveCaseStudy.bind(null, c),
      }}
    />
  );
}
