import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getActorClientCompanies, getHubPlansForActor } from "@/lib/team/clients";
import { ALL_TIME, currentPlan } from "@/lib/hub/scope";
import { PageHead } from "@/components/admin/PageHead";
import { PlanScopeSwitch } from "@/components/hub/PlanScopeSwitch";
import { HubTabs } from "./HubTabs";

// The client hub shell: one header + tab nav shared by every hub tab, with
// the All time / quarter switch beside the tabs. Authorization happens here
// (the company must be in the actor's active assignments) AND again in every
// page's data fetch — the layout gate is UX, the data gates are the security
// boundary.

export default async function TeamClientHubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { companyId: string };
}) {
  const actor = await requireTeamMember();
  const [companies, plans] = await Promise.all([getActorClientCompanies(actor), getHubPlansForActor(actor, params.companyId)]);
  const company = companies.find((c) => c.id === params.companyId);
  if (!company) notFound();

  return (
    <div>
      <PageHead
        eyebrow={<Link href="/team/clients">← My Clients</Link>}
        title={company.name}
        sub={company.roleTitle ? `Your role: ${company.roleTitle}` : "Client hub"}
      />
      <div className="u-row-top u-wrap u-between u-mb-4">
        <HubTabs base={`/team/clients/${company.id}`} />
        {plans.length > 0 && (
          <PlanScopeSwitch
            plans={plans.map((p) => ({ id: p.id, label: p.quarter_label, draft: !p.published_at }))}
            defaultValue={currentPlan(plans)?.id ?? ALL_TIME}
          />
        )}
      </div>
      {children}
    </div>
  );
}
