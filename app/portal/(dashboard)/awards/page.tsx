import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { listAwardsForActor } from "@/lib/portal/supporting";
import { getPlanTabForActor } from "@/lib/portal/plan";
import { resolvePlanScope, scopeAwards, scopeParam } from "@/lib/hub/scope";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { PageHead } from "@/components/admin/PageHead";
import { AwardsPanel } from "@/components/hub/AwardsPanel";
import { PlanScopeSwitch } from "@/components/hub/PlanScopeSwitch";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "Awards" };

export default async function PortalAwardsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const actor = await requirePortalMember();
  const [rows, plan] = await Promise.all([listAwardsForActor(actor), getPlanTabForActor(actor)]);
  const scope = resolvePlanScope(plan?.plans ?? [], firstParam(searchParams.plan));
  return (
    <div className="admin-content">
      <PageHead
        eyebrow="Client hub"
        title="Awards"
        sub="Entries we have proposed, agreed and submitted on your behalf."
        action={plan ? <PlanScopeSwitch plans={plan.plans.map((p) => ({ id: p.id, label: p.quarter_label }))} value={scopeParam(scope)} /> : undefined}
      />
      <div className="admin-card admin-section-card">
        <AwardsPanel programId="" rows={scopeAwards(rows, scope)} />
      </div>
    </div>
  );
}
