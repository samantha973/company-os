import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getCoverageTabForActor, getHubOverviewForActor, getPlanTabForActor, getSupportingTabForActor } from "@/lib/team/clients";
import { listAssignablePeople } from "@/lib/admin/people-options";
import { ALL_TIME, resolvePlanScope, scopeLabel } from "@/lib/hub/scope";
import { scopeProgramSummary } from "@/lib/hub/scoped-band";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { HubProgramsBand } from "@/components/hub/HubProgramsBand";
import { teamSetupProgramWorkspace, teamUpdateProgramEngagement } from "./program-actions";
import { teamLogTouchpoint } from "./supporting-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Client Overview" };

// The hub Overview: the PR Program band (engagement record + tallies for the
// chosen range), editable in place by the account team. The fee is
// admin-only and never renders here.
export default async function TeamClientHubOverview({ params, searchParams }: { params: { companyId: string }; searchParams: SearchParamsObj }) {
  const actor = await requireTeamMember();
  const planParam = firstParam(searchParams.plan);
  const [overview, people, supporting, coverage, planData] = await Promise.all([
    getHubOverviewForActor(actor, params.companyId),
    listAssignablePeople(),
    getSupportingTabForActor(actor, params.companyId),
    getCoverageTabForActor(actor, params.companyId),
    getPlanTabForActor(actor, params.companyId, planParam === ALL_TIME ? null : planParam),
  ]);
  if (!overview) notFound();

  const scope = resolvePlanScope(planData?.tab.plans ?? [], planParam);
  const programs = overview.programs.map((p, i) =>
    i === 0 && coverage && supporting ? scopeProgramSummary(p, scope, { outcomes: coverage.rows, awards: supporting.awards, plan: planData?.tab ?? null }) : p,
  );

  return (
    <HubProgramsBand
      programs={programs}
      audience="team"
      people={people}
      touchpoints={supporting?.touchpoints ?? []}
      scopeLabel={scopeLabel(scope)}
      actions={{
        update: teamUpdateProgramEngagement.bind(null, params.companyId),
        setupWorkspace: teamSetupProgramWorkspace.bind(null, params.companyId),
        logTouchpoint: teamLogTouchpoint.bind(null, params.companyId),
      }}
    />
  );
}
